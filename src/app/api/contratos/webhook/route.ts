// src/app/api/contratos/webhook/route.ts
// Recebe os eventos de webhook da Assinafy para o módulo de contratos:
//   - document_ready              → todos assinaram: baixa o PDF certificado,
//                                   salva na pasta do aluno no Drive e marca
//                                   o contrato como assinado.
//   - signer_signed_document      → progresso parcial (status segue assinando).
//   - signer_rejected_document    → contrato recusado pelo signatário.
//   - document_processing_failed  → apenas log.
//
// A API da Assinafy NÃO assina o payload (não há HMAC/secret — ver spec em
// api.assinafy.com.br/v1/docs). Auditoria 0063 (webhook spoofável): a
// verificação agora é de 3 camadas, todas fail-closed:
//   1) segredo compartilhado: o header X-Assinafy-Key (ou x-api-key) precisa
//      bater com ASSINAFY_WEBHOOK_SECRET (ou ASSINAFY_API_KEY). Sem segredo
//      configurado, TODOS os eventos são rejeitados (401);
//   2) account_id OBRIGATÓRIO no payload e igual a ASSINAFY_ACCOUNT_ID (403);
//   3) dedup pelo id do evento em contrato_webhook_log (PK) — eventos
//      repetidos recebem 200 imediato e não processam de novo.
// Além disso, transições de estado só acontecem sobre um contrato existente
// e no estado esperado (document_ready exige status 'assinando'), e o id do
// documento é sempre validado contra a tabela contratos antes de qualquer
// efeito colateral (Drive/Assinafy).
// A rota não tem sessão de usuário (como /api/cron/*) → client admin
// (service role), restrito por convenção a rotas de API.

import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadDriveFile } from "@/lib/google/drive";
import { assinafyBaixarDocumento } from "@/lib/assinafy";

export const runtime = "nodejs";

type WebhookEnvelope = {
  id?: unknown;
  event?: unknown;
  account_id?: unknown;
  object?: { id?: unknown; [key: string]: unknown } | null;
};

// Comparação em tempo constante (sha256 de ambos os lados evita vazamento
// de comprimento na comparação direta de strings).
function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(request: Request) {
  // Camada 1 — segredo compartilhado (fail-closed: sem segredo configurado,
  // nenhum evento é aceito). O provedor pode ser configurado para enviar um
  // header customizado na subscription de webhook; x-api-key é aceito como
  // fallback caso o provedor ecoe a chave da conta.
  const webhookSecret = process.env.ASSAINAFY_WEBHOOK_SECRET?.trim();
  const apiKey = process.env.ASSAINAFY_API_KEY?.trim();
  const expected = webhookSecret || apiKey;
  if (!expected) {
    console.error(
      "contratos webhook: ASSINAFY_WEBHOOK_SECRET não configurado — eventos rejeitados (fail-closed)."
    );
    return new Response("webhook não configurado", { status: 401 });
  }

  const presented =
    request.headers.get("x-assinafy-key") ?? request.headers.get("x-api-key");
  if (!presented || !constantTimeEqual(presented, expected)) {
    return new Response("unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  const body: WebhookEnvelope = await request.json().catch(() => ({}));
  const event = typeof body.event === "string" ? body.event : "";
  const eventId = typeof body.id === "number" ? body.id : null;
  const accountId = typeof body.account_id === "string" ? body.account_id : "";
  const documentId =
    typeof body.object?.id === "string" ? body.object.id : null;

  // Camada 2 — workspace de origem: account_id é OBRIGATÓRIO e precisa ser o
  // nosso (fail-closed: payloads sem account_id são rejeitados).
  const expectedAccount = process.env.ASSAINAFY_ACCOUNT_ID?.trim();
  if (!expectedAccount || !accountId || accountId !== expectedAccount) {
    return new Response("account_id inválido", { status: 403 });
  }

  if (eventId === null) {
    return new Response("payload inválido", { status: 400 });
  }

  // Eventos de mudança de estado exigem o id do documento alvo.
  const stateChangingEvents = [
    "document_ready",
    "signer_signed_document",
    "signer_rejected_document",
  ];
  if (stateChangingEvents.includes(event) && !documentId) {
    return new Response("sem document id", { status: 400 });
  }

  // Camada 3 — dedup atômico pelo id do evento.
  const { error: insertError } = await admin
    .from("contrato_webhook_log")
    .insert({
      id: eventId,
      event,
      account_id: accountId,
      payload: body,
    });

  if (insertError) {
    // 23505 = unique violation: evento já processado → 2xx silencioso.
    if (insertError.code === "23505") {
      return new Response("já processado", { status: 200 });
    }
    return new Response("falha ao registrar evento", { status: 500 });
  }

  if (!documentId) {
    return new Response("sem document id", { status: 200 });
  }

  const { data: contrato } = await admin
    .from("contratos")
    .select("id, status, drive_pasta_id")
    .eq("assinafy_document_id", documentId)
    .maybeSingle();

  if (!contrato) {
    return new Response("contrato não encontrado", { status: 200 });
  }

  if (event === "document_ready") {
    // Transição de estado só a partir do estado esperado — um evento forjado
    // (ou reentrante) não consegue "confirmar" um contrato que não está
    // aguardando assinaturas.
    if (contrato.status !== "assinando") {
      return new Response("estado inválido", { status: 409 });
    }
    try {
      const buffer = await assinafyBaixarDocumento(documentId, "certificated");
      const update: Record<string, unknown> = { status: "assinado" };
      if (contrato.drive_pasta_id) {
        const arquivo = await uploadDriveFile(
          contrato.drive_pasta_id,
          "contrato-assinado.pdf",
          buffer
        );
        update.drive_assinado_id = arquivo.id;
        update.drive_assinado_url = arquivo.webViewLink || null;
      }
      await admin
        .from("contratos")
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq("id", contrato.id);
    } catch {
      // Falha ao baixar/arquivar: mantém o status "assinando" — o coordenador
      // baixa o assinado pelo próprio card ("Sincronizar assinatura").
    }
  }

  if (event === "signer_rejected_document") {
    await admin
      .from("contratos")
      .update({ status: "recusado", updated_at: new Date().toISOString() })
      .eq("id", contrato.id);
  }

  return new Response("ok", { status: 200 });
}

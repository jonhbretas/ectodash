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
// api.assinafy.com.br/v1/docs). A verificação é dupla:
//   1) account_id do payload precisa bater com ASSINAFY_ACCOUNT_ID;
//   2) dedup pelo id do evento em contrato_webhook_log (PK) — eventos
//      repetidos recebem 200 imediato e não processam de novo.
// A rota não tem sessão de usuário (como /api/cron/*) → client admin
// (service role), restrito por convenção a rotas de API.

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

export async function POST(request: Request) {
  const admin = createAdminClient();

  const body: WebhookEnvelope = await request.json().catch(() => ({}));
  const event = typeof body.event === "string" ? body.event : "";
  const eventId = typeof body.id === "number" ? body.id : null;
  const accountId = typeof body.account_id === "string" ? body.account_id : "";
  const documentId =
    typeof body.object?.id === "string" ? body.object.id : null;

  // Verificação 1 — o workspace de origem precisa ser o nosso.
  const expectedAccount = process.env.ASSAINAFY_ACCOUNT_ID?.trim();
  if (expectedAccount && accountId && accountId !== expectedAccount) {
    return new Response("account_id inválido", { status: 403 });
  }

  if (eventId === null) {
    return new Response("payload inválido", { status: 400 });
  }

  // Verificação 2 — dedup atômico pelo id do evento.
  const { error: insertError } = await admin
    .from("contrato_webhook_log")
    .insert({
      id: eventId,
      event,
      account_id: accountId || null,
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
    .select("id, drive_pasta_id")
    .eq("assinafy_document_id", documentId)
    .maybeSingle();

  if (!contrato) {
    return new Response("contrato não encontrado", { status: 200 });
  }

  if (event === "document_ready") {
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

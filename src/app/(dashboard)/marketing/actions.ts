"use server";

// Server Actions do módulo Marketing (coordenador_geral only).
// Escrita via service-role (createAdminClient) porque as tabelas
// marketing_* não têm write policy p/ authenticated (migration 0102)
// — o gate de papel abaixo é a enforcement no nível da aplicação.
//
// Operações longas (import 15k, snapshot, disparo) são fatiadas em
// chunks pequenos: o cliente chama em loop com barra de progresso,
// então nenhuma action estoura o timeout serverless do Vercel.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Resend } from "resend";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sanitizeLeads,
  type InvalidLead,
} from "@/lib/marketing/sanitize";
import {
  extractBatchIds,
  unsubscribeUrl,
  withUnsubscribeFooter,
} from "@/lib/marketing/send-campaign";
import { applyMergeTags } from "@/lib/marketing/merge-tags";
import {
  pickWinner,
  tallyVariants,
  variantLetters,
  type VariantTally,
} from "@/lib/marketing/ab";

export interface ActionState {
  ok: boolean;
  message: string;
}

const CHUNK_IMPORT_LINES = 2000;
// 1000 por chamada: PostgREST trunca listagens grandes em 1000 linhas e
// inserts gigantes estouram o timeout serverless — chunks menores com
// conclusão por contagem (remaining==0) são à prova disso.
const CHUNK_QUEUE_LEADS = 1000;
const CHUNK_DISPATCH = 200;
const BATCH_RESEND = 100;

async function requireCoordenador(): Promise<
  { admin: SupabaseClient; user: User } | { error: string }
> {
  // Qualquer exceção aqui (env faltando, rede, sessão) vira mensagem
  // amigável — nunca estoura o error boundary ("Ops, algo deu errado").
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Sessão expirada. Entre de novo." };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "coordenador_geral") {
    return { admin, user };
  }

  // Kill switch global (0105): módulo desligado fecha p/ todos, menos o geral.
  const { data: flags } = await admin
    .from("system_module_flags")
    .select("modulo")
    .eq("modulo", "marketing")
    .eq("ativo", false)
    .limit(1);
  if ((flags ?? []).length > 0) {
    return { error: "O módulo Marketing está desativado no momento." };
  }

  // Comunicação: cargo com o módulo "marketing" concedido (mesma regra
  // da RLS 0104 e do gate de página). Consulta via service-role porque
  // a leitura de cargos alheios pode ser restrita p/ o próprio usuário.
  const { data: cargos } = await admin
    .from("cargos")
    .select("id, cargo_modulos(modulo)")
    .eq("profile_id", user.id);
  const temModulo = ((cargos ?? []) as { cargo_modulos: { modulo: string }[] }[]).some(
    (c) => (c.cargo_modulos ?? []).some((m) => m.modulo === "marketing")
  );
  if (!temModulo) {
    return { error: "Acesso restrito ao coordenador geral ou à comunicação." };
  }
  return { admin, user };
  } catch (err) {
    console.error("requireCoordenador: falha inesperada", err);
    return { error: "Falha de conexão com o servidor. Tente de novo." };
  }
}

// ── Importação de leads (fatiada) ──────────────────────────────────

export interface ImportChunkResult extends ActionState {
  imported: number;
  duplicates: number;
  invalid: InvalidLead[];
  invalidTotal: number;
}

/** Importa até CHUNK_IMPORT_LINES linhas por chamada; o cliente fatia. */
export async function importLeadsChunk(
  rawText: string,
  source?: string
): Promise<ImportChunkResult> {
  const gate = await requireCoordenador();
  if ("error" in gate) {
    return {
      ok: false,
      message: gate.error,
      imported: 0,
      duplicates: 0,
      invalid: [],
      invalidTotal: 0,
    };
  }

  const lines = rawText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    return {
      ok: false,
      message: "Nenhuma linha com conteúdo.",
      imported: 0,
      duplicates: 0,
      invalid: [],
      invalidTotal: 0,
    };
  }
  if (lines.length > CHUNK_IMPORT_LINES) {
    return {
      ok: false,
      message: `Máximo de ${CHUNK_IMPORT_LINES} linhas por lote.`,
      imported: 0,
      duplicates: 0,
      invalid: [],
      invalidTotal: 0,
    };
  }

  const { valid, invalid, duplicatesRemoved } = sanitizeLeads(rawText);
  const { admin } = gate;

  // E-mails que JÁ estão na base (qualquer status — reimportar um
  // unsubscribed NUNCA reativa: conta como duplicado e é ignorado).
  const emails = valid.map((v) => v.email);
  const existing = new Set<string>();
  for (let i = 0; i < emails.length; i += 500) {
    const slice = emails.slice(i, i + 500);
    const { data, error } = await admin
      .from("marketing_leads")
      .select("email")
      .in("email", slice);
    if (error) {
      console.error("importLeadsChunk: existing check failed", error);
      return {
        ok: false,
        message: "Falha ao consultar a base. Tente de novo.",
        imported: 0,
        duplicates: 0,
        invalid: [],
        invalidTotal: 0,
      };
    }
    for (const row of data ?? []) existing.add(row.email as string);
  }

  const fresh = valid.filter((v) => !existing.has(v.email));
  const duplicates = duplicatesRemoved + (valid.length - fresh.length);

  for (let i = 0; i < fresh.length; i += 500) {
    const slice = fresh.slice(i, i + 500).map((v) => ({
      email: v.email,
      nome: v.nome,
      status: "active",
      source: source?.slice(0, 100) ?? null,
    }));
    const { error } = await admin.from("marketing_leads").insert(slice);
    if (error) {
      console.error("importLeadsChunk: insert failed", error);
      return {
        ok: false,
        message: "Falha ao salvar parte dos leads. Tente de novo.",
        imported: 0,
        duplicates,
        invalid,
        invalidTotal: invalid.length,
      };
    }
  }

  revalidatePath("/marketing");
  revalidatePath("/marketing/leads");
  return {
    ok: true,
    message: `${fresh.length} importados, ${duplicates} duplicados, ${invalid.length} inválidos.`,
    imported: fresh.length,
    duplicates,
    invalid: invalid.slice(0, 100),
    invalidTotal: invalid.length,
  };
}

// ── Campanhas ──────────────────────────────────────────────────────

const campaignSchema = z.object({
  titulo: z.string().trim().min(1, "Dê um título à campanha.").max(200),
  subjectsRaw: z.string().trim().min(1, "Digite ao menos 1 assunto."),
  html: z
    .string()
    .trim()
    .min(1, "Cole o código HTML do e-mail.")
    .max(2000000, "HTML grande demais (máx. 2 MB). Tente hospedar as imagens e linkar por URL."),
});

function parseSubjects(raw: string): string[] | null {
  const list = raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  if (list.length === 0 || list.length > 10) return null;
  if (list.some((s) => s.length === 0 || s.length > 200)) return null;
  return list;
}

export async function createCampaign(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState & { id?: number }> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error };

  const parsed = campaignSchema.safeParse({
    titulo: formData.get("titulo"),
    subjectsRaw: formData.get("assuntos"),
    html: formData.get("html"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  // 1 assunto = disparo direto; 2–10 = teste A/B (100 leads por variante).
  const subjects = parseSubjects(parsed.data.subjectsRaw);
  if (!subjects) {
    return { ok: false, message: "Use de 1 a 10 assuntos (1 por linha, máx. 200 caracteres)." };
  }

  try {
    const { data, error } = await gate.admin
      .from("marketing_campaigns")
      .insert({
        titulo: parsed.data.titulo,
        assunto: subjects[0],
        html: parsed.data.html,
        status: "draft",
        ab_test: subjects.length > 1,
        subjects,
        created_by: gate.user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("createCampaign: insert failed", error);
      return { ok: false, message: "Não foi possível salvar a campanha. Tente de novo." };
    }

    revalidatePath("/marketing");
    return { ok: true, message: "Rascunho salvo.", id: data.id as number };
  } catch (err) {
    console.error("createCampaign: falha inesperada", err);
    return { ok: false, message: "Falha de conexão ao salvar. Tente de novo." };
  }
}

const testSchema = z.object({
  campaignId: z.coerce.number().int().positive(),
  to: z.string().trim().email("Digite um e-mail válido p/ o teste."),
});

/** Envia a campanha p/ 1 e-mail de teste (rodapé ilustrativo). */
export async function sendTestEmail(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error };

  const parsed = testSchema.safeParse({
    campaignId: formData.get("campaignId"),
    to: formData.get("to"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data: campaign } = await gate.admin
    .from("marketing_campaigns")
    .select("id, assunto, html")
    .eq("id", parsed.data.campaignId)
    .single();
  if (!campaign) return { ok: false, message: "Campanha não encontrada." };

  const resend = new Resend(process.env.RESEND_API_KEY);
  const toEmail = parsed.data.to.toLowerCase();
  // Token real (uuid) em vez do ilustrativo "teste".
  const token = crypto.randomUUID();
  // Token ilustrativo + nome genérico: mostra como as tags resolvem.
  const personalized = applyMergeTags(campaign.html as string, {
    nome: null,
    email: parsed.data.to,
    unsubscribeUrl: unsubscribeUrl(token),
  });
  const { data, error } = await resend.emails.send({
    from: "EctoDash <contato@ectolab.org>",
    to: [parsed.data.to],
    subject: `[TESTE] ${campaign.assunto as string}`,
    html: withUnsubscribeFooter(personalized, token),
    // Tag campaign: o webhook consegue ligar opened/clicked/delivered
    // deste teste à campanha (antes o teste era "invisível" p/ métricas).
    tags: [{ name: "campaign", value: String(parsed.data.campaignId) }],
  });

  if (error || !data?.id) {
    console.error("sendTestEmail: resend failed", error);
    return { ok: false, message: "Falha no envio de teste." };
  }

  // Registra o teste como destinatário (lead_id NULL = linha de teste;
  // a fila real parte dos leads, então nunca é reenviada). Reenvios p/
  // o mesmo e-mail substituem a linha anterior p/ não inflar a base.
  await gate.admin
    .from("marketing_recipients")
    .delete()
    .eq("campaign_id", parsed.data.campaignId)
    .eq("email", toEmail)
    .is("lead_id", null);
  const { error: recError } = await gate.admin
    .from("marketing_recipients")
    .insert({
      campaign_id: parsed.data.campaignId,
      lead_id: null,
      email: toEmail,
      unsubscribe_token: token,
      status: "sent",
      resend_id: data.id,
    });
  if (recError) {
    console.error("sendTestEmail: recipient log failed", recError);
    return { ok: true, message: `Teste enviado p/ ${parsed.data.to}, mas sem metrificação (avise o suporte).` };
  }
  return { ok: true, message: `Teste enviado p/ ${parsed.data.to} e ligado às métricas da campanha.` };
}

export async function deleteCampaign(campaignId: number): Promise<ActionState> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error };

  const { data: campaign } = await gate.admin
    .from("marketing_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { ok: false, message: "Campanha não encontrada." };
  if (campaign.status !== "draft") {
    return { ok: false, message: "Só rascunhos podem ser excluídos." };
  }

  const { error } = await gate.admin
    .from("marketing_campaigns")
    .delete()
    .eq("id", campaignId);
  if (error) {
    console.error("deleteCampaign: failed", error);
    return { ok: false, message: "Não foi possível excluir." };
  }
  revalidatePath("/marketing");
  return { ok: true, message: "Rascunho excluído." };
}

// ── Enfileiramento (snapshot dos leads ativos, fatiado) ────────────

export interface QueueChunkResult extends ActionState {
  queued: number;
  done: boolean;
}

/**
 * Congela os próximos CHUNK_QUEUE_LEADS leads ativos como
 * destinatários da campanha. O cliente repete até done=true e então
 * chama finalizeQueue. Leads adicionados depois ficam de fora
 * (semântica de snapshot, documentada na UI).
 */
export async function queueCampaignChunk(
  campaignId: number
): Promise<QueueChunkResult> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error, queued: 0, done: false };
  const { admin } = gate;

  const { data: campaign } = await admin
    .from("marketing_campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { ok: false, message: "Campanha não encontrada.", queued: 0, done: false };
  if (campaign.status !== "draft" && campaign.status !== "queued") {
    return { ok: false, message: "Campanha já em disparo.", queued: 0, done: false };
  }

  if (campaign.status === "draft") {
    await admin
      .from("marketing_campaigns")
      .update({ status: "queued" })
      .eq("id", campaignId);
  }

  const { data: last } = await admin
    .from("marketing_recipients")
    .select("lead_id")
    .eq("campaign_id", campaignId)
    .order("lead_id", { ascending: false })
    .limit(1);
  const lastLeadId = (last?.[0]?.lead_id as number | null) ?? 0;

  const { data: leads, error: leadsError } = await admin
    .from("marketing_leads")
    .select("id, email, unsubscribe_token")
    .eq("status", "active")
    .gt("id", lastLeadId)
    .order("id", { ascending: true })
    .limit(CHUNK_QUEUE_LEADS);

  if (leadsError) {
    console.error("queueCampaignChunk: leads fetch failed", leadsError);
    return { ok: false, message: "Falha ao ler a base.", queued: 0, done: false };
  }
  if (!leads || leads.length === 0) {
    return { ok: true, message: "Fila pronta.", queued: 0, done: true };
  }

  const rows = leads.map((l) => ({
    campaign_id: campaignId,
    lead_id: l.id as number,
    email: l.email as string,
    unsubscribe_token: l.unsubscribe_token as string,
    status: "pending",
  }));
  const { error: insertError } = await admin
    .from("marketing_recipients")
    .upsert(rows, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true });
  if (insertError) {
    console.error("queueCampaignChunk: insert failed", insertError);
    return { ok: false, message: "Falha ao enfileirar.", queued: 0, done: false };
  }

  // Conclusão por contagem (não por tamanho do lote): truncamentos
  // silenciosos no fetch/insert não encerram a fila antes da hora.
  const newMax = (leads[leads.length - 1]?.id as number) ?? lastLeadId;
  const { count: remaining } = await admin
    .from("marketing_leads")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .gt("id", newMax);
  const done = (remaining ?? 0) === 0;
  return {
    ok: true,
    message: done ? "Fila pronta." : `${leads.length} enfileirados…`,
    queued: leads.length,
    done,
  };
}

/** Fecha o snapshot: total + status sending. */
export async function finalizeQueue(campaignId: number): Promise<ActionState & { total?: number }> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error };

  const { count } = await gate.admin
    .from("marketing_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (!count) {
    await gate.admin
      .from("marketing_campaigns")
      .update({ status: "draft", error_message: "Nenhum lead ativo na base." })
      .eq("id", campaignId);
    return { ok: false, message: "Nenhum lead ativo na base p/ disparar." };
  }

  await gate.admin
    .from("marketing_campaigns")
    .update({ status: "sending", total: count })
    .eq("id", campaignId);
  revalidatePath("/marketing");
  return { ok: true, message: `${count} destinatários na fila.`, total: count };
}

// ── Disparo (fatiado, respeita 10 req/s do Resend) ─────────────────

export interface DispatchChunkResult extends ActionState {
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  done: boolean;
}

export async function dispatchChunk(campaignId: number): Promise<DispatchChunkResult> {
  const gate = await requireCoordenador();
  if ("error" in gate) {
    return { ok: false, message: gate.error, sent: 0, failed: 0, skipped: 0, remaining: -1, done: false };
  }
  const { admin } = gate;

  const { data: campaign } = await admin
    .from("marketing_campaigns")
    .select("id, status, assunto, html, subjects, winner_subject")
    .eq("id", campaignId)
    .single();
  if (!campaign) {
    return { ok: false, message: "Campanha não encontrada.", sent: 0, failed: 0, skipped: 0, remaining: -1, done: false };
  }
  if (campaign.status !== "sending" && campaign.status !== "testing") {
    return { ok: false, message: "Campanha não está em disparo.", sent: 0, failed: 0, skipped: 0, remaining: -1, done: false };
  }

  const { data: pending } = await admin
    .from("marketing_recipients")
    .select("id, lead_id, email, unsubscribe_token, variant")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(CHUNK_DISPATCH);

  if (!pending || pending.length === 0) {
    // Fase de teste: esgotou a amostra, mas a campanha segue em "testing"
    // até a apuração da vencedora — nunca marca "sent" aqui.
    if (campaign.status === "testing") {
      return { ok: true, message: "Amostra enviada.", sent: 0, failed: 0, skipped: 0, remaining: 0, done: true };
    }
    // Recount: a fila pode ter crescido (completar disparo) depois do total.
    const { count: finalTotal } = await admin
      .from("marketing_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId);
    await admin
      .from("marketing_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString(), total: finalTotal ?? 0 })
      .eq("id", campaignId);
    revalidatePath("/marketing");
    return { ok: true, message: "Disparo concluído.", sent: 0, failed: 0, skipped: 0, remaining: 0, done: true };
  }

  const subjects = ((campaign.subjects as string[] | null) ?? []) as string[];
  const subjectFor = (variant: string | null): string => {
    if (variant) {
      const idx = variant.charCodeAt(0) - 65;
      if (subjects[idx]) return subjects[idx] as string;
    }
    // Restante pós-teste usa a vencedora; disparo simples usa o assunto.
    return ((campaign.winner_subject as string | null) ?? (campaign.assunto as string));
  };

  // Lead que se descadastrou DEPOIS do snapshot: pula (LGPD), não envia.
  const leadIds = pending.map((p) => p.lead_id as number);
  const { data: leadRows } = await admin
    .from("marketing_leads")
    .select("id, status, nome")
    .in("id", leadIds);
  const leadStatus = new Map<number, string>(
    (leadRows ?? []).map((l) => [l.id as number, l.status as string])
  );
  const leadNome = new Map<number, string | null>(
    (leadRows ?? []).map((l) => [l.id as number, (l.nome as string | null) ?? null])
  );

  const skippedIds: number[] = [];
  const sendable = pending.filter((p) => {
    const st = leadStatus.get(p.lead_id as number);
    if (st !== "active") {
      skippedIds.push(p.id as number);
      return false;
    }
    return true;
  });

  if (skippedIds.length > 0) {
    await admin
      .from("marketing_recipients")
      .update({ status: "skipped" })
      .in("id", skippedIds);
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < sendable.length; i += BATCH_RESEND) {
    const batch = sendable.slice(i, i + BATCH_RESEND);
    try {
      const { data, error } = await resend.batch.send(
        batch.map((p) => {
          const token = p.unsubscribe_token as string;
          const personalized = applyMergeTags(campaign.html as string, {
            nome: leadNome.get(p.lead_id as number) ?? null,
            email: p.email as string,
            unsubscribeUrl: unsubscribeUrl(token),
          });
          return {
            from: "EctoDash <contato@ectolab.org>",
            to: p.email as string,
            subject: subjectFor(p.variant as string | null),
            html: withUnsubscribeFooter(personalized, token),
            tags: [
              { name: "campaign", value: String(campaignId) },
              ...(p.variant ? [{ name: "variant", value: p.variant as string }] : []),
            ],
          };
        })
      );
      if (error) {
        console.error("dispatchChunk: batch failed", error);
        for (const p of batch) {
          await admin
            .from("marketing_recipients")
            .update({ status: "failed", error_message: "batch rejected" })
            .eq("id", p.id);
        }
        failed += batch.length;
        continue;
      }
      const ids = extractBatchIds(data);
      for (let j = 0; j < batch.length; j++) {
        await admin
          .from("marketing_recipients")
          .update({ status: "sent", resend_id: ids[j] ?? null })
          .eq("id", batch[j].id);
      }
      sent += batch.length;
    } catch (err) {
      console.error("dispatchChunk: batch threw", err);
      for (const p of batch) {
        await admin
          .from("marketing_recipients")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message.slice(0, 300) : "unknown",
          })
          .eq("id", p.id);
      }
      failed += batch.length;
    }
  }

  // Contadores da campanha (incrementais por chunk).
  const { data: camp } = await admin
    .from("marketing_campaigns")
    .select("sent_count, failed_count, skipped_count")
    .eq("id", campaignId)
    .single();
  if (camp) {
    await admin
      .from("marketing_campaigns")
      .update({
        sent_count: ((camp.sent_count as number) ?? 0) + sent,
        failed_count: ((camp.failed_count as number) ?? 0) + failed,
        skipped_count: ((camp.skipped_count as number) ?? 0) + skippedIds.length,
      })
      .eq("id", campaignId);
  }

  const { count: remaining } = await admin
    .from("marketing_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "pending");

  return {
    ok: true,
    message: `${sent} enviados neste lote.`,
    sent,
    failed,
    skipped: skippedIds.length,
    remaining: remaining ?? -1,
    done: false,
  };
}

// ── Teste A/B ──────────────────────────────────────────────────────
// Fluxo: queueTestChunk (loop) → finalizeTestQueue → dispatchChunk
// (loop, mesma action do disparo normal) → aguardar aberturas →
// tallyAb → declareWinner → queueRemainderChunk (loop) →
// finalizeQueue → dispatchChunk (loop com a vencedora).

export interface QueueTestChunkResult extends ActionState {
  queued: number;
  done: boolean;
}

/**
 * Congela a amostra do teste: test_per_variant (100) primeiros leads
 * ativos por variante (A..J, round-robin). Só vale p/ campanha ab_test
 * em draft.
 */
export async function queueTestChunk(campaignId: number): Promise<QueueTestChunkResult> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error, queued: 0, done: false };
  const { admin } = gate;

  const { data: campaign } = await admin
    .from("marketing_campaigns")
    .select("id, status, ab_test, subjects, test_per_variant")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { ok: false, message: "Campanha não encontrada.", queued: 0, done: false };
  if (!(campaign.ab_test as boolean) || campaign.status !== "draft") {
    return { ok: false, message: "Teste A/B só vale p/ rascunho com 2+ assuntos.", queued: 0, done: false };
  }

  const subjects = ((campaign.subjects as string[] | null) ?? []) as string[];
  const letters = variantLetters(subjects.length);
  const perVariant = (campaign.test_per_variant as number) ?? 100;
  const target = perVariant * letters.length;

  const { count: have } = await admin
    .from("marketing_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  const haveCount = have ?? 0;
  if (haveCount >= target) {
    return { ok: true, message: "Amostra pronta.", queued: 0, done: true };
  }

  const { data: last } = await admin
    .from("marketing_recipients")
    .select("lead_id")
    .eq("campaign_id", campaignId)
    .order("lead_id", { ascending: false })
    .limit(1);
  const lastLeadId = (last?.[0]?.lead_id as number | null) ?? 0;

  const need = Math.min(CHUNK_QUEUE_LEADS, target - haveCount);
  const { data: leads, error: leadsError } = await admin
    .from("marketing_leads")
    .select("id, email, unsubscribe_token")
    .eq("status", "active")
    .gt("id", lastLeadId)
    .order("id", { ascending: true })
    .limit(need);
  if (leadsError) {
    console.error("queueTestChunk: leads fetch failed", leadsError);
    return { ok: false, message: "Falha ao ler a base.", queued: 0, done: false };
  }
  if (!leads || leads.length === 0) {
    return { ok: false, message: "Base ativa menor que a amostra do teste.", queued: 0, done: false };
  }

  const rows = leads.map((l, i) => ({
    campaign_id: campaignId,
    lead_id: l.id as number,
    email: l.email as string,
    unsubscribe_token: l.unsubscribe_token as string,
    status: "pending",
    variant: letters[(haveCount + i) % letters.length] as string,
  }));
  const { error: insertError } = await admin
    .from("marketing_recipients")
    .upsert(rows, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true });
  if (insertError) {
    console.error("queueTestChunk: insert failed", insertError);
    return { ok: false, message: "Falha ao enfileirar amostra.", queued: 0, done: false };
  }

  const done = haveCount + leads.length >= target;
  return {
    ok: true,
    message: done ? "Amostra pronta." : `${leads.length} enfileirados…`,
    queued: leads.length,
    done,
  };
}

/** Fecha a amostra e põe a campanha em "testing". */
export async function finalizeTestQueue(campaignId: number): Promise<ActionState> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error };

  const { count } = await gate.admin
    .from("marketing_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  if (!count) return { ok: false, message: "Amostra vazia." };

  await gate.admin
    .from("marketing_campaigns")
    .update({ status: "testing", test_sent_at: new Date().toISOString() })
    .eq("id", campaignId);
  revalidatePath("/marketing");
  return { ok: true, message: `${count} e-mails de teste na fila.` };
}

export interface TallyResult extends ActionState {
  tally: VariantTally[];
  winner: VariantTally | null;
}

/** Apuração atual por variante (taxa de abertura). */
export async function tallyAb(campaignId: number): Promise<TallyResult> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error, tally: [], winner: null };

  const [{ data: campaign }, { data: recipients }] = await Promise.all([
    gate.admin.from("marketing_campaigns").select("subjects").eq("id", campaignId).single(),
    gate.admin
      .from("marketing_recipients")
      .select("variant, status, opened_at")
      .eq("campaign_id", campaignId)
      .not("variant", "is", null),
  ]);
  if (!campaign) return { ok: false, message: "Campanha não encontrada.", tally: [], winner: null };

  const subjects = ((campaign.subjects as string[] | null) ?? []) as string[];
  const tally = tallyVariants(subjects, (recipients ?? []) as { variant: string | null; status: string; opened_at: string | null }[]);
  return { ok: true, message: "Apuração atualizada.", tally, winner: pickWinner(tally) };
}

/**
 * Declara a vencedora (auto = maior taxa, ou a variante escolhida) e
 * volta a campanha p/ "sending" — o restante usa winner_subject.
 */
export async function declareWinner(
  campaignId: number,
  variant?: string
): Promise<ActionState & { winner?: VariantTally }> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error };

  const [{ data: campaign }, { data: recipients }] = await Promise.all([
    gate.admin.from("marketing_campaigns").select("id, status, subjects").eq("id", campaignId).single(),
    gate.admin
      .from("marketing_recipients")
      .select("variant, status, opened_at")
      .eq("campaign_id", campaignId)
      .not("variant", "is", null),
  ]);
  if (!campaign) return { ok: false, message: "Campanha não encontrada." };
  if (campaign.status !== "testing") return { ok: false, message: "Apuração só vale na fase de teste." };

  const subjects = ((campaign.subjects as string[] | null) ?? []) as string[];
  const tally = tallyVariants(subjects, (recipients ?? []) as { variant: string | null; status: string; opened_at: string | null }[]);
  const win = variant
    ? tally.find((t) => t.variant === variant) ?? null
    : pickWinner(tally);
  if (!win || win.sent === 0) return { ok: false, message: "Ainda sem dados de envio p/ apurar." };

  await gate.admin
    .from("marketing_campaigns")
    .update({ winner_subject: win.subject, status: "sending" })
    .eq("id", campaignId);
  revalidatePath("/marketing");
  return { ok: true, message: `Vencedora: "${win.subject}" (${(win.rate * 100).toFixed(1)}% de abertura).`, winner: win };
}

/** Enfileira o restante da base (variant NULL → usa a vencedora, ou o
 *  assunto único). Nunca repete quem já está na fila (upsert ignora
 *  duplicados) e reabre campanhas "sent" para completar o disparo. */
export async function queueRemainderChunk(campaignId: number): Promise<QueueTestChunkResult> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error, queued: 0, done: false };
  const { admin } = gate;

  const { data: campaign } = await admin
    .from("marketing_campaigns")
    .select("id, status, ab_test, winner_subject")
    .eq("id", campaignId)
    .single();
  if (!campaign) return { ok: false, message: "Campanha não encontrada.", queued: 0, done: false };
  if (!["sending", "sent", "queued"].includes(campaign.status as string)) {
    return { ok: false, message: "Campanha não está em disparo.", queued: 0, done: false };
  }
  if ((campaign.ab_test as boolean) && !(campaign.winner_subject as string | null)) {
    return { ok: false, message: "Apure a vencedora antes.", queued: 0, done: false };
  }
  if (campaign.status !== "sending") {
    await admin.from("marketing_campaigns").update({ status: "sending" }).eq("id", campaignId);
  }

  const { data: last } = await admin
    .from("marketing_recipients")
    .select("lead_id")
    .eq("campaign_id", campaignId)
    .order("lead_id", { ascending: false })
    .limit(1);
  const lastLeadId = (last?.[0]?.lead_id as number | null) ?? 0;

  const { data: leads, error: leadsError } = await admin
    .from("marketing_leads")
    .select("id, email, unsubscribe_token")
    .eq("status", "active")
    .gt("id", lastLeadId)
    .order("id", { ascending: true })
    .limit(CHUNK_QUEUE_LEADS);
  if (leadsError) {
    console.error("queueRemainderChunk: leads fetch failed", leadsError);
    return { ok: false, message: "Falha ao ler a base.", queued: 0, done: false };
  }
  if (!leads || leads.length === 0) {
    return { ok: true, message: "Nada novo na base.", queued: 0, done: true };
  }

  const rows = leads.map((l) => ({
    campaign_id: campaignId,
    lead_id: l.id as number,
    email: l.email as string,
    unsubscribe_token: l.unsubscribe_token as string,
    status: "pending",
    variant: null,
  }));
  const { error: insertError } = await admin
    .from("marketing_recipients")
    .upsert(rows, { onConflict: "campaign_id,lead_id", ignoreDuplicates: true });
  if (insertError) {
    console.error("queueRemainderChunk: insert failed", insertError);
    return { ok: false, message: "Falha ao enfileirar.", queued: 0, done: false };
  }

  const newMax = (leads[leads.length - 1]?.id as number) ?? lastLeadId;
  const { count: remaining } = await admin
    .from("marketing_leads")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .gt("id", newMax);
  const done = (remaining ?? 0) === 0;
  return {
    ok: true,
    message: done ? "Fila completa." : `${leads.length} enfileirados…`,
    queued: leads.length,
    done,
  };
}

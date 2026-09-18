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
  MAX_IMPORT_LINES,
  sanitizeLeads,
  type InvalidLead,
} from "@/lib/marketing/sanitize";
import {
  sendCampaignEmail,
  withUnsubscribeFooter,
} from "@/lib/marketing/send-campaign";

export interface ActionState {
  ok: boolean;
  message: string;
}

const CHUNK_IMPORT_LINES = 2000;
const CHUNK_QUEUE_LEADS = 2000;
const CHUNK_DISPATCH = 200;
const BATCH_RESEND = 100;

async function requireCoordenador(): Promise<
  { admin: SupabaseClient; user: User } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

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
  assunto: z.string().trim().min(1, "Digite o assunto do e-mail.").max(200),
  html: z
    .string()
    .trim()
    .min(1, "Cole o código HTML do e-mail.")
    .max(500000, "HTML grande demais (máx. 500 KB)."),
});

export async function createCampaign(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState & { id?: number }> {
  const gate = await requireCoordenador();
  if ("error" in gate) return { ok: false, message: gate.error };

  const parsed = campaignSchema.safeParse({
    titulo: formData.get("titulo"),
    assunto: formData.get("assunto"),
    html: formData.get("html"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { data, error } = await gate.admin
    .from("marketing_campaigns")
    .insert({
      titulo: parsed.data.titulo,
      assunto: parsed.data.assunto,
      html: parsed.data.html,
      status: "draft",
      created_by: gate.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createCampaign: insert failed", error);
    return { ok: false, message: "Não foi possível salvar a campanha." };
  }

  revalidatePath("/marketing");
  return { ok: true, message: "Rascunho salvo.", id: data.id as number };
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
  // Token ilustrativo: o link de descadastro no e-mail de teste leva a
  // uma página informando que o link não vale (só leads reais têm token).
  const { error } = await resend.emails.send({
    from: "Ectolab <contato@ectolab.org>",
    to: [parsed.data.to],
    subject: `[TESTE] ${campaign.assunto as string}`,
    html: withUnsubscribeFooter(campaign.html as string, "teste"),
  });

  if (error) {
    console.error("sendTestEmail: resend failed", error);
    return { ok: false, message: "Falha no envio de teste." };
  }
  return { ok: true, message: `Teste enviado p/ ${parsed.data.to}.` };
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

  const done = leads.length < CHUNK_QUEUE_LEADS;
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
    .select("id, status, assunto, html")
    .eq("id", campaignId)
    .single();
  if (!campaign) {
    return { ok: false, message: "Campanha não encontrada.", sent: 0, failed: 0, skipped: 0, remaining: -1, done: false };
  }
  if (campaign.status !== "sending") {
    return { ok: false, message: "Campanha não está em disparo.", sent: 0, failed: 0, skipped: 0, remaining: -1, done: false };
  }

  const { data: pending } = await admin
    .from("marketing_recipients")
    .select("id, lead_id, email, unsubscribe_token")
    .eq("campaign_id", campaignId)
    .eq("status", "pending")
    .order("id", { ascending: true })
    .limit(CHUNK_DISPATCH);

  if (!pending || pending.length === 0) {
    await admin
      .from("marketing_campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", campaignId);
    revalidatePath("/marketing");
    return { ok: true, message: "Disparo concluído.", sent: 0, failed: 0, skipped: 0, remaining: 0, done: true };
  }

  // Lead que se descadastrou DEPOIS do snapshot: pula (LGPD), não envia.
  const leadIds = pending.map((p) => p.lead_id as number);
  const { data: leadRows } = await admin
    .from("marketing_leads")
    .select("id, status")
    .in("id", leadIds);
  const leadStatus = new Map<number, string>(
    (leadRows ?? []).map((l) => [l.id as number, l.status as string])
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
        batch.map((p) => ({
          from: "Ectolab <contato@ectolab.org>",
          to: p.email as string,
          subject: campaign.assunto as string,
          html: withUnsubscribeFooter(
            campaign.html as string,
            p.unsubscribe_token as string
          ),
          tags: [{ name: "campaign", value: String(campaignId) }],
        }))
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
      const ids = Array.isArray(data)
        ? data.map((d) => (d as { id?: string })?.id ?? null)
        : [];
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

export { MAX_IMPORT_LINES };

// src/app/api/marketing/webhook/route.ts
// POST /api/marketing/webhook — recebe eventos do Resend (email.opened,
// email.bounced, email.complained). Autenticação = assinatura Svix
// (RESEND_WEBHOOK_SECRET); sem sessão, sem CRON_SECRET.
// Idempotente por svix-id (delivery at-least-once do Resend).
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySvixSignature } from "@/lib/marketing/webhook";

type ResendTags =
  | Record<string, string>
  | { name: string; value: string }[];

interface ResendEvent {
  type: string;
  data?: {
    email_id?: string;
    to?: string[];
    tags?: ResendTags;
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

interface RecipientRef {
  id: number;
  lead_id: number | null;
}

function campaignIdFromTags(tags: ResendTags | undefined): number | null {
  if (!tags) return null;
  if (Array.isArray(tags)) {
    const hit = tags.find((t) => t.name === "campaign");
    const n = Number(hit?.value);
    return Number.isInteger(n) ? n : null;
  }
  const n = Number(tags["campaign"]);
  return Number.isInteger(n) ? n : null;
}

/** Localiza o destinatário: primeiro por resend_id; fallback por
 *  (tag campaign + e-mail) — resgata envios cujo resend_id não foi
 *  gravado (ex.: amostra A/B anterior à correção). */
async function findRecipient(
  supabase: AdminClient,
  emailId: string | undefined,
  tags: ResendTags | undefined,
  toEmail: string | undefined
): Promise<RecipientRef | null> {
  if (emailId) {
    const { data } = await supabase
      .from("marketing_recipients")
      .select("id, lead_id")
      .eq("resend_id", emailId)
      .limit(1)
      .maybeSingle();
    if (data) return { id: data.id as number, lead_id: (data.lead_id as number | null) ?? null };
  }
  const campaignId = campaignIdFromTags(tags);
  if (campaignId && toEmail) {
    const { data } = await supabase
      .from("marketing_recipients")
      .select("id, lead_id")
      .eq("campaign_id", campaignId)
      .eq("email", toEmail.toLowerCase())
      .limit(1)
      .maybeSingle();
    if (data) return { id: data.id as number, lead_id: (data.lead_id as number | null) ?? null };
  }
  return null;
}

export async function POST(request: Request) {
  const svixId = request.headers.get("svix-id") ?? "";
  const svixTs = request.headers.get("svix-timestamp") ?? "";
  const svixSig = request.headers.get("svix-signature") ?? "";
  const rawBody = await request.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  if (!secret || !verifySvixSignature(secret, svixId, svixTs, rawBody, svixSig)) {
    return new Response("bad signature", { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return new Response("bad payload", { status: 400 });
  }

  const supabase = createAdminClient();

  // Idempotência: svix-id repetido = replay/duplicata → 200 sem efeito.
  const { error: seenError } = await supabase
    .from("marketing_webhook_events")
    .insert({ svix_id: svixId, type: event.type ?? "unknown" });
  if (seenError) {
    if (seenError.code === "23505") return Response.json({ ok: true, deduped: true });
    console.error("marketing webhook: event log failed", seenError);
    return new Response("internal error", { status: 500 });
  }

  const toEmail = event.data?.to?.[0];
  const rec = await findRecipient(supabase, event.data?.email_id, event.data?.tags, toEmail);
  if (!rec) return Response.json({ ok: true, unmatched: true });

  if (event.type === "email.opened") {
    const { data: current } = await supabase
      .from("marketing_recipients")
      .select("open_count")
      .eq("id", rec.id)
      .single();
    await supabase
      .from("marketing_recipients")
      .update({
        opened_at: new Date().toISOString(),
        open_count: (((current?.open_count as number | undefined) ?? 0) + 1),
        // Preenche o resend_id quando o match foi por e-mail.
        ...(event.data?.email_id ? { resend_id: event.data.email_id } : {}),
      })
      .eq("id", rec.id);
  } else if (event.type === "email.bounced") {
    // Hard bounce provável → lead sai das próximas bases (higiene).
    if (rec.lead_id) {
      await supabase
        .from("marketing_leads")
        .update({ status: "invalid" })
        .eq("id", rec.lead_id)
        .eq("status", "active");
    }
  } else if (event.type === "email.complained") {
    // "Marcar como spam" = descadastro imediato (LGPD).
    if (rec.lead_id) {
      await supabase
        .from("marketing_leads")
        .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
        .eq("id", rec.lead_id)
        .eq("status", "active");
    }
  }

  return Response.json({ ok: true });
}

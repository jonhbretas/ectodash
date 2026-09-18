// src/app/api/marketing/webhook/route.ts
// POST /api/marketing/webhook — recebe eventos do Resend (email.opened,
// email.bounced, email.complained). Autenticação = assinatura Svix
// (RESEND_WEBHOOK_SECRET); sem sessão, sem CRON_SECRET.
// Idempotente por svix-id (delivery at-least-once do Resend).
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySvixSignature } from "@/lib/marketing/webhook";

interface ResendEvent {
  type: string;
  data?: {
    email_id?: string;
    to?: string[];
  };
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

  const emailId = event.data?.email_id;
  if (!emailId) return Response.json({ ok: true });

  if (event.type === "email.opened") {
    const { data: rec } = await supabase
      .from("marketing_recipients")
      .select("id, open_count")
      .eq("resend_id", emailId)
      .limit(1)
      .single();
    if (rec) {
      await supabase
        .from("marketing_recipients")
        .update({
          opened_at: new Date().toISOString(),
          open_count: ((rec.open_count as number) ?? 0) + 1,
        })
        .eq("id", rec.id);
    }
  } else if (event.type === "email.bounced") {
    // Hard bounce provável → lead sai das próximas bases (higiene).
    const { data: rec } = await supabase
      .from("marketing_recipients")
      .select("lead_id")
      .eq("resend_id", emailId)
      .limit(1)
      .single();
    const leadId = rec?.lead_id as number | null;
    if (leadId) {
      await supabase
        .from("marketing_leads")
        .update({ status: "invalid" })
        .eq("id", leadId)
        .eq("status", "active");
    }
  } else if (event.type === "email.complained") {
    // "Marcar como spam" = descadastro imediato (LGPD).
    const { data: rec } = await supabase
      .from("marketing_recipients")
      .select("lead_id")
      .eq("resend_id", emailId)
      .limit(1)
      .single();
    const leadId = rec?.lead_id as number | null;
    if (leadId) {
      await supabase
        .from("marketing_leads")
        .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
        .eq("id", leadId)
        .eq("status", "active");
    }
  }

  return Response.json({ ok: true });
}

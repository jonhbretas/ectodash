// src/lib/reminders/send-reminder.ts
// Thin wrapper around resend.emails.send() — isolates the one call site that
// needs mocking in tests. Sends ONE digest email per recipient listing all
// of their eligible demandas (each with a direct link), never one email per
// demanda.
import type { Resend } from "resend";
import { format } from "date-fns";
import { ReminderEmail, type ReminderDigestItem } from "@/emails/reminder-email";

export interface SendReminderParams {
  resend: Resend;
  to: string;
  items: ReminderDigestItem[];
}

export interface SendReminderResult {
  error: string | null;
}

export async function sendReminder({
  resend,
  to,
  items,
}: SendReminderParams): Promise<SendReminderResult> {
  const hoje = format(new Date(), "dd/MM/yyyy");
  const subject =
    items.length === 1
      ? `EctoDash — 1 demanda precisa da sua atenção (${hoje})`
      : `EctoDash — ${items.length} demandas precisam da sua atenção (${hoje})`;

  const { error } = await resend.emails.send({
    from: "EctoDash <contato@ectolab.org>",
    to: [to],
    subject,
    react: ReminderEmail({ items }),
  });

  return { error: error?.message ?? null };
}

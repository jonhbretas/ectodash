// src/lib/reminders/send-reminder.ts
// Thin wrapper around resend.emails.send() — isolates the one call site that
// needs mocking in tests (07-RESEARCH.md's cron route skeleton calls this
// directly, per demanda/responsável pair, never batching responsáveis into a
// single `to` array).
import type { Resend } from "resend";
import { ReminderEmail } from "@/emails/reminder-email";

export interface SendReminderParams {
  resend: Resend;
  to: string;
  titulo: string;
  prazoFormatado: string;
  tipo: "atrasada" | "aproximando";
}

export interface SendReminderResult {
  error: string | null;
}

export async function sendReminder({
  resend,
  to,
  titulo,
  prazoFormatado,
  tipo,
}: SendReminderParams): Promise<SendReminderResult> {
  const { error } = await resend.emails.send({
    from: "EctoDash <lembretes@ectolab.org>",
    to: [to],
    subject: tipo === "atrasada" ? "Demanda atrasada" : "Demanda com prazo próximo",
    react: ReminderEmail({ titulo, prazoFormatado, tipo }),
  });

  return { error: error?.message ?? null };
}

// src/lib/notifications/send-comment-email.ts
// Thin wrapper around resend.emails.send() for comment-mention emails —
// same shape as src/lib/reminders/send-reminder.ts, so the one Resend call
// site stays isolatable for tests. SERVER-ONLY (imports react-email).
import type { Resend } from "resend";
import { CommentEmail } from "@/emails/comment-email";

export interface SendCommentEmailParams {
  resend: Resend;
  to: string;
  autorNome: string;
  demandaTitulo: string;
  comentario: string;
  link: string;
}

export interface SendCommentEmailResult {
  error: string | null;
}

export async function sendCommentEmail({
  resend,
  to,
  autorNome,
  demandaTitulo,
  comentario,
  link,
}: SendCommentEmailParams): Promise<SendCommentEmailResult> {
  const { error } = await resend.emails.send({
    from: "EctoDash <lembretes@ectolab.org>",
    to: [to],
    subject: `Você foi mencionado em "${demandaTitulo}"`,
    react: CommentEmail({
      autorNome,
      demandaTitulo,
      comentario,
      link,
    }),
  });

  return { error: error?.message ?? null };
}

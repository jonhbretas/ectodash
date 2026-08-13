// src/lib/notifications/send-nova-senha.ts
// Thin wrapper around resend.emails.send() for the manual password reset
// notification — isolates the call site so tests can mock this module
// without touching the Resend client (same pattern as send-reminder.ts).
import { resend } from "@/lib/resend";
import { NovaSenhaEmail } from "@/emails/nova-senha-email";

export interface SendNovaSenhaParams {
  to: string;
  nome: string;
  novaSenha: string;
}

export interface SendNovaSenhaResult {
  error: string | null;
}

export async function sendNovaSenha({
  to,
  nome,
  novaSenha,
}: SendNovaSenhaParams): Promise<SendNovaSenhaResult> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://painel.ectolab.org";

  const { error } = await resend.emails.send({
    from: "EctoDash <lembretes@ectolab.org>",
    to: [to],
    subject: "Sua senha de acesso ao EctoDash foi redefinida",
    react: NovaSenhaEmail({ nome, novaSenha, siteUrl }),
  });

  return { error: error?.message ?? null };
}

// src/lib/marketing/send-campaign.ts
// Envio de e-mail marketing via Resend (API transacional) com rodapé
// de descadastro LGPD. Isola o call site p/ mock em testes, no mesmo
// padrão de src/lib/reminders/send-reminder.ts.
import type { Resend } from "resend";

export const MARKETING_FROM = "Ectolab <contato@ectolab.org>";

export function marketingSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://painel.ectolab.org";
}

export function unsubscribeUrl(token: string): string {
  return `${marketingSiteUrl()}/descadastrar?token=${token}`;
}

/** Anexa o rodapé com link único de descadastro ao HTML da campanha. */
export function withUnsubscribeFooter(html: string, token: string): string {
  const url = unsubscribeUrl(token);
  return (
    `${html}<div style="max-width:600px;margin:24px auto 0;padding:16px 0;` +
    `border-top:1px solid #e4e4e7;font-family:sans-serif;font-size:12px;` +
    `line-height:1.6;color:#71717a;text-align:center;">` +
    `Você recebeu este e-mail porque seu endereço está na base da Ectolab.<br>` +
    `<a href="${url}" style="color:#2195B9;">Clique aqui para não receber mais</a>` +
    `</div>`
  );
}

export interface SendCampaignEmailParams {
  resend: Resend;
  to: string;
  subject: string;
  html: string;
  unsubscribeToken: string;
  campaignId: number;
}

export interface SendCampaignEmailResult {
  id: string | null;
  error: string | null;
}

export async function sendCampaignEmail({
  resend,
  to,
  subject,
  html,
  unsubscribeToken,
  campaignId,
}: SendCampaignEmailParams): Promise<SendCampaignEmailResult> {
  const { data, error } = await resend.emails.send({
    from: MARKETING_FROM,
    to: [to],
    subject,
    html: withUnsubscribeFooter(html, unsubscribeToken),
    tags: [{ name: "campaign", value: String(campaignId) }],
  });

  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null, error: null };
}

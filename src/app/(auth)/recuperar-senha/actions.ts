"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export type RecuperarSenhaState = {
  message: string;
  ok: boolean;
};

const emailSchema = z.string().email("Digite um e-mail válido.");

// V-003: Rate-limit password reset — 3 per 5 minutes per IP.
const RESET_WINDOW_MS = 5 * 60_000;
const RESET_MAX = 3;

export async function resetPassword(
  prevState: RecuperarSenhaState,
  formData: FormData
): Promise<RecuperarSenhaState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, message: "Digite um e-mail válido." };
  }

  // V-003: Rate-limit.
  const rateLimit = checkRateLimit("password-reset", RESET_MAX, RESET_WINDOW_MS);
  if (!rateLimit.allowed) {
    const seconds = Math.ceil(rateLimit.retryAfterMs / 1_000);
    return {
      ok: false,
      message: `Muitas solicitações. Aguarde ${seconds} segundo(s).`,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/recovery`,
  });

  if (error) {
    console.error("resetPassword failed:", JSON.stringify(error));
    return {
      ok: false,
      message: `Erro ao enviar e-mail. Verifique se o e-mail está cadastrado.`,
    };
  }

  return {
    ok: true,
    message:
      "Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Verifique sua caixa de entrada.",
  };
}

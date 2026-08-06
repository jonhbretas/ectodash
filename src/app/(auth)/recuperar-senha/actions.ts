"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type RecuperarSenhaState = {
  message: string;
  ok: boolean;
};

const emailSchema = z.string().email("Digite um e-mail válido.");

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

"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CadastroState = {
  message: string;
  ok: boolean;
};

const cadastroSchema = z
  .object({
    email: z.string().email("Digite um e-mail válido."),
    password: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem.",
    path: ["confirmPassword"],
  });

export async function signUp(
  prevState: CadastroState,
  formData: FormData
): Promise<CadastroState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const rawConfirmPassword = formData.get("confirmPassword");

  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const confirmPassword = typeof rawConfirmPassword === "string" ? rawConfirmPassword : "";

  const parsed = cadastroSchema.safeParse({ email, password, confirmPassword });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Dados inválidos.";
    return { ok: false, message: firstError };
  }

  // Verificar se o e-mail já está cadastrado na tabela profiles
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      message: "Este e-mail já está cadastrado. Faça login ou use outro e-mail.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });

  if (error) {
    console.error("signUp failed", error);

    return {
      ok: false,
      message: "Erro ao criar conta. Tente novamente.",
    };
  }

  return {
    ok: true,
    message:
      "Conta criada! Verifique sua caixa de entrada para confirmar seu e-mail. Após a confirmação, você poderá fazer login.",
  };
}

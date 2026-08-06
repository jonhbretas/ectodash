"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  message: string;
  ok: boolean;
};

const loginSchema = z.object({
  email: z.string().email("Digite um e-mail válido."),
  password: z.string().min(1, "Digite sua senha."),
});

export async function signIn(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");

  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || "Dados inválidos.";
    return { ok: false, message: firstError };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    console.error("signIn failed", error);

    if (error.message.includes("Invalid login credentials")) {
      return {
        ok: false,
        message: "E-mail ou senha incorretos. Verifique seus dados e tente novamente.",
      };
    }

    if (error.message.includes("Email not confirmed")) {
      return {
        ok: false,
        message: "Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada.",
      };
    }

    return {
      ok: false,
      message: "Erro ao fazer login. Tente novamente.",
    };
  }

  redirect("/");
}

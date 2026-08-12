"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  isAccountLocked,
  recordLoginFailure,
  resetLoginFailures,
} from "@/lib/rate-limit";

export type LoginState = {
  message: string;
  ok: boolean;
};

const loginSchema = z.object({
  email: z.string().email("Digite um e-mail válido."),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres."),
});

// V-003: Rate-limit login attempts — 5 per minute per IP.
const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX = 5;

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

  // V-013: Check account lockout.
  const lock = isAccountLocked(parsed.data.email);
  if (lock.locked) {
    const minutes = Math.ceil(lock.retryAfterMs / 60_000);
    return {
      ok: false,
      message: `Conta temporariamente bloqueada. Tente novamente em ${minutes} minuto(s).`,
    };
  }

  // V-003: Check rate limit.
  const rateLimit = checkRateLimit("login", LOGIN_MAX, LOGIN_WINDOW_MS);
  if (!rateLimit.allowed) {
    const seconds = Math.ceil(rateLimit.retryAfterMs / 1_000);
    return {
      ok: false,
      message: `Muitas tentativas. Aguarde ${seconds} segundo(s).`,
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    console.error("signIn failed", { code: error.message?.substring(0, 20) });

    // V-013: Track failed login for lockout.
    recordLoginFailure(parsed.data.email);

    // V-015: Record failed login attempt in audit log.
    try {
      await supabase.rpc("record_login_attempt", {
        p_email: parsed.data.email,
        p_success: false,
        p_error_code: error.message?.substring(0, 50) ?? null,
      });
    } catch {
      // Audit log failure must not block login flow.
    }

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

  // V-013: Clear lockout on successful login.
  resetLoginFailures(parsed.data.email);

  // V-015: Record successful login in audit log.
  try {
    await supabase.rpc("record_login_attempt", {
      p_email: parsed.data.email,
      p_success: true,
    });
  } catch {
    // Audit log failure must not block login flow.
  }

  redirect("/");
}

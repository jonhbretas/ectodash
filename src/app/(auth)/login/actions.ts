"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  message: string;
  ok: boolean;
};

const emailSchema = z.string().email();

// Identical on every outcome (existing address, non-existing address, or a
// Supabase-side error) so the login form cannot be used to enumerate
// institutional e-mail addresses (RESEARCH.md Security Domain, Information
// Disclosure row; github.com/supabase/auth/issues/1547).
const GENERIC_SUCCESS_MESSAGE =
  "Se este e-mail estiver cadastrado, você receberá um link de acesso. Confira sua caixa de entrada.";

export async function requestMagicLink(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, message: "Digite um e-mail válido." };
  }

  // The redirect target is built only from this server-controlled env var —
  // never from formData, search params, or headers. This closes the
  // open-redirect path (RESEARCH.md Security Domain, Tampering row).
  const emailRedirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      // Per D-02, this is the single most important line in the phase:
      // it prevents signInWithOtp from silently creating a new account for
      // any never-invited address.
      shouldCreateUser: false,
      emailRedirectTo,
    },
  });

  if (error) {
    console.error("requestMagicLink: signInWithOtp failed", error);
  }

  // Same success-shaped state on every outcome — never branch the
  // user-visible copy, the HTTP status, or the control flow on whether the
  // address exists.
  return { ok: true, message: GENERIC_SUCCESS_MESSAGE };
}

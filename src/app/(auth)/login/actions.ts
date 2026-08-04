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
  "Você receberá um link de acesso no e-mail. Na primeira vez, você escolherá seu nome na lista de voluntários.";

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
      // Self-signup (user decision, 2026-08-04): volunteers register by the
      // magic link and then link their account to their name in the
      // institutional roster at /vincular (migration 0017). A first-time
      // address therefore CREATES the account — shouldCreateUser: true
      // replaces D-02's invite-only mode. New accounts start with
      // vincular_pendente = true (handle_new_user trigger) and the
      // dashboard layout redirects them to /vincular until they link.
      shouldCreateUser: true,
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

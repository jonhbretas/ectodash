// src/lib/supabase/admin.ts
// Service-role Supabase client factory — bypasses RLS entirely by design.
//
// V-006 guardrail: createAdminClient() is restricted, by convention AND by
// runtime path validation, to these documented callers:
//   • src/app/api/cron/*           (reminders, sync-sheets, sync-woocommerce)
//   • src/app/api/contratos/webhook (Assinafy callback — no user session)
//   • src/app/api/wp/sync           (manual WooCommerce sync — role-gated)
//   • src/app/api/wp/debug/orders   (debug endpoint — production-gated)
//   • src/app/api/proep/import-from-store (PROEP import — role-gated)
//   • src/app/(auth)/cadastro/actions.ts (signUp — duplicate-email precheck)
//
// If you need to add a new caller, update the ALLOWED_PREFIXES list below
// and this comment.
import { createClient } from "@supabase/supabase-js";

const ALLOWED_PREFIXES = [
  "/api/cron/",
  "/api/contratos/webhook",
  "/api/wp/sync",
  "/api/wp/debug/",
  "/api/proep/import-from-store",
  "(auth)/cadastro/actions.ts",
];

function assertAllowedCaller() {
  // In Next.js App Router, the caller's file path is not directly available
  // at runtime. We use Error stack inspection as a best-effort guardrail:
  // if the stack does NOT contain one of the allowed prefixes, log a warning.
  // This is NOT a security boundary (stack can be spoofed) — RLS and role
  // gates are the real enforcement. This exists to catch accidental misuse
  // during development.
  const stack = new Error().stack ?? "";
  const hasAllowedCaller = ALLOWED_PREFIXES.some((prefix) =>
    stack.includes(prefix)
  );
  if (!hasAllowedCaller && !stack.includes("scripts/")) {
    console.warn(
      "[admin.ts] createAdminClient() called from unexpected path. " +
        "Allowed: " +
        ALLOWED_PREFIXES.join(", ")
    );
  }
}

export function createAdminClient() {
  assertAllowedCaller();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

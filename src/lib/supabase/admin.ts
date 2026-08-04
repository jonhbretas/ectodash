// src/lib/supabase/admin.ts
// Service-role Supabase client factory — bypasses RLS entirely by design.
// This file (and the one place that already did this inline,
// scripts/seed-coordinator.ts) is the ONLY place in the application that
// reads SUPABASE_SERVICE_ROLE_KEY. This export must NEVER be imported from
// anything under src/app/(dashboard)/ or src/app/(auth)/ — it is restricted,
// by convention and by this plan's own negative-grep acceptance criteria, to
// src/app/api/cron/ only, the one trusted, non-user-triggered entry point
// this project has (07-RESEARCH.md Anti-Patterns, Security Domain V4).
//
// No cookies, no session handling — there is no end-user session in a cron
// context, unlike src/lib/supabase/server.ts (anon-key, session-bound).
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Faltam variáveis de ambiente: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

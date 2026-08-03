---
phase: 01-project-scaffold-institutional-login
plan: 02
subsystem: database
tags: [supabase, postgres, rls, trigger, vitest, integration-test]

requires:
  - phase: 01-01
    provides: Next.js scaffold, Supabase client factories (browser/server/middleware), .env.local.example env-var contract, Vitest harness

provides:
  - "Versioned migration supabase/migrations/0001_profiles.sql: public.profiles table + RLS select policy + handle_new_user() SECURITY DEFINER trigger function + on_auth_user_created trigger"
  - "Live schema pushed to the hosted Supabase project (npx supabase@latest link + db push), confirmed applied local+remote via migration list --linked"
  - "Automated integration proof (tests/db/profiles-trigger.test.ts) that account creation writes a profile, RLS blocks anonymous reads, and account deletion cascades"
  - "CLI contract for later phases: npx supabase@latest link/db push/migration list --linked (global CLI not on PATH, Docker unavailable — hosted-only workflow)"

affects: [phase-02-roles-rls, phase-04-demandas, phase-06-volunteer-dashboard]

tech-stack:
  added: ["supabase CLI (via npx supabase@latest, no global install)"]
  patterns:
    - "Identity projection via Postgres trigger (SECURITY DEFINER, pinned search_path) — never application code — so every Auth entry point (magic link, invite) converges on the same guaranteed public.profiles write"
    - "RLS as the sole authorization boundary for public.profiles; no reliance on client-side hiding"
    - "Integration tests against the live hosted project (no local Docker/Inbucket available), using disposable @example.invalid addresses and Admin API createUser/deleteUser to avoid burning email quota and avoid leaving orphaned accounts"

key-files:
  created:
    - supabase/config.toml
    - supabase/migrations/0001_profiles.sql
    - tests/db/profiles-trigger.test.ts
  modified:
    - .gitignore
    - vitest.config.ts

key-decisions:
  - "Kept public.profiles to id/email/created_at only — role/área/permission columns deliberately deferred to Phase 2's migration so it extends rather than rewrites this table"
  - "Every Supabase CLI invocation goes through npx supabase@latest — global CLI not on PATH, Docker unavailable, so all schema work targets the hosted project directly (no local Postgres)"
  - "SUPABASE_ACCESS_TOKEN in .env.local is the CLI's management-API auth for `link`/`db push` — no `supabase login` step needed once the personal access token is present"

patterns-established:
  - "Pattern: any new managed-auth-adjacent table gets a SECURITY DEFINER trigger off auth.users, never an application-code write path"
  - "Pattern: live-database integration tests skip visibly (describe.skipIf) rather than fail when SUPABASE_SERVICE_ROLE_KEY is absent, keeping CI green without secrets"

requirements-completed: [AUTH-01]

coverage:
  - id: D1
    description: "public.profiles table (id/email/created_at) with RLS enabled, live in the hosted project"
    requirement: "AUTH-01"
    verification:
      - kind: other
        ref: "npx supabase@latest migration list --linked (0001 shown local+remote)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Account creation automatically writes exactly one matching public.profiles row via the on_auth_user_created trigger"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "tests/db/profiles-trigger.test.ts#writes exactly one public.profiles row when an account is created"
        status: pass
    human_judgment: false
  - id: D3
    description: "RLS denies anonymous (no-session, anon-key) reads of public.profiles"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "tests/db/profiles-trigger.test.ts#denies anonymous reads of public.profiles via RLS"
        status: pass
    human_judgment: false
  - id: D4
    description: "Deleting an account cascades and removes its public.profiles row"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "tests/db/profiles-trigger.test.ts#cascades: deleting the account removes the public.profiles row"
        status: pass
    human_judgment: false

duration: 20min (active; excludes the checkpoint pause while the human generated a Supabase personal access token)
completed: 2026-08-03
status: complete
---

# Phase 1 Plan 02: Profiles Table, RLS, and Identity Trigger Summary

**Versioned Postgres migration (public.profiles + RLS + SECURITY DEFINER trigger) pushed live to the hosted Supabase project, proven end-to-end by an integration test against the real database using the Admin API.**

## Performance

- **Duration:** ~20 min active work across two sessions (session 1: Task 1; checkpoint pause for CLI access token; session 2: Tasks 2-3)
- **Completed:** 2026-08-03
- **Tasks:** 3/3
- **Files modified:** 5 (2 created in Task 1, 1 created + 2 modified in Task 3; Task 2 modified none)

## Accomplishments
- Authored `supabase/migrations/0001_profiles.sql`: `public.profiles` table, RLS enabled with an `auth.uid() = id` select policy, and a `SECURITY DEFINER` / pinned-`search_path` trigger function + trigger that inserts a profile row on every `auth.users` insert
- Linked the repo to the hosted Supabase project and pushed the migration (`npx supabase@latest link` / `db push`); `migration list --linked` confirms `0001` applied both locally and remotely, and a second `db push` reports "up to date" (idempotent)
- Wrote `tests/db/profiles-trigger.test.ts`: a live integration suite proving (1) account creation writes exactly one matching `profiles` row, (2) an anon-key/no-session client reads zero rows, (3) account deletion cascades and removes the profile row — all against the real hosted project, cleaned up automatically, skipping visibly (not failing) when `SUPABASE_SERVICE_ROLE_KEY` is absent

## Task Commits

Each task was committed atomically:

1. **Task 1: Versioned profiles migration with RLS and identity trigger** - `febae8b` (feat)
2. **Task 2: [BLOCKING] Link the hosted project and push the schema** - no commit; verified entirely through live CLI state (`link`, `db push`, `migration list --linked`) since no tracked file changed (`supabase/config.toml` was already correct from Task 1's `init`)
3. **Task 3: Integration proof — account creation writes a profile, RLS blocks cross-user reads** - `8cc3c42` (feat)

**Plan metadata:** commit follows this summary.

## Files Created/Modified
- `supabase/migrations/0001_profiles.sql` - `public.profiles` table, RLS policy, `handle_new_user()` trigger function, `on_auth_user_created` trigger
- `supabase/config.toml` - Supabase CLI project config from `supabase init`
- `.gitignore` - ignores `supabase/.temp` and `supabase/.branches`
- `tests/db/profiles-trigger.test.ts` - live integration proof (create/RLS/cascade) against the hosted project
- `vitest.config.ts` - `test.testTimeout` raised to 30000ms for the network-crossing assertions

## Decisions Made
- Table intentionally limited to `id`/`email`/`created_at` — no role/área/permission columns, per plan prohibition; Phase 2 extends this table rather than replacing it
- All CLI operations run via `npx supabase@latest` (no global install, no Docker) against the hosted project directly
- Test suite loads `.env.local` via `process.loadEnvFile` guarded in a `try/catch`, matching the plan's stated acceptable pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired a corrupted `.env.local` line that left `NEXT_PUBLIC_SUPABASE_URL` unset**
- **Found during:** Task 3, while preparing to write/run the integration test (the anon and admin clients both need `NEXT_PUBLIC_SUPABASE_URL`)
- **Issue:** `.env.local` contained a leftover literal `placeholder` token concatenated directly onto the front of the `NEXT_PUBLIC_SUPABASE_URL=` assignment with no separating newline. Sourcing the file therefore produced an *empty* `NEXT_PUBLIC_SUPABASE_URL` and a spurious variable literally named `placeholderNEXT_PUBLIC_SUPABASE_URL` holding the real URL instead — a leftover from an earlier manual edit that replaced a placeholder value without a clean line break.
- **Fix:** Used `sed -i` to insert the missing newline immediately before `NEXT_PUBLIC_SUPABASE_URL=`, splitting it back into its own line. Diagnosed and verified using only variable-presence/length checks (`${#VAR}`, `[ -n "$VAR" ]`) — the secret value itself was never read, printed, or logged at any point, per the task's explicit constraint.
- **Files modified:** `.env.local` (git-ignored — local developer environment state only, not a repo artifact, so no commit applies)
- **Verification:** Re-sourced the file and confirmed `NEXT_PUBLIC_SUPABASE_URL` is non-empty; the Task 3 integration tests subsequently created a client with it and passed, twice in a row.
- **Committed in:** N/A — `.env.local` is intentionally git-ignored.

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3)
**Impact on plan:** Necessary to unblock Task 3; no scope creep — fix was confined to a formatting defect in local, uncommitted environment config, not application code.

## Issues Encountered
- The checkpoint blocker from the prior session (`SUPABASE_ACCESS_TOKEN` missing, `LegacyPlatformAuthRequiredError` on `supabase link`) was resolved by the human adding a personal access token to `.env.local`; presence was confirmed via a length-only check before retrying `link`, which then succeeded on the first attempt.
- `supabase db push` printed a benign warning ("failed to cache migrations catalog... Docker Desktop is a prerequisite") — expected per RESEARCH.md (Docker is unavailable in this environment) and does not affect the push result.

## User Setup Required
None further. The `user_setup` env vars specified in the plan (`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`) plus the checkpoint-added `SUPABASE_ACCESS_TOKEN` were already present and sufficient; the Dashboard "project ACTIVE" precondition also held.

## Next Phase Readiness
- `public.profiles` + RLS + trigger are live in the hosted project and reproducible from `supabase/migrations/` alone (`db push` is idempotent)
- Plan 01-03's tracer slice now has a real database read/write path to prove end-to-end
- Phase 2's role model can extend `public.profiles` (or add a joined table) without needing to touch this migration's existing columns

---
*Phase: 01-project-scaffold-institutional-login*
*Completed: 2026-08-03*

## Self-Check: PASSED

All created files verified present on disk (`supabase/config.toml`, `supabase/migrations/0001_profiles.sql`, `tests/db/profiles-trigger.test.ts`, `vitest.config.ts`, this summary) and both task commit hashes (`febae8b`, `8cc3c42`) verified present in `git log --all`.

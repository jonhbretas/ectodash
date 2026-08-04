---
phase: 04-demandas-crud-overdue-tracking
plan: 01
subsystem: database
tags: [postgres, supabase, rls, rbac, enum, view, security-invoker, vitest]

# Dependency graph
requires:
  - phase: 02-role-based-access-control
    provides: "public.profiles.role, has_role() SECURITY DEFINER helper, the SELECT-gates-UPDATE lesson and live-integration test pattern this plan reproduces"
provides:
  - "public.demanda_status enum (pendente, em_andamento, concluida)"
  - "public.demandas table (titulo, descricao, area, criado_por, prazo, status, created_at, updated_at) — no responsavel_id column"
  - "public.demanda_responsaveis many-to-many link table (demanda_id, profile_id composite PK)"
  - "public.demandas_com_status view — security_invoker = true, derives atrasada fresh at read time against current_date"
  - "Permissive-but-authenticated RLS on both new tables (SELECT using(true); INSERT with anti-spoofed criado_por check; UPDATE/DELETE using(true)) — deliberately not yet role-scoped"
  - "Live-hosted-project proof via tests/db/demandas-rls.test.ts (9 passing cases)"
affects: [phase 4 remaining plans (Server Actions, forms, list/detail UI), phase 5 (role-scoped visibility must re-verify SELECT/UPDATE/DELETE pairing when narrowing), phase 6 (coordinator dashboard reads demandas_com_status), phase 7 (reminder job reads demandas_com_status)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Many-to-many responsavel via a link table with composite PK (demanda_id, profile_id) — never a single responsavel_id FK on the parent table"
    - "Overdue/atrasada derived at read time via a security_invoker view — never a generated/stored column (Postgres rejects STABLE expressions like current_date in GENERATED ALWAYS AS ... STORED)"
    - "DEFAULT expressions cannot contain a subquery — auth.uid() as a column DEFAULT must be a bare function call (default auth.uid()), not (select auth.uid()); the (select ...) wrapping is for RLS policy USING/WITH CHECK clauses only, not DEFAULT"
    - "SELECT-gates-UPDATE/DELETE: every write policy ships in the same migration as a SELECT policy that actually grants visibility of its target rows, re-verified explicitly rather than assumed (Phase 2 lesson, reproduced proactively here)"
    - "Live RLS test observation contract: always assert outcomes via a service-role re-read, never trust the acting client's own response shape"

key-files:
  created:
    - supabase/migrations/0003_demandas.sql
    - tests/db/demandas-rls.test.ts
  modified: []

key-decisions:
  - "Fixed a plan-specified DEFAULT expression that Postgres rejects: (select auth.uid()) is a subquery and cannot appear in a column DEFAULT (SQLSTATE 0A000, 'cannot use subquery in DEFAULT expression'); changed to the bare function call auth.uid(). The INSERT policy's WITH CHECK (criado_por = (select auth.uid())) is unaffected — the (select ...) wrapping there is the correct, separate RLS-performance pattern, only invalid inside DEFAULT."

patterns-established:
  - "Every future demanda-adjacent write policy follows the same SELECT-gates-write verification discipline this migration re-applied from Phase 2"
  - "demandas_com_status, not demandas, is the correct read source whenever atrasada is needed"

requirements-completed: [DEM-01, DEM-02, DEM-03]

coverage:
  - id: D1
    description: "public.demanda_status enum holds exactly pendente/em_andamento/concluida; public.demandas has no responsavel_id column; public.demanda_responsaveis is a many-to-many link table with composite PK"
    requirement: "DEM-01"
    verification:
      - kind: integration
        ref: "grep acceptance criteria against supabase/migrations/0003_demandas.sql (enum values, no responsavel_id, no cancelada, no areas table, composite PK) — all criteria passed"
        status: pass
      - kind: integration
        ref: "npx supabase@latest migration list --linked (0003 applied locally and remotely)"
        status: pass
  - id: D2
    description: "A demanda can have multiple responsaveis; criado_por cannot be spoofed to another user's id"
    requirement: "DEM-01"
    verification:
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts > DEM-01: a demanda can have multiple responsáveis (many-to-many, not a single FK)"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts > DEM-01: criado_por cannot be spoofed to another user's id (anti-spoofing)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Any authenticated user can edit/conclude any demanda this phase (SELECT-gates-UPDATE re-verified); responsavel swap via delete-then-insert is reachable"
    requirement: "DEM-02"
    verification:
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts > DEM-02: a different authenticated user can edit an existing demanda's fields"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts > DEM-02: a different authenticated user can conclude a demanda, and updated_at advances"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts > DEM-02: responsável swap via delete-then-insert on demanda_responsaveis"
        status: pass
    human_judgment: false
  - id: D4
    description: "atrasada is derived fresh at read time: true only for past-prazo non-concluded demandas, false for past-prazo concluded demandas and future-prazo demandas; demandas_com_status view respects RLS via security_invoker"
    requirement: "DEM-03"
    verification:
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts > DEM-03: a past-prazo, non-concluded demanda is atrasada = true"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts > DEM-03: a past-prazo demanda that IS concluded is atrasada = false"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts > DEM-03: a future-prazo demanda is atrasada = false"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts > demandas_com_status view respects RLS (security_invoker)"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-04
status: complete
---

# Phase 4 Plan 1: Demandas Data Foundation Summary

**Postgres schema for demandas with a many-to-many demanda_responsaveis link table, permissive-but-authenticated RLS reproducing Phase 2's SELECT-gates-UPDATE fix proactively, and a security_invoker view that derives "atrasada" fresh on every read against current_date — never a stored or cron-flipped column.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-04T00:41:43Z (approx., per STATE.md handoff)
- **Completed:** 2026-08-04T01:17:00Z (approx.)
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `public.demanda_status` enum with exactly the 3 locked values (`pendente`, `em_andamento`, `concluida`) — no `cancelada`.
- `public.demandas` table with no `responsavel_id` column — the multi-responsável relationship is expressed only through the link table below, per the user's locked decision overriding `04-RESEARCH.md`'s single-FK assumption.
- `public.demanda_responsaveis` many-to-many link table (`demanda_id`, `profile_id`, composite PK) plus its reverse-lookup index, proven live to support multiple responsáveis per demanda and a swap via delete-then-insert.
- Permissive-but-authenticated RLS on both tables (SELECT `using(true)`; INSERT with an anti-spoofed `criado_por` check; UPDATE/DELETE `using(true)`) — the SELECT-gates-UPDATE/DELETE lesson from Phase 2 was re-verified explicitly and shipped in the same migration, not as a follow-up fix.
- `public.demandas_com_status` view (`security_invoker = true`) deriving `atrasada` fresh at read time — proven live for all three prazo/status combinations plus the RLS-passthrough sanity check.
- `tests/db/demandas-rls.test.ts` — 9 live integration test cases against the hosted Supabase project, all passing, run twice consecutively.

## Task Commits

Each task was committed atomically:

1. **Task 1: demandas schema, multi-responsável link table, RLS, and the read-time overdue view** - `1ad5b79` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified

- `supabase/migrations/0003_demandas.sql` - `demanda_status` enum, `demandas` table, `demanda_responsaveis` link table, indexes, RLS policies (SELECT/INSERT/UPDATE on `demandas`; SELECT/INSERT/DELETE on `demanda_responsaveis`), `set_updated_at` trigger, `demandas_com_status` view.
- `tests/db/demandas-rls.test.ts` - Live Vitest integration suite: 9 cases covering multi-responsável create, anti-spoofed `criado_por`, cross-user edit/conclude, responsável swap, atrasada derivation in all three prazo/status combinations, and view-respects-RLS.

## Decisions Made

- **Fixed a plan-specified DEFAULT expression Postgres rejects (Rule 1 - Bug):** The plan's Task 1 action specified `criado_por uuid not null references public.profiles(id) default (select auth.uid())`. Pushing this migration failed immediately with `ERROR: cannot use subquery in DEFAULT expression (SQLSTATE 0A000)` — Postgres does not permit a subquery (even a scalar one wrapped in parentheses) inside a column `DEFAULT`. Changed to the bare function call `default auth.uid()` (no `select` wrapper), which is valid. This is distinct from the `(select auth.uid())` pattern used inside the INSERT policy's `WITH CHECK` clause — that wrapping is the correct, separate RLS-performance idiom (caches the result once per statement) and only applies inside `USING`/`WITH CHECK`, never inside `DEFAULT`. No other part of the migration or its RLS contract was affected; the anti-spoofing test case still proves the INSERT policy's `WITH CHECK` independently rejects/corrects a spoofed `criado_por`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `default (select auth.uid())` is invalid Postgres syntax — fixed to `default auth.uid()`**
- **Found during:** Task 1, first `npx supabase@latest db push` attempt
- **Issue:** The plan's literal migration text used `(select auth.uid())` as a column DEFAULT. Postgres rejects any subquery in a DEFAULT expression outright (`generation expression`/`DEFAULT expression` must be side-effect-free scalar expressions, not subqueries) — this is a hard syntax constraint, not a style preference, and the push failed at `CREATE TABLE` time with `SQLSTATE 0A000`.
- **Fix:** Changed `default (select auth.uid())` to `default auth.uid()` in `supabase/migrations/0003_demandas.sql`. `auth.uid()` is itself a plain (non-subquery) function call, so the bare form is valid as a DEFAULT.
- **Files modified:** `supabase/migrations/0003_demandas.sql`
- **Verification:** `npx supabase@latest db push` succeeded on retry; `npx supabase@latest migration list --linked` shows `0003` applied both locally and remotely; the anti-spoofing test case (`DEM-01: criado_por cannot be spoofed`) passes, confirming the INSERT policy's `WITH CHECK` still independently enforces the invariant regardless of the DEFAULT's exact form.
- **Committed in:** `1ad5b79` (Task 1 commit — the fix landed before the task was ever committed, so there is no separate fix commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug).
**Impact on plan:** The fix was required for the migration to apply at all — without it, `db push` fails outright and nothing in this plan is verifiable. No scope creep: the change is a one-token syntax correction with identical runtime behavior (the column default is still forced to the authenticated user's own id), and the plan's own anti-spoofing test case proves the security invariant holds independent of which DEFAULT form is used.

## Issues Encountered

- **Transient Supabase Auth sign-in rate-limit collisions during verification (not a defect, not committed as a fix):** While repeatedly re-running `npx vitest run tests/db/demandas-rls.test.ts` and `npm test` back-to-back during verification (to confirm the "run twice" acceptance criterion and the full-suite green criterion), the hosted project's Auth sign-in rate limit (`sign_in_sign_ups`, a short 5-minute-window limit per IP) was exhausted by the cumulative fixture sign-ins across multiple consecutive runs of both `demandas-rls.test.ts` and the pre-existing `role-rls.test.ts`. This surfaced as `Request rate limit reached` errors in several test cases across two consecutive `npm test` invocations. This is a pre-existing environmental characteristic of the free-tier project (not something this plan's schema/RLS caused), and each suite passed cleanly in isolation both before and after the rate-limit window naturally reset (~5 minutes). After waiting for the window to clear, `npm test` ran fully green: 40 passed, 2 skipped (visible skip for optional `COORDINATOR_EMAIL`), 0 failed, across all 7 test files. No code change was made in response to this — it is a test-execution-cadence artifact of verifying live-integration suites repeatedly in a short window, not a bug in the migration, RLS policies, or test logic.
- Docker/local Postgres unavailable in this environment (consistent with Phase 1/2's findings) — `supabase db advisors` could not run in linked mode without a local Postgres connection; skipped, matching Phase 2's precedent (advisors is not one of this plan's acceptance criteria).

## User Setup Required

None - the project remained linked from Phase 2 (`supabase/.temp/project-ref` present, project ACTIVE per Dashboard status), and `.env.local` already held valid credentials, so the `user_setup` re-link/password-reset path in the plan's frontmatter was never triggered.

## Next Phase Readiness

- The demandas data layer is live on the hosted project and fully proven: a demanda can have multiple responsáveis, any authenticated user can create/edit/conclude any demanda (Phase 5 narrows this), and `atrasada` is correctly and automatically true only for past-prazo, non-concluded demandas.
- **Contract for later plans in this phase:** any Server Action creating a demanda must separately insert into `demanda_responsaveis` (no single-column shortcut); any Server Action editing responsáveis does so via delete-then-insert (no UPDATE policy exists on that table); `demandas_com_status`, not `demandas`, is the correct read source whenever `atrasada` is needed.
- **Known constraint for Phase 5 (per plan's own note, reproduced from Phase 2):** this phase's SELECT/UPDATE/DELETE policies are all `using(true)` — Phase 5 must re-verify SELECT still grants visibility to every actor who needs UPDATE/DELETE when it narrows scope with `has_role()`.
- No blockers for the remaining Phase 4 plans (Server Actions, forms, list/detail UI).

---
*Phase: 04-demandas-crud-overdue-tracking*
*Completed: 2026-08-04*

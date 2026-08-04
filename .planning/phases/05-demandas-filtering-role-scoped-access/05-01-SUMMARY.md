---
phase: 05-demandas-filtering-role-scoped-access
plan: 01
subsystem: database
tags: [postgres, rls, supabase, row-level-security, migrations, vitest]

# Dependency graph
requires:
  - phase: 04-demandas-crud-overdue-tracking
    provides: "demandas/demanda_responsaveis schema, demandas_com_status view (security_invoker=true), Phase 4's permissive using(true) RLS this plan narrows"
  - phase: 02-role-based-access-control
    provides: "app_role enum, has_role() SECURITY DEFINER helper pattern, the SELECT-gates-UPDATE lesson this plan re-verifies under a new join-table topology"
provides:
  - "public.lider_areas many-to-many join table (a líder can lead multiple áreas simultaneously)"
  - "is_lider_of_area(text) and is_responsavel_for(bigint) SECURITY DEFINER helpers"
  - "Role/ownership-scoped SELECT+UPDATE RLS on demandas (textually identical predicates)"
  - "Independently-scoped SELECT+manage RLS on demanda_responsaveis"
  - "Coordenador-only write RLS on lider_areas (self-escalation guard)"
  - "docs/areas.md — coordenador-only área-assignment runbook"
affects: [05-02-filtering-ui, 06-coordinator-dashboard, 07-reminders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Textually identical SELECT/UPDATE predicate copy-pasted (not abstracted) into both demandas policies, guaranteeing they can never silently diverge"
    - "Join-table RLS is independently restated, never inherited from the parent table (demanda_responsaveis mirrors demandas' visibility rule via its own exists() subquery)"
    - "Many-to-many área-to-líder modeling via composite primary key (lider_id, area) rather than a single nullable column, supporting one líder leading multiple áreas"
    - "vitest fileParallelism: false for live-integration DB test suites to avoid bursting past Supabase Auth's free-tier sign-in rate limit"

key-files:
  created:
    - supabase/migrations/0004_demandas_role_scope.sql
    - docs/areas.md
  modified:
    - tests/db/demandas-rls.test.ts
    - vitest.config.ts

key-decisions:
  - "lider_areas is a many-to-many join table (lider_id, area composite PK), not a single profiles.area_liderada column — locked user decision overriding 05-RESEARCH.md's own [ASSUMED] single-column recommendation, because a líder can lead more than one área simultaneously"
  - "SELECT and UPDATE/WITH CHECK predicates on demandas are byte-identical, copy-pasted rather than abstracted into a shared function reference, as the simplest possible guarantee against the SELECT-gates-UPDATE trap reappearing"
  - "demanda_responsaveis gets its own independently-restated visibility/manage policies rather than relying on any inherited grant from demandas, since RLS never cascades from a parent table to a join table"
  - "Disabled vitest fileParallelism globally — the live-integration DB test suites (demandas-rls.test.ts + role-rls.test.ts combined) mint enough fixture sign-ins to exceed Supabase Auth's free-tier 30-sign-ins-per-5-minutes limit when run in parallel; this is a scheduling fix, not a test-logic change"
  - "Rewrote a second pre-existing DEM-02 test (the 'conclude a demanda, updated_at advances' trigger test) beyond the one test the plan explicitly named, since it had the identical broken premise (unrelated editor) that this migration invalidates — applied as a Rule 1 auto-fix to avoid leaving a second stale, now-false assertion in the suite"

requirements-completed: [DEM-05]

coverage:
  - id: D1
    description: "public.lider_areas many-to-many join table exists live on the hosted project, with coordenador-only write RLS and líder-can-view-own-rows RLS"
    requirement: "DEM-05"
    verification:
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts#DEM-05: a lider_area cannot self-assign a new área (self-escalation guard), but can view their own existing lider_areas rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "demandas SELECT/UPDATE narrowed to role/ownership scope (coordenador sees/edits all; líder sees/edits their área(s); voluntário sees/edits own criado_por/responsável demandas) with SELECT and UPDATE predicates textually identical"
    requirement: "DEM-05"
    verification:
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts#DEM-05: coordenador_geral can SELECT and UPDATE a demanda created by an unrelated fixture (regression check)"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts#DEM-05: lider_area with one área can SELECT/UPDATE a case/whitespace-mismatched demanda in that área, and is denied on an unrelated área"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts#DEM-05: lider_area assigned to TWO áreas simultaneously can SELECT/UPDATE demandas in either área, and is denied on a third"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts#DEM-05: voluntario_comum can SELECT and UPDATE a demanda they created (criado_por path), with no responsável assigned"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts#DEM-05: voluntario_comum linked as responsável can SELECT/UPDATE that demanda, while an unrelated third voluntário is denied both"
        status: pass
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts#DEM-05: an unrelated authenticated user can no longer edit a demanda they have no relationship to (regression of Phase 4's permissive behavior)"
        status: pass
    human_judgment: false
  - id: D3
    description: "demanda_responsaveis independently scoped — a direct, non-joined query respects the same visibility boundary as demandas"
    requirement: "DEM-05"
    verification:
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts#DEM-05: demanda_responsaveis is independently scoped — a direct, non-joined query returns zero rows for a demanda the caller cannot see via demandas"
        status: pass
    human_judgment: false
  - id: D4
    description: "demandas_com_status view (security_invoker=true, unchanged) still reflects the narrowed policy, proven via live parity test"
    requirement: "DEM-05"
    verification:
      - kind: integration
        ref: "tests/db/demandas-rls.test.ts#DEM-05: demandas_com_status view returns exactly the same demanda ids as a direct demandas query, for a lider_area fixture"
        status: pass
    human_judgment: false
  - id: D5
    description: "docs/areas.md documents the coordenador-only, multi-área-capable lider_areas assignment procedure"
    verification:
      - kind: other
        ref: "grep -qi 'pode liderar mais de uma área|mais de uma área ao mesmo tempo|múltiplas áreas' docs/areas.md; grep -qi 'coordenador_geral' docs/areas.md"
        status: pass
    human_judgment: false

duration: 62min
completed: 2026-08-04
status: complete
---

# Phase 5 Plan 1: lider_areas Join Table & Role-Scoped RLS Narrowing Summary

**Migration 0004 closes the área-to-líder data-model gap with a many-to-many `lider_areas` join table and narrows `demandas`/`demanda_responsaveis` RLS from Phase 4's permissive baseline to DEM-05's role/ownership scoping, proven live against the real hosted project with a service-role-re-read matrix covering every allowed and denied path, including a líder assigned to two simultaneous áreas.**

## Performance

- **Duration:** ~62 min
- **Started:** 2026-08-04T11:41:00Z (approx, precondition check)
- **Completed:** 2026-08-04T12:43:19Z
- **Tasks:** 1 (tracer)
- **Files modified:** 4 (1 created migration, 1 created doc, 1 extended test, 1 config fix)

## Accomplishments

- `public.lider_areas` many-to-many join table live on the hosted Supabase project — a líder can now hold multiple simultaneous área assignments (composite primary key `(lider_id, area)`), directly implementing the user's locked decision that overrides 05-RESEARCH.md's own `[ASSUMED]` single-column recommendation.
- `demandas`' and `demanda_responsaveis`' Phase-4 permissive `using(true)` RLS policies dropped and replaced with role/ownership-scoped policies in the same migration — coordenador sees/edits everything, líder de área sees/edits their assigned área(s) case/whitespace-insensitively, voluntário comum sees/edits only demandas they created or are responsável for.
- SELECT and UPDATE/WITH CHECK predicates on `demandas` are byte-identical (copy-pasted, not abstracted) — the direct, permanent fix for Phase 2's SELECT-gates-UPDATE lesson, now re-verified under a live-integration test for every role in both the allowed and denied direction.
- `demanda_responsaveis` given its own independently-restated visibility/manage policies (RLS does not cascade from `demandas` to the join table) — proven with a dedicated test showing a direct, non-joined query against `demanda_responsaveis` returns zero rows for a demanda the caller can't see via `demandas`.
- `demandas_com_status` (unchanged, `security_invoker=true` from Phase 4) confirmed live to still reflect the narrowed policy — a parity test asserts the view and the base table return the exact same demanda id set for a líder-of-one-área fixture.
- `lider_areas` self-escalation guard: a líder can view their own assignment rows but cannot write to `lider_areas` at all — only `coordenador_geral` can insert/update/delete, closing the same privilege-escalation shape `docs/roles.md` already documents for `profiles.role`.
- `docs/areas.md` documents the coordenador-only, multi-área-capable assignment procedure, mirroring `docs/roles.md`'s structure and tone.

## Task Commits

1. **Task 1 (migration + apply):** `ffbefe8` - feat(05-01): add lider_areas join table and narrow demandas/demanda_responsaveis RLS
2. **Task 1 (tests + docs + config fix):** `52e613f` - test(05-01): role-scoping re-verification matrix for demandas RLS narrowing

**Plan metadata:** (this commit, pending)

## Files Created/Modified

- `supabase/migrations/0004_demandas_role_scope.sql` - lider_areas table, is_lider_of_area()/is_responsavel_for() helpers, narrowed demandas/demanda_responsaveis RLS, lider_areas RLS
- `docs/areas.md` - coordenador-only, multi-área-capable área-assignment runbook
- `tests/db/demandas-rls.test.ts` - extended with the full DEM-05 role-scoping matrix (10 new test cases); rewrote two pre-existing Phase-4-era tests whose "any authenticated user can edit any demanda" premise this migration invalidates
- `vitest.config.ts` - added `fileParallelism: false` to prevent the live-integration DB suites from bursting past Supabase Auth's free-tier sign-in rate limit when run together

## Decisions Made

- **Multi-área join table over single column:** Built `public.lider_areas` (composite PK `lider_id, area`) instead of 05-RESEARCH.md's `[ASSUMED]` `profiles.area_liderada` text column, per the user's explicit, locked instruction that a líder can lead multiple áreas simultaneously. This plan's tests include a dedicated case proving a líder with two `lider_areas` rows can see/edit demandas in both áreas and is denied on a third — the concrete proof-point for the capability, not just schema acceptance of multiple rows.
- **No CHECK constraint coupling `lider_areas.lider_id` to `profiles.role = 'lider_area'`:** Matches 05-RESEARCH.md Pattern 1's reasoning applied to the join-table shape — a coordenador demoting/promoting a role and assigning an área are separate steps that shouldn't be forced atomic. The role check lives inside `is_lider_of_area()` instead, so a demoted líder's stale `lider_areas` rows can't grant access back.
- **Textually identical SELECT/UPDATE predicates on `demandas`, copy-pasted not abstracted:** Followed 05-RESEARCH.md's explicit "Key insight" — Postgres RLS makes SELECT/UPDATE predicate divergence invisible at write time (a denied write returns `error: null`, zero rows changed), so the simplest possible guarantee against this class of bug is literal duplication, not a shared reference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrote a second pre-existing DEM-02 test with the same invalidated premise**
- **Found during:** Task 1, running `npx vitest run tests/db/demandas-rls.test.ts` after the migration was applied
- **Issue:** The plan explicitly named one pre-existing test to rewrite ("a different authenticated user can edit an existing demanda's fields"), but a second pre-existing test — "DEM-02: a different authenticated user can conclude a demanda, and updated_at advances (trigger proof)" — had the identical broken premise (an unrelated "editor" fixture, relying on Phase 4's now-dropped permissive UPDATE policy). It failed on the first live test run after the migration (`expected 'pendente' to be 'concluida'`), confirming the narrowed RLS was correctly denying the unrelated editor's write.
- **Fix:** Rewrote the test so the editor is a `responsável` (an in-scope role under the new policy) instead of an arbitrary unrelated user, preserving its actual purpose — proving the `updated_at` trigger still fires on an allowed edit — under the narrowed policy rather than the old permissive one.
- **Files modified:** `tests/db/demandas-rls.test.ts`
- **Verification:** Both DEM-02 tests and the full 17-case extended suite pass; suite re-run twice in a row, both green.
- **Committed in:** `52e613f`

**2. [Rule 3 - Blocking] Disabled vitest fileParallelism to fix a Supabase Auth rate-limit collision blocking `npm test`**
- **Found during:** Task 1, running the full `npm test` acceptance criterion after the extended test file was added
- **Issue:** `npm test` (plain `vitest run`, parallel by default) intermittently failed with `Request rate limit reached` from Supabase Auth — the combined live-integration suites (`demandas-rls.test.ts` + `role-rls.test.ts`) now mint/sign-in enough disposable fixtures to exceed the hosted project's free-tier default of 30 sign-in requests per 5 minutes per IP (`supabase/config.toml`'s documented default) when both files run in parallel. Confirmed as a scheduling artifact, not an RLS/schema regression: every test passed cleanly when run file-by-file or after the rate-limit window cleared.
- **Fix:** Added `fileParallelism: false` to `vitest.config.ts`, trading a few extra seconds of total run time for a suite that reliably passes without bursting past this specific free-tier limit.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npm test` ran clean after the fix and after the rate-limit window cleared: 7 files passed, 48 tests passed, 2 intentionally skipped (missing `COORDINATOR_EMAIL`), 0 failed.
- **Committed in:** `52e613f`

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking fix)
**Impact on plan:** Both fixes were necessary to ship a test suite that accurately reflects the narrowed RLS behavior and passes reliably under `npm test`. No scope creep — neither fix touches the migration's actual RLS logic or adds functionality beyond what DEM-05 requires.

## Runtime-State Note (not a bug)

Per 05-RESEARCH.md's own "Runtime State Inventory" — this migration changes existing runtime behavior for any account already holding `role = 'lider_area'` before this migration ran: such an account has zero `lider_areas` rows by default (the table is new), so it will see **zero** área-scoped demandas — only its own `criado_por`/responsável rows — until a coordenador manually assigns it an área via `docs/areas.md`'s runbook. This is expected, matches Phase 2's coordinator-backfill precedent (new access-control state does not retroactively populate itself), and is not a defect in this migration.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None — the plan's `user_setup` precondition (confirming the Supabase project was ACTIVE/reachable before `db push`) was satisfied by running `npx supabase@latest migration list --linked`, which succeeded and returned migrations 0001-0003 applied both locally and remotely, confirming the project was live and reachable. No manual dashboard action, environment variable, or human click was required beyond that automated check.

## Verification Results

- `npx supabase@latest migration list --linked` — exit 0, shows `0004` applied in both Local and Remote columns.
- Re-running `npx supabase@latest db push` — reports `upToDate: true`, no pending migrations.
- `npx vitest run tests/db/demandas-rls.test.ts` — 17/17 passing, run twice in a row, both green.
- `npm test` — 7 files passed, 48 tests passed, 2 intentionally skipped, 0 failed (after the `fileParallelism: false` fix and outside the transient rate-limit window).
- `npx tsc --noEmit` — exit 0, no type errors.
- All plan-specified grep/SQL acceptance criteria on `supabase/migrations/0004_demandas_role_scope.sql` and `tests/db/demandas-rls.test.ts`/`docs/areas.md` verified directly — see acceptance criteria checklist below.

### Acceptance Criteria Checklist

- [x] `create table public.lider_areas` present
- [x] `area_liderada` (superseded single-column design) absent (0 occurrences)
- [x] Composite primary key `(lider_id, area)` present
- [x] `is_lider_of_area` referenced ≥3 times (function def + both demandas SELECT/UPDATE policies)
- [x] `lower(trim(` present on both sides of the área comparison (2 occurrences on the same line, confirmed via `grep -o`)
- [x] Old permissive `demandas`/`demanda_responsaveis` policies dropped by exact name
- [x] ≥3 `for select` policies (demandas, demanda_responsaveis, lider_areas)
- [x] No DELETE policy added to `demandas`
- [x] `revoke execute` present ≥2 times (both new helper functions)
- [x] `security_invoker` NOT re-declared (view untouched, inherits automatically)
- [x] Test file exercises mismatched-case/whitespace área values directly in fixture data (not re-testing the SQL predicate string)
- [x] `lider_areas` referenced ≥4 times in the test file (8 occurrences)
- [x] `Financeiro` used as a deliberately mismatched área in at least one denial case
- [x] No real personal/institutional email addresses in the test file or `docs/areas.md`
- [x] `example.invalid` fixture domain used throughout
- [x] Multi-área capability explicitly documented in `docs/areas.md`
- [x] `coordenador_geral` write-authorization boundary documented in `docs/areas.md`
- [x] `npx vitest run tests/db/demandas-rls.test.ts` passes twice in a row

## Next Phase Readiness

- Plan 05-02 (Wave 2, filtering UI) can safely query `demandas_com_status`/`demanda_responsaveis` under the assumption that RLS already returns exactly the role-scoped subset — no additional client-side filtering for authorization purposes is needed or permitted.
- Plan 05-02's role-scoped-view notice must handle a líder's `lider_areas` rows as plural (0, 1, or many área names for the same líder), since the schema now genuinely supports multiple simultaneous áreas.
- `docs/areas.md` is the only área-assignment mechanism until a future phase builds an admin UI — Phase 6/7's design should assume `lider_areas` is populated via this manual runbook.
- **Runtime-state note carried forward:** any pre-existing `lider_area` account has zero área-scoped demanda access until a coordenador runs `docs/areas.md`'s assignment procedure for them — this is expected, not a regression to fix.

## Self-Check: PASSED

All created/modified files verified present on disk (`supabase/migrations/0004_demandas_role_scope.sql`, `docs/areas.md`, `tests/db/demandas-rls.test.ts`, `vitest.config.ts`). Both task commits (`ffbefe8`, `52e613f`) verified present in `git log`.

---
*Phase: 05-demandas-filtering-role-scoped-access*
*Completed: 2026-08-04*

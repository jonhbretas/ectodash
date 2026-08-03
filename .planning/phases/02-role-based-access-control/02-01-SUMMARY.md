---
phase: 02-role-based-access-control
plan: 01
subsystem: database
tags: [postgres, supabase, rls, rbac, enum, security-definer, vitest]

# Dependency graph
requires:
  - phase: 01-project-scaffold-institutional-login
    provides: public.profiles table, self-only SELECT RLS policy, live hosted Supabase project, Vitest live-integration test pattern
provides:
  - "public.app_role enum (4 fixed institutional roles)"
  - "public.profiles.role column, NOT NULL DEFAULT 'voluntario_comum'"
  - "public.has_role(required_role) SECURITY DEFINER helper — the reusable role-check contract every future role-gated policy calls"
  - "Coordinator-only SELECT + UPDATE policies on public.profiles"
  - "Live-hosted-project proof (allow + both deny directions) via tests/db/role-rls.test.ts"
affects: [phase 4 (demandas ownership), phase 5 (role-scoped visibility), phase 6 (coordinator dashboard), phase 10 (financial dashboard RLS)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SECURITY DEFINER helper function (set search_path = '', fully-qualified refs, self-referential auth.uid() only) as the sole gate for RLS role checks — avoids self-recursion on the table it protects"
    - "RLS policy wraps the helper in a scalar subquery: using ((select public.has_role('role')))"
    - "An UPDATE RLS policy needs a matching SELECT policy granting visibility of the target row, or the UPDATE is silently unreachable (0 rows affected, no error) — a coordinator-scoped SELECT policy must accompany any coordinator-scoped UPDATE policy on a table with only a self-only SELECT policy"
    - "RLS allow/deny outcomes must be asserted by re-reading with the service-role admin client, never from the acting client's own response — RLS returns success-with-zero-rows (not an error) on both a denied write and a write the actor can't read back"

key-files:
  created:
    - supabase/migrations/0002_profiles_role.sql
    - tests/db/role-rls.test.ts
  modified: []

key-decisions:
  - "Coordinator backfill targets the earliest-created profiles row structurally (order by created_at asc limit 1), not a hardcoded email — this repository is public on GitHub and the plan's literal instruction to hardcode a personal email would have committed it permanently to git history"
  - "Added a coordinator-only SELECT policy alongside the planned UPDATE policy — required for the UPDATE to be reachable at all, discovered via live verification, not called out in phase research"

patterns-established:
  - "Every future role-gated policy is a one-line using ((select public.has_role('role'))) — no new pattern needed for phases 4, 5, 6, 10"
  - "Any role-gated UPDATE policy must ship with a matching SELECT policy for the same actor/target scope, or verify explicitly that an existing SELECT policy already covers it"

requirements-completed: [AUTH-02, AUTH-03]

coverage:
  - id: D1
    description: "public.app_role enum holds exactly the 4 fixed institutional roles; profiles.role is NOT NULL DEFAULT voluntario_comum"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "grep acceptance criteria against supabase/migrations/0002_profiles_role.sql (enum + column shape) — all 15 criteria passed"
        status: pass
      - kind: integration
        ref: "npx supabase@latest migration list --linked (0002 applied locally and remotely)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The seeded Coordenador geral account holds coordenador_geral after migration, not the column default"
    requirement: "AUTH-02"
    verification:
      - kind: integration
        ref: "live query against public.profiles via service-role client post-migration — confirmed role: coordenador_geral for the sole pre-existing account"
        status: pass
    human_judgment: false
  - id: D3
    description: "A coordinator can change another volunteer's role; a volunteer cannot change anyone's role including their own — enforced inside Postgres RLS, proven against the live hosted project"
    requirement: "AUTH-03"
    verification:
      - kind: integration
        ref: "tests/db/role-rls.test.ts — 3/3 tests passing (tracer allow path, cross-user deny, self-escalation deny), run twice consecutively"
        status: pass
      - kind: integration
        ref: "npm test (full suite, 5 files / 17 tests) — Phase 1 suites unaffected"
        status: pass
    human_judgment: false

duration: 52min
completed: 2026-08-03
status: complete
---

# Phase 2 Plan 1: Role-Based Access Control Tracer Summary

**Postgres enum-typed `role` column on `profiles` plus a `SECURITY DEFINER has_role()` helper, enforced via RLS and proven end-to-end against the live hosted Supabase project — including a real RLS gap the plan's own research missed.**

## Performance

- **Duration:** 52 min
- **Started:** 2026-08-03T23:02:00Z (approx.)
- **Completed:** 2026-08-03T23:54:25Z
- **Tasks:** 1 (tracer)
- **Files modified:** 2

## Accomplishments

- `public.app_role` enum with the 4 fixed institutional roles (`coordenador_geral`, `lider_area`, `voluntario_comum`, `financeiro`) — the database itself is the single source of truth for valid roles.
- `public.profiles.role` column, `NOT NULL DEFAULT 'voluntario_comum'`, backfilled so the Phase 1 seeded coordinator holds `coordenador_geral` (verified live, not just via the migration's logic).
- `public.has_role(required_role)` — `SECURITY DEFINER`, `set search_path = ''`, self-referential on `auth.uid()` only, EXECUTE revoked from `public`/`anon` and granted only to `authenticated`. This is the exact contract Phases 4, 5, 6, and 10 will call.
- Coordinator-only SELECT and UPDATE policies on `public.profiles`, both gated by `(select public.has_role('coordenador_geral'))`.
- `tests/db/role-rls.test.ts` — live integration proof, using the plan's required observation contract (assert only via service-role re-reads), covering the allow path and both deny directions (cross-user and self-escalation).

## Task Commits

1. **Task 1: End-to-end "a Coordenador geral changes another volunteer's role"** — `24d1a7d` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified

- `supabase/migrations/0002_profiles_role.sql` — enum, role column, structural coordinator backfill, `has_role()` helper, EXECUTE lockdown, coordinator-only SELECT + UPDATE policies.
- `tests/db/role-rls.test.ts` — live Vitest integration suite: `createUserWithRole()`/`signInAs()` fixture helpers following `profiles-trigger.test.ts`'s pattern, 3 test cases, `afterAll` cleanup via `admin.deleteUser`.

## Decisions Made

- **Coordinator backfill targeting (mandatory deviation, specified by the orchestrator):** The plan's Task 1 literally instructed `where email = 'jonathanbretas@gmail.com'`. Since this repository is public, that would have committed a real personal email address permanently into git history. Implemented Option 1 from the orchestrator's guidance: the backfill promotes the row with the earliest `created_at` (`order by created_at asc limit 1`), guarded to be a correct no-op on an empty table. This is reliable because the migration runs once at `db push` time, before any test suite runs — the test suite only ever creates disposable `@example.invalid` fixtures, and by the time this migration first ran, the seeded Phase 1 coordinator was the only row in `public.profiles`. Verified live: after `db push`, the sole pre-existing account (`jonathanbretas@gmail.com`) correctly shows `role: coordenador_geral`.
- **Added a coordinator-only SELECT policy not in the original plan** — see Deviations below; this was necessary for the planned UPDATE policy to function at all.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] UPDATE policy was unreachable without an accompanying SELECT policy**

- **Found during:** Task 1, live verification of the tracer test (the "allow" case failed on first run: coordinator update returned success/204 but the target row's role never changed).
- **Issue:** Postgres RLS resolves an `UPDATE`'s target rows through the table's `SELECT` policies before evaluating the `UPDATE` policy's own `USING` clause. Phase 1's only SELECT policy on `public.profiles` is self-only (`auth.uid() = id`), so a signed-in coordinator's session could not even see another user's row to begin with — the coordinator-only UPDATE policy from the plan (`using`/`with check` on `has_role('coordenador_geral')`) was therefore never reached. PostgREST reported this as a clean 200/204 with zero rows affected — no error — which is exactly indistinguishable from the deny path the plan already warned about, making it easy to mistake a broken allow path for a working deny path. This gap was not covered in `02-RESEARCH.md`; it surfaced only once the project's own `.agents/skills/supabase/SKILL.md` was consulted mid-debug ("UPDATE requires a SELECT policy... Without a SELECT policy, updates silently return 0 rows — no error, just no change").
- **Diagnosis:** Isolated with a series of temporary, never-committed debug migrations (`9999_debug_temp.sql`, later `9998_scratch_apply.sql`, `9997_cleanup_debug.sql`) applied and then fully reverted from both the live database and `supabase/migrations/`, none of which remain in the repository or migration history. Confirmed via `db advisors` post-cleanup that no debug artifacts persisted on the hosted project.
- **Fix:** Added `create policy "coordenador geral can view any profile" ... for select ... using ((select public.has_role('coordenador_geral')))` immediately before the existing UPDATE policy in the same migration. Phase 1's self-only SELECT policy is untouched — every other role's read visibility is unchanged.
- **Files modified:** `supabase/migrations/0002_profiles_role.sql`
- **Verification:** `npx vitest run tests/db/role-rls.test.ts` — all 3 cases pass, run twice consecutively; full `npm test` (17 tests, 5 files) green.
- **Committed in:** `24d1a7d` (Task 1 commit — the fix landed before the task was ever committed, so there is no separate fix commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug), plus 1 mandatory deviation applied per orchestrator instruction (coordinator backfill targeting, documented above under Decisions Made since it was specified rather than discovered).
**Impact on plan:** The SELECT-policy fix was essential for the phase's core claim (AUTH-03: coordinator can change another user's role) to be true at all — without it, the "allow" direction silently didn't work while looking identical to a correctly-enforced deny. No scope creep: the added policy is strictly the minimum needed to make the already-planned UPDATE policy reachable, uses the same `has_role('coordenador_geral')` gate, and does not widen visibility beyond the coordinator role.

## Issues Encountered

- `db advisors` correctly flags `has_role` as callable by `authenticated` (`authenticated_security_definer_function_executable`) — this is intentional per the plan (`grant execute ... to authenticated`) and per D-03; not an issue to fix.
- `db advisors` flags `multiple_permissive_policies` for SELECT on `public.profiles` (the new coordinator policy plus Phase 1's self-only policy) — this is the expected, load-bearing mechanism of the fix above, not a defect.
- `db advisors` flags Phase 1's pre-existing `users can view their own profile` policy for `auth_rls_initplan` (unwrapped `auth.uid()`) and flags Phase 1's `handle_new_user`/Supabase-managed `rls_auto_enable` as anon/authenticated-callable `SECURITY DEFINER` functions — all pre-existing from Phase 1, unmodified by and out of scope for this plan.
- Docker is unavailable in this environment (`npx supabase@latest db dump`/`db push`'s catalog caching both warn and continue) — consistent with `02-RESEARCH.md`'s Environment Availability findings; no local pgTAP was attempted, per the plan.

## User Setup Required

None — the project remained linked from Phase 1 (`supabase/.temp/project-ref` present, project ACTIVE), and `.env.local` already held valid credentials, so the `user_setup` re-link/password-reset path in the plan's frontmatter was never triggered.

## Next Phase Readiness

- `public.has_role(required_role)` is live, tested, and ready to be called directly from any future role-gated policy (Phase 4 demandas ownership, Phase 5 role-scoped visibility, Phase 6 coordinator dashboard, Phase 10 financial dashboard) — no new pattern needed, just `using ((select public.has_role('role')))`.
- **Known constraint carried forward (per plan's own note, now empirically confirmed):** `public.profiles` grants read visibility only to the row owner and to `coordenador_geral`. Any future phase needing broader read access (e.g. líder de área seeing their team's profiles) needs its own explicit SELECT policy — this is a deliberate scope boundary, not an oversight.
- **Known constraint for future self-editable profile fields:** RLS is row-level, not column-level — a plain `auth.uid() = id` UPDATE policy would also re-open self-role-escalation. Use a column-level GRANT or a guard trigger instead (per `02-RESEARCH.md` Pattern 3's forward-looking note, still valid).
- No blockers for Phase 3 or beyond.

---
*Phase: 02-role-based-access-control*
*Completed: 2026-08-03*

## Self-Check: PASSED

- FOUND: `supabase/migrations/0002_profiles_role.sql`
- FOUND: `tests/db/role-rls.test.ts`
- FOUND: `.planning/phases/02-role-based-access-control/02-01-SUMMARY.md`
- FOUND commit: `24d1a7d`

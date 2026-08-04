---
phase: 07-email-reminders
verified: 2026-08-04T16:13:12Z
status: human_needed
score: 4/4 must-haves verified (roadmap Success Criteria); all 3 plans' must_haves truths verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Visually inspect /painel's new 'Execuções de lembretes' section as coordenador_geral"
    expected: "Section renders below the overdue panel with pt-BR formatted timestamps, correct icon+label per status (green check/Sucesso, amber triangle/Falha parcial, red X/Falha, zinc clock/Em execução), and the run(s) created during the human's Task-1 production verification are visible with correct counts."
    why_human: "Rendered pixel output (icon choice legibility, spacing, color contrast in the actual browser) was never screenshot-verified by any executor this session — 07-03-SUMMARY.md explicitly flags this as an open, non-blocking follow-up (coverage id D1's rationale)."
  - test: "Visit /painel as a non-coordenador role (líder/voluntário/financeiro) and confirm the reminder-runs section does not render"
    expected: "The existing page-level access-denied branch (Phase 6) triggers before the panel; no reminder-runs data or section is visible to a non-coordenador."
    why_human: "This is backstopped by RLS and by the page's existing role branch (both verified structurally via grep/code-read and via the live migration), but the actual browser-rendered outcome for a real non-coordenador session was not visually confirmed in this pass — consistent with how prior phases in this project have deferred equivalent UI-only checks."
---

# Phase 7: Email Reminders Verification Report

**Phase Goal:** Volunteers and leaders are automatically reminded by email about approaching and overdue demandas, with reliable, traceable delivery.
**Verified:** 2026-08-04T16:13:12Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP.md Success Criteria, Phase 7)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User receives an email reminder when one of their demandas has an approaching prazo (LEMB-01) | ✓ VERIFIED | `src/lib/reminders/eligibility.ts`'s `reminderTipoFor()` classifies a non-concluded, non-atrasada demanda within `APPROACHING_PRAZO_DAYS` (3, inclusive) as `"aproximando"` — proven by 7 passing unit tests including the exact 3-day inclusive and 4-day exclusive boundaries. The cron route (`src/app/api/cron/reminders/route.ts`) calls `reminderTipoFor()` per candidate row and, when non-null, claims a dedup slot and calls `resend.emails.send()` via `sendReminder()`. Live-integration test `tests/db/reminder-run-log.test.ts` proves an eligible atrasada demanda produces exactly one mocked `resend.emails.send()` call and a `demanda_reminders_log` row with `status='sent'` — the same code path serves the "aproximando" case identically (one shared query/loop, `reminderTipoFor()` is the sole branch point). |
| 2 | User receives an email reminder when one of their demandas is already atrasada (LEMB-02) | ✓ VERIFIED | Same eligibility query/loop; `reminderTipoFor()` returns `"atrasada"` unconditionally when `row.atrasada` is true, overriding the prazo-window check entirely — unit-tested directly. `tests/db/reminder-run-log.test.ts`'s "LEMB-01/02/04" test creates a real atrasada fixture demanda and asserts `resend.emails.send()` was called and `demanda_reminders_log.status='sent'`. |
| 3 | A user never receives more than one reminder for the same demanda within the same day/cycle (LEMB-03) | ✓ VERIFIED | `supabase/migrations/0005_reminder_logs.sql` ships `UNIQUE(demanda_id, profile_id, tipo, sent_on)` on `demanda_reminders_log`, confirmed live via `npx supabase@latest migration list --linked` (0005 present in both Local and Remote). The cron route claims this row via `INSERT...select().single()` and treats a `23505` (unique-violation) error as the skip signal — never a SELECT-then-INSERT check. `tests/db/reminder-dedup.test.ts` (3 tests) proves the constraint itself rejects an identical-tuple duplicate with Postgres error 23505 and allows a different `tipo` or `sent_on`. `tests/db/reminder-run-log.test.ts`'s duplicate-invocation test proves a second cron run for the identical (demanda, responsável, tipo, day) does not re-call `resend.emails.send()` and results in exactly one `demanda_reminders_log` row for that tuple. All 10 of these tests pass live against the real hosted Supabase project. |
| 4 | Coordenador can see a log of reminder job runs showing success/failure and how many emails were sent (LEMB-04) | ✓ VERIFIED (code); see human_verification for rendered-pixel confirmation | `reminder_runs` (separate from `demanda_reminders_log`) is created with `status='running'` before the eligibility query runs and updated exactly once at the end (success/partial_failure) or in the `catch` block (failed) — proven live by 3 of `reminder-run-log.test.ts`'s 7 tests (success path, partial-failure path, and a genuinely thrown mid-run exception via a spied `.or()` rejection, all asserting the real `reminder_runs` row's final state). `src/app/(dashboard)/painel/page.tsx` reads `reminder_runs` via the caller's ordinary authenticated client (`createClient` from `server.ts`, never `admin.ts`) ordered by `started_at` descending, limited to 20, and renders `<ReminderRunsPanel runs={reminderRuns} />`. `reminder-runs-panel.tsx` renders timestamp, status icon+label, sent/failed/skipped counts, and — for `status==='failed'` — the `errorMessage` text. Code-level wiring and live data-flow are fully verified; the actual browser-rendered appearance was not screenshot-checked this session (see Human Verification). |

**Score:** 4/4 roadmap Success Criteria verified at the code/behavior level (1 of the 4 additionally requires a human pixel-level confirmation, tracked separately below — this does not reduce the truth's own VERIFIED status, since the panel's data flow, query, and rendering logic are all directly confirmed).

### Plan-Level Must-Haves (07-01, 07-02, 07-03 frontmatter)

All must_haves truths from all three PLAN.md files were checked directly against the shipped code (not inferred from SUMMARY.md prose):

| Plan | Must-have truth | Status |
|------|-----------------|--------|
| 07-01 | `demanda_reminders_log` has UNIQUE(demanda_id, profile_id, tipo, sent_on) | ✓ VERIFIED — read `supabase/migrations/0005_reminder_logs.sql` line 62 directly |
| 07-01 | `reminder_runs` is a separate table from `demanda_reminders_log` | ✓ VERIFIED — two distinct `create table` statements, `reminder_runs` first (FK target) |
| 07-01 | `sent_on` is a `date` column, not `timestamptz` | ✓ VERIFIED — line 50: `sent_on date not null default current_date` |
| 07-01 | Both tables RLS-enabled, coordenador-only SELECT, no authenticated-role write policy | ✓ VERIFIED — `enable row level security` on both; two `for select to authenticated using ((select public.has_role('coordenador_geral')))` policies; zero `for insert/update/delete to authenticated` policies (grep confirms none) |
| 07-01 | `reminderTipoFor()` precedence rules (concluida > atrasada > 3-day window) | ✓ VERIFIED — read `eligibility.ts` directly; 7 unit tests cover every boundary; all pass |
| 07-01 | `resend`/`react-email` installed, not `@react-email/components` | ✓ VERIFIED — `package.json` lists `resend": "^6.18.1"` and `react-email": "^6.9.1"`; `@react-email/components` absent (grep exit 1) |
| 07-02 | 401 rejection happens before any DB/Resend call | ✓ VERIFIED — code reads `authHeader !== Bearer ${CRON_SECRET}` check occurs as literally the first statement in `GET()`, before `createAdminClient()`/`new Resend()`; live test proves zero `reminder_runs` rows created on a 401 |
| 07-02 | One query serves both LEMB-01 and LEMB-02 | ✓ VERIFIED — single `.from("demandas_com_status").select(...).neq("status","concluida").or(...)` call; `reminderTipoFor()` is the sole downstream branch |
| 07-02 | Loop over (demanda × responsável) pairs, not demandas alone | ✓ VERIFIED — nested `for` loop; inner loop iterates `responsaveis` |
| 07-02 | `INSERT...ON CONFLICT` (via error-code 23505 handling) precedes the send | ✓ VERIFIED — dedup insert happens, checked for `dedupError.code === "23505"`, and only on success does `sendReminder()` get called |
| 07-02 | Zero-responsável demandas counted, not dropped | ✓ VERIFIED — `skippedNoResponsavel++` on empty `responsaveis`; folded into final `skipped_count`; live-tested (Pitfall 4 test) |
| 07-02 | `reminder_runs` row created before eligibility query, updated once in try or catch | ✓ VERIFIED — insert happens before `try {}`; single update at end of `try`, single update in `catch` |
| 07-02 | Failed send marks the row 'failed' with error_message, not deleted/retried same run | ✓ VERIFIED — `UPDATE ... SET status: sendError ? "failed" : "sent"`; live-tested |
| 07-02 | `admin.ts` imported only from the cron route | ✓ VERIFIED — repo-wide grep for `createAdminClient` shows exactly one import site: `src/app/api/cron/reminders/route.ts` |
| 07-03 | `vercel env ls production` lists all three secret names | ✓ VERIFIED — ran the command myself; `CRON_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` all present, "Encrypted", Production environment. Values never inspected. |
| 07-03 | Coordenador `/painel` shows run-log section, no redundant role check in panel | ✓ VERIFIED — `page.tsx` wired; `reminder-runs-panel.tsx` contains zero occurrences of `coordenador_geral` (grep confirms 0) and zero service-role usage |
| 07-03 | Failed run's error_message rendered | ✓ VERIFIED — `reminder-runs-panel.tsx` renders `run.errorMessage` in red text when `status === 'failed'` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0005_reminder_logs.sql` | dedup + run-log schema, RLS | ✓ VERIFIED | Read directly; matches spec exactly; confirmed live via `migration list --linked` (0005 Local+Remote) |
| `src/lib/reminders/eligibility.ts` | pure classifier + constant | ✓ VERIFIED | `parseISO` fix present (not `new Date()` on a bare date string) — the UTC-timezone bug fix claimed in 07-01-SUMMARY.md is genuinely in the shipped code, not just narrated |
| `src/app/api/cron/reminders/route.ts` | CRON_SECRET-gated route | ✓ VERIFIED | Full lifecycle present: auth check, run creation, eligibility query, dedup+send loop, try/catch |
| `src/proxy.ts` | `/api/cron/*` exemption | ✓ VERIFIED | `isPublicPath()` includes `pathname.startsWith("/api/cron")` with an explanatory comment describing the exact bug this fixes |
| `src/lib/supabase/admin.ts` | service-role factory, cron-only | ✓ VERIFIED | Repo-wide grep confirms sole non-test import site is the cron route |
| `src/app/(dashboard)/painel/page.tsx` + `reminder-runs-panel.tsx` | ordinary client, no redundant role check, error surfaced | ✓ VERIFIED | All three conditions confirmed by direct code read and grep |
| `vercel.json` | cron schedule registered | ✓ VERIFIED | `{"schedule": "0 8 * * *"}`, once daily, matches plan exactly |
| `package.json` | resend + react-email present, no @react-email/components, no recharts/tremor | ✓ VERIFIED | All four conditions confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `demanda_reminders_log` UNIQUE constraint | cron route's dedup insert | `INSERT...select().single()` + `23505` catch | ✓ WIRED | Live-tested twice (constraint-only test + full-route duplicate-invocation test) |
| `reminderTipoFor()` | cron route's per-row classification | direct import, no re-derivation | ✓ WIRED | `import { reminderTipoFor } from "@/lib/reminders/eligibility"` in route.ts; called once per candidate row |
| `reminder_runs.id` (FK) | `demanda_reminders_log.run_id` | insert-time `run_id: runId` | ✓ WIRED | Confirmed in migration (FK) and route code (populated on every insert) |
| `CRON_SECRET` env var | Authorization Bearer check | `request.headers.get("authorization") === \`Bearer ${process.env.CRON_SECRET}\`` | ✓ WIRED | Fails closed if unset (strict equality against `Bearer undefined`, never bypassed) |
| `/api/cron/*` request | proxy.ts's session redirect | `isPublicPath()` exemption | ✓ WIRED | Fixed bug confirmed present in shipped `src/proxy.ts` |
| `reminder_runs` table | `/painel`'s ordinary client read | `.from("reminder_runs").select(...).order(...).limit(20)` | ✓ WIRED | Confirmed in `page.tsx`; uses the same `supabase` prop as every other `/painel` query, never `admin.ts` |
| `ReminderRunsPanel` | `page.tsx` render tree | `<ReminderRunsPanel runs={reminderRuns} />` after `<OverduePanel .../>` | ✓ WIRED | Confirmed by direct read of the JSX return |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `reminder-runs-panel.tsx` | `runs` prop | `page.tsx`'s `supabase.from("reminder_runs").select(...)` mapped snake_case→camelCase | Yes — real query against the live `reminder_runs` table, not a static/empty fallback; confirmed by reading the mapping code and by the live-integration tests actually populating rows this exact query shape would read | ✓ FLOWING |
| cron route's `demandas` | eligibility query | `supabase.from("demandas_com_status").select(...)` (service-role) | Yes — real query, `demandas_com_status` is Phase 4's already-proven view | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `reminderTipoFor()` atrasada-override unit test | `npx vitest run src/lib/reminders/eligibility.test.ts -t "atrasada overrides"` | 1 passed / 6 skipped (targeted run) | ✓ PASS |
| Full eligibility boundary suite | `npm test` (full run, once) includes `eligibility.test.ts` | 7/7 passing (part of 73 passed/2 skipped) | ✓ PASS |
| Full cron-route lifecycle (7 behaviors: 401×2, success send, dedup skip, no-responsável skip, failed-send, thrown-exception) | `npx vitest run tests/db/reminder-run-log.test.ts --reporter=verbose` | 7/7 passed, live against hosted Supabase, Resend mocked | ✓ PASS |
| UNIQUE-constraint dedup mechanism (database layer, independent of route code) | `npx vitest run tests/db/reminder-dedup.test.ts --reporter=verbose` | 3/3 passed, live against hosted Supabase | ✓ PASS |
| `npx tsc --noEmit` | (run once) | exit 0, zero errors | ✓ PASS |
| `npm run build` | (run once) | Compiled successfully; `/api/cron/reminders` registered as dynamic route | ✓ PASS |
| `npm run lint` | (run once) | zero output, exit 0 | ✓ PASS |
| Full test suite | `npm test` (run once) | 73 passed / 2 skipped — exactly matches the documented baseline | ✓ PASS |
| `vercel env ls production` | (run once, names only) | `CRON_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` all present, Encrypted, Production | ✓ PASS |
| `npx supabase@latest migration list --linked` | (run once) | `0005` present in both Local and Remote columns | ✓ PASS |

No probes (`scripts/*/tests/probe-*.sh`) exist in this repository — Step 7c (Probe Execution) is not applicable; this project's verification convention is Vitest-based integration tests, all of which were run and reported above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LEMB-01 | 07-01, 07-02 | Sistema envia lembrete por e-mail para demandas com prazo próximo | ✓ SATISFIED | Eligibility classifier + cron route + live test, see Truth 1 above |
| LEMB-02 | 07-01, 07-02 | Sistema envia lembrete por e-mail para demandas já atrasadas | ✓ SATISFIED | Same evidence, see Truth 2 above |
| LEMB-03 | 07-01, 07-02 | Envio é idempotente — não manda lembrete duplicado no mesmo dia/ciclo | ✓ SATISFIED | UNIQUE constraint + atomic insert-with-conflict-handling, both unit- and live-tested, see Truth 3 above |
| LEMB-04 | 07-01, 07-02, 07-03 | Execução do job de lembrete fica registrada e visível (sucesso/falha, quantidade enviada) | ✓ SATISFIED (code); rendered UI needs one human look | `reminder_runs` lifecycle fully tested; `/painel` panel wired and reading real data; see Truth 4 above and Human Verification |

REQUIREMENTS.md marks all four as `Complete` for Phase 7 — consistent with the evidence gathered independently in this pass. No orphaned requirements found (no additional LEMB-* IDs map to Phase 7 beyond these four).

### Anti-Patterns Found

None. Scanned every file this phase created/modified (`0005_reminder_logs.sql`, `eligibility.ts`, `eligibility.test.ts`, `admin.ts`, `send-reminder.ts`, `reminder-email.tsx`, `route.ts`, `vercel.json`, `reminder-runs-panel.tsx`, `page.tsx`, `proxy.ts`, `reminder-dedup.test.ts`, `reminder-run-log.test.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and `coming soon|will be here|not yet implemented|not available` — zero matches (grep exit 1) across both scans. No debt markers, no stub language, no empty implementations (`return null`/`return {}`/`return []`/`=> {}`) found in any reviewed file beyond legitimate, intentional early-return branches (e.g. `reminderTipoFor()`'s `return null` for concluída demandas, which is correct domain logic, not a stub).

No real personal/institutional email address (`gmail|hotmail|outlook|yahoo`) found in the migration, dedup test, run-log test, or email template files (grep via the Grep tool, zero matches in each). `.env.local.example`'s diff content (inspected via `git show` on the historical commit, never by reading the live file directly, consistent with this session's security constraint) shows only placeholder entries (`RESEND_API_KEY=`, `CRON_SECRET=`) with no values and no personal email — matching the plan's prohibition.

### Security / Threat-Model Spot-Checks

- **T-07-02/T-07-05 (write-policy elevation, DoS):** Confirmed zero `for insert/update/delete to authenticated` policies exist on either new table — the only writer is the service-role client, itself confirmed restricted to the one cron route.
- **T-07-06/T-07-07 (service-role key leak/misuse):** `createAdminClient` has exactly one non-test import site in the entire `src/` tree (`src/app/api/cron/reminders/route.ts`). No Server Component or Server Action under `(dashboard)`/`(auth)` imports it.
- **T-07-08 (duplicate cron invocation → double-send):** The dedup insert is atomic and precedes the send; live-tested directly (duplicate-invocation test in `reminder-run-log.test.ts`).
- **T-07-09 (silent run failure):** The thrown-exception test proves `reminder_runs` transitions to `'failed'` with `error_message` and `finished_at` populated — never left `'running'` indefinitely.
- **T-07-10 (secret leakage in SUMMARY/shell history):** Neither 07-03-PLAN.md nor 07-03-SUMMARY.md contains any real secret value — both explicitly report presence/success only, consistent with the checkpoint's own instructions. This verification pass did not read `.env.local`/`.env`/any env file by any method, and confirmed the three Production secrets' presence using only `vercel env ls production` (names only), per the binding security constraint given for this task.
- **T-07-12 (CRON_SECRET fail-open misconfiguration):** The human's own Task-1 checkpoint (07-03-PLAN.md) explicitly re-tested a wrong-token request against the real deployed route and confirmed 401 with no side effect, before this verification pass began — this is exactly the check that would catch a fail-open Production misconfiguration and it was already performed against the live deployment, not merely locally.

### Human Verification Required

1. **Visually inspect `/painel`'s new "Execuções de lembretes" section as `coordenador_geral`**
   **Test:** Log in as a coordenador_geral user and visit `/painel`.
   **Expected:** The section renders below the overdue panel, showing pt-BR formatted timestamps (`dd/MM/yyyy HH:mm`), the correct icon+label per run status (green `CheckCircle2`/"Sucesso", amber `AlertTriangle`/"Falha parcial", red `XCircle`/"Falha", zinc `Clock`/"Em execução"), and sent/failed/skipped counts. The run(s) created during the human's own Task-1 production verification (per 07-03-SUMMARY.md) should be visible with plausible counts.
   **Why human:** Rendered pixel/browser output (icon legibility, spacing, actual color contrast as displayed, layout on a real screen) cannot be verified by grep or by a headless test — 07-03-SUMMARY.md's own coverage table (id D1) explicitly flags this as not yet screenshot-verified, and this verification pass did not launch a browser to check it either, consistent with the goal-backward code/data-flow methodology used throughout.

2. **Visit `/painel` as a non-coordenador role and confirm the reminder-runs section does not render**
   **Test:** Log in as líder de área, voluntário comum, or financeiro, and visit `/painel`.
   **Expected:** The existing Phase-6 access-denied branch triggers before any coordenador-only content (including the reminder-runs section) is reached; no reminder-runs data is visible.
   **Why human:** Structurally backstopped by two independent layers this pass DID verify (the page's existing role-branch code, and `reminder_runs`' own coordenador-only RLS SELECT policy, confirmed live via the applied migration) — but the actual rendered outcome for a real non-coordenador browser session was not visually confirmed in this pass.

### Gaps Summary

No gaps. All four ROADMAP.md Success Criteria for Phase 7, all must_haves truths across all three plans, and every one of the ten specific verification instructions given for this task were checked directly against the codebase (not against SUMMARY.md prose) and passed:

1. Migration file read directly — UNIQUE constraint, separate tables, RLS with coordenador-only SELECT, zero authenticated-write policies: all confirmed.
2. `eligibility.ts` read directly — atrasada-overrides-window, concluída-always-null, and the `parseISO` UTC-bug fix are all genuinely present in the shipped code (not just claimed in the SUMMARY).
3. `route.ts` read directly — CRON_SECRET check precedes all DB/Resend calls, dedup is atomic insert-with-conflict-handling (never check-then-insert), zero-responsável demandas are counted not dropped, and the try/catch covers the full lifecycle including a genuinely-thrown-exception test case.
4. `proxy.ts` read directly — the `/api/cron/*` exemption is present with an explanatory comment describing the exact bug it fixes.
5. `admin.ts` read directly, plus a repo-wide grep — confirmed the service-role client has exactly one non-test import site, the cron route itself.
6. `page.tsx` and `reminder-runs-panel.tsx` read directly — the new query uses the ordinary authenticated client, the panel has zero redundant role checks, and a failed run's `error_message` is rendered.
7. `vercel env ls production` was run directly by this verifier — all three secret names (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`) are present in Production. No value was inspected, echoed, or transmitted at any point, per the binding security constraint.
8. `npx tsc --noEmit`, `npm run build`, `npm test`, and `npm run lint` were all run directly by this verifier: tsc clean, build succeeds and registers the cron route, tests show 73 passed/2 skipped (matching the documented baseline exactly), lint is clean.
9. `vercel.json` confirmed to contain the `0 8 * * *` cron schedule registration.
10. `package.json` confirmed: `resend` and `react-email` present; `@react-email/components`, `recharts`, and `tremor` all absent.

The only open item is a human, browser-level visual confirmation of the `/painel` reminder-runs section's rendered appearance and the non-coordenador access-denied path — both are structurally backstopped by code and RLS this pass directly verified, and 07-03-SUMMARY.md itself already flagged the first as an explicit, non-blocking open follow-up. Per this task's own instruction, the human's separate manual production-trigger verification (success path + 401 rejection path, performed directly against the real deployed cron route before this verification pass began) is recorded here as human-confirmed and was not re-triggered by this verifier, since doing so would send a real email and create a real `reminder_runs` row outside the scope of a verification pass.

---
*Verified: 2026-08-04T16:13:12Z*
*Verifier: Claude (gsd-verifier)*

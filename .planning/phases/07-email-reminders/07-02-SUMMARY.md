---
phase: 07-email-reminders
plan: 02
subsystem: api
tags: [nextjs, vercel-cron, resend, react-email, supabase, postgres, vitest]

# Dependency graph
requires:
  - phase: 07-email-reminders
    plan: 01
    provides: "reminder_runs + demanda_reminders_log tables (UNIQUE dedup constraint), resend/react-email installed, reminderTipoFor() eligibility classifier"
provides:
  - "src/lib/supabase/admin.ts — service-role client factory, sole non-seed-script reader of SUPABASE_SERVICE_ROLE_KEY"
  - "src/emails/reminder-email.tsx — pt-BR, large-text/high-contrast react-email reminder template"
  - "src/lib/reminders/send-reminder.ts — resend.emails.send() wrapper, isolates the one mockable call site"
  - "GET /api/cron/reminders — CRON_SECRET-gated Route Handler: eligibility query, per-(demanda,responsável) dedup+send loop, reminder_runs lifecycle across success/partial-failure/crash"
  - "vercel.json — once-daily (0 8 * * *) cron registration"
  - "src/proxy.ts fix — /api/cron/* exempted from the session-based auth redirect"
affects: [07-03-production-env-and-run-log-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedup as atomic insert-with-conflict-handling (INSERT + 23505 catch), never check-then-insert"
    - "reminder_runs lifecycle in try/catch: row created before eligibility query, updated exactly once in the success path or the catch path, never left 'running'"
    - "Loop over (demanda, responsável) pairs, not demandas alone — per-recipient dedup granularity"
    - "Service-role client construction restricted by convention + negative-grep to src/app/api/cron/ only"

key-files:
  created:
    - src/lib/supabase/admin.ts
    - src/lib/reminders/send-reminder.ts
    - src/emails/reminder-email.tsx
    - src/app/api/cron/reminders/route.ts
    - vercel.json
    - tests/db/reminder-run-log.test.ts
  modified:
    - src/proxy.ts

key-decisions:
  - "reminder_runs auth-failure lifecycle (LEMB-04's crash case) proven by spying on @supabase/postgrest-js's PostgrestFilterBuilder.prototype.or() to throw mid-query against the LIVE project, rather than mocking the whole Supabase client — keeps the test closer to a real failure while still being deterministic and test-owned."
  - "src/proxy.ts's isPublicPath() gate extended to exempt /api/cron/* — a cron invocation carries no end-user session, so the route's own CRON_SECRET check must be reachable at all (see Deviations)."
  - "CRON_SECRET for the live-integration test suite is a test-owned literal (never read from .env.local/Vercel), so the suite never depends on a real production secret existing locally."

patterns-established:
  - "Live-integration tests importing a Route Handler's exported GET function directly, constructing a minimal { headers } object rather than a full NextRequest, mirrors this repo's existing tests/db/*.test.ts live-integration pattern one layer up (HTTP handler, not just DB queries)."

requirements-completed: [LEMB-01, LEMB-02, LEMB-03, LEMB-04]

coverage:
  - id: D1
    description: "GET /api/cron/reminders rejects a request with a missing or mismatched Authorization header with 401, before any database write"
    requirement: "LEMB-03"
    verification:
      - kind: integration
        ref: "tests/db/reminder-run-log.test.ts#rejects a request with a missing Authorization header with 401 and creates zero reminder_runs rows"
        status: pass
      - kind: integration
        ref: "tests/db/reminder-run-log.test.ts#rejects a request with a mismatched Authorization header with 401 and creates zero reminder_runs rows"
        status: pass
      - kind: manual_procedural
        ref: "curl -i http://localhost:3000/api/cron/reminders (no header) -> 401; curl -i -H 'Authorization: Bearer wrong-secret' -> 401, confirmed live against `next dev`"
        status: pass
    human_judgment: false
  - id: D2
    description: "One eligible atrasada demanda with one responsável -> exactly one resend.emails.send() call, demanda_reminders_log row status='sent', reminder_runs status='success'"
    requirement: "LEMB-01, LEMB-02, LEMB-04"
    verification:
      - kind: integration
        ref: "tests/db/reminder-run-log.test.ts#LEMB-01/02/04: sends exactly one email for one eligible atrasada demanda with one responsável and records a success run"
        status: pass
    human_judgment: false
  - id: D3
    description: "A duplicate same-day cron invocation for the identical (demanda, responsável, tipo, day) does NOT call resend.emails.send() again; skippedCount reflects the skip; exactly one demanda_reminders_log row ever exists for that tuple"
    requirement: "LEMB-03"
    verification:
      - kind: integration
        ref: "tests/db/reminder-run-log.test.ts#LEMB-03: a duplicate cron invocation for the same demanda/responsável/tipo/day does NOT call resend.emails.send() again and is counted as skipped"
        status: pass
    human_judgment: false
  - id: D4
    description: "A demanda with zero demanda_responsaveis rows is counted in skippedNoResponsavel, never silently dropped from the run's totals"
    requirement: "LEMB-04"
    verification:
      - kind: integration
        ref: "tests/db/reminder-run-log.test.ts#Pitfall 4: a demanda with zero demanda_responsaveis rows is counted in skippedNoResponsavel, never silently dropped"
        status: pass
    human_judgment: false
  - id: D5
    description: "A failed resend.emails.send() marks that reminder's demanda_reminders_log row status='failed' with error_message set (never deleted, never retried same run); the run's reminder_runs row shows status='partial_failure'"
    requirement: "LEMB-04"
    verification:
      - kind: integration
        ref: "tests/db/reminder-run-log.test.ts#LEMB-04: a failed resend.emails.send() marks the dedup row 'failed' (not deleted) and the run 'partial_failure'"
        status: pass
    human_judgment: false
  - id: D6
    description: "A thrown exception mid-run (eligibility query itself rejects) still updates the reminder_runs row created at the start to status='failed' with error_message and finished_at populated — never left indefinitely 'running'"
    requirement: "LEMB-04"
    verification:
      - kind: integration
        ref: "tests/db/reminder-run-log.test.ts#LEMB-04: a thrown exception mid-run still updates reminder_runs to status='failed' with error_message and finished_at set, never left 'running'"
        status: pass
    human_judgment: false
  - id: D7
    description: "The service-role admin client is never imported from any Server Component/Action under src/app/(dashboard)/ or src/app/(auth)/"
    verification:
      - kind: other
        ref: "grep -rc 'createAdminClient' \"src/app/(dashboard)/\" \"src/app/(auth)/\" | grep -v ':0' | wc -l -> 0"
        status: pass
    human_judgment: false

duration: ~50min
completed: 2026-08-04
status: complete
---

# Phase 7 Plan 2: Cron Route, Service-Role Client, and Reminder Email Summary

**CRON_SECRET-gated GET /api/cron/reminders sends per-(demanda,responsável) atrasada/aproximando reminders via a mocked-in-tests resend.emails.send(), dedups atomically against plan 07-01's UNIQUE constraint, and records a complete reminder_runs lifecycle across success/partial-failure/crash — plus a real proxy.ts auth-gate bug found and fixed along the way**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-08-04T15:12:00Z (approx, immediately following 07-01)
- **Completed:** 2026-08-04T16:00:00Z (approx)
- **Tasks:** 1 (single tracer task, per plan structure)
- **Files modified:** 8 (6 new, 2 modified: route.ts's own follow-up wording fix counted once; src/proxy.ts fixed as a discovered deviation)

## Accomplishments

- `src/lib/supabase/admin.ts` — service-role client factory extracted from `scripts/seed-coordinator.ts`'s inline pattern; fails loud (throws) if either `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing; restricted by convention (and this plan's own negative-grep acceptance criteria) to `src/app/api/cron/` only
- `src/emails/reminder-email.tsx` — pt-BR react-email template, `lang="pt-BR"`, 24px heading / 18px body text, high-contrast dark-on-light colors, imported from the unified `react-email` package (never the deprecated `@react-email/components`)
- `src/lib/reminders/send-reminder.ts` — thin wrapper isolating the one `resend.emails.send()` call site, using `lembretes@ectolab.org` (the institution's own already-verified sending domain) as the `from` address
- `src/app/api/cron/reminders/route.ts` — the `GET` Route Handler: `CRON_SECRET` Bearer-token check (401 before any DB/Resend call), `reminder_runs` row created before the eligibility query, one query against `demandas_com_status` serving both LEMB-01 and LEMB-02, `reminderTipoFor()` reused (not re-derived), per-(demanda, responsável) dedup+send loop with `23505`-conflict skip handling, zero-responsável demandas tracked as `skippedNoResponsavel`, and a try/catch ensuring the run always transitions out of `'running'`
- `vercel.json` — once-daily `0 8 * * *` cron registration, Vercel Hobby's cap, no GitHub Actions workaround
- `tests/db/reminder-run-log.test.ts` — live-integration test proving all 7 `<behavior>` cases against the real hosted Supabase project with Resend fully mocked (`vi.mock("resend")`); confirmed deterministic across two consecutive runs
- **Real bug found and fixed:** `src/proxy.ts`'s `isPublicPath()` gate had no exemption for `/api/cron/*` — every cron request (with or without a valid `CRON_SECRET`) was being redirected 307 to `/login` before the route's own auth check ever ran, since a cron invocation carries no end-user session. Found via this plan's own required manual verification step (`curl -i http://localhost:3000/api/cron/reminders`), not a hypothetical review. Fixed and re-verified live.

## Task Commits

Task 1 (the plan's single tracer task) was committed in seven atomic pieces as each file/fix was completed and verified:

1. **Admin client factory** - `0b62cb3` (feat)
2. **react-email reminder template** - `2be6eea` (feat)
3. **send-reminder wrapper** - `f9c42bb` (feat)
4. **Cron route + vercel.json** - `0f50d46` (feat)
5. **proxy.ts fix (deviation)** - `2b322fc` (fix)
6. **Live-integration test** - `fbf45e4` (test)
7. **Comment wording fix for two acceptance-criteria false positives (deviation)** - `d3cdb0c` (fix)

**Plan metadata:** committed as part of this SUMMARY's own final commit (see below).

## Files Created/Modified

- `src/lib/supabase/admin.ts` - service-role client factory
- `src/emails/reminder-email.tsx` - react-email reminder template
- `src/lib/reminders/send-reminder.ts` - resend.emails.send() wrapper
- `src/app/api/cron/reminders/route.ts` - the CRON_SECRET-gated GET Route Handler
- `vercel.json` - cron schedule registration
- `tests/db/reminder-run-log.test.ts` - live-integration test, 7 behavior cases
- `src/proxy.ts` - `/api/cron/*` exempted from the session-based auth redirect (deviation)

## Decisions Made

- The mid-run-crash test case (`<behavior>` case 7) reproduces a genuine live query failure by spying on `@supabase/postgrest-js`'s `PostgrestFilterBuilder.prototype.or()` to throw once, rather than swapping env vars or mocking the whole Supabase client — this exercises the route's real catch-path logic against the live project.
- The test suite's own `CRON_SECRET` value is a literal owned by the test file itself, set via `process.env.CRON_SECRET = ...` before the route module is imported — never read from `.env.local`, since neither `CRON_SECRET` nor `RESEND_API_KEY` exist locally yet (confirmed: both are still empty placeholders per plan 07-01's `.env.local.example` additions; adding real values to Vercel Production is explicitly plan 07-03's responsibility).
- Two acceptance-criteria negative-greps (`@react-email/components`, `ON CONFLICT`) were tripped by explanatory comments naming the forbidden pattern to explain why it's avoided, not by actual usage — reworded both comments to avoid the literal substring while preserving the same explanation, since the mechanical check cannot distinguish "mentioned to explain" from "used."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `src/proxy.ts` redirected every `/api/cron/*` request to `/login`, defeating the route's own CRON_SECRET check**
- **Found during:** Task 1's required manual verification step (`curl -i http://localhost:3000/api/cron/reminders` after `npm run build` succeeded)
- **Issue:** `src/proxy.ts`'s `isPublicPath()` function only exempted `/login` and `/auth/*` from the session-based redirect. A Vercel Cron invocation has no end-user session by construction — so the proxy's `if (!user && !isPublicPath(...))` branch caught every request to `/api/cron/reminders`, including ones carrying a perfectly valid `Authorization: Bearer <CRON_SECRET>` header, and returned a 307 redirect to `/login` before the route handler itself was ever invoked. This would have silently defeated the entire cron route in production — the route's own 401 logic is correct, but unreachable.
- **Fix:** Added `pathname.startsWith("/api/cron")` to `isPublicPath()`'s exemption list, with an inline comment explaining why (the route authenticates the request itself, not the user).
- **Files modified:** `src/proxy.ts`
- **Verification:** Killed and restarted the local dev server cleanly (found and cleared two stale orphaned dev-server processes still holding ports 3000/3001 from before the fix), then re-ran `curl -i http://localhost:3000/api/cron/reminders` (no header) -> `401 Unauthorized`, and `curl -i -H "Authorization: Bearer wrong-secret" ...` -> `401 Unauthorized`, both confirmed with no 307 redirect. Full `npm test` (73 passed/2 skipped) and `npm run build` re-confirmed green after the fix.
- **Committed in:** `2b322fc` (fix)

**2. [Rule 3 - Blocking] Two acceptance-criteria negative-greps failed on explanatory comments, not actual code**
- **Found during:** Task 1's own acceptance-criteria verification pass
- **Issue:** `grep -qi '@react-email/components' src/emails/reminder-email.tsx` and `grep -qi 'ON CONFLICT' src/app/api/cron/reminders/route.ts` both unexpectedly matched — not because either forbidden pattern was actually used, but because my own explanatory comments named them literally to explain why they're avoided (e.g., "never `@react-email/components`", "the atomic INSERT ... ON CONFLICT").
- **Fix:** Reworded both comments to preserve the same explanation without the literal substring the negative-grep checks for.
- **Files modified:** `src/emails/reminder-email.tsx`, `src/app/api/cron/reminders/route.ts`
- **Verification:** Re-ran both greps after the fix — both now correctly exit 1 (pattern absent). Full `npx tsc --noEmit`, `npm test`, and `npm run build` re-confirmed green.
- **Committed in:** `d3cdb0c` (fix)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 real bug, 1 Rule 3 blocking/cosmetic fix)
**Impact on plan:** Deviation 1 is a genuine, would-have-shipped-broken bug — without it, this entire plan's cron route would have been unreachable in production despite every unit/integration test passing (the tests call the route's exported `GET` function directly, bypassing the proxy entirely, so nothing in the automated suite could have caught this; only the plan's own mandated manual `curl` verification step surfaced it). Deviation 2 is cosmetic (comment wording only, zero behavior change). No scope creep — both fixes are scoped exactly to files this plan already touches or a file (`proxy.ts`) whose behavior this plan's own route depends on.

## Issues Encountered

- **Stale orphaned `next dev` processes on ports 3000/3001** from earlier in this session, one of which was still serving the PRE-fix `proxy.ts` bundle even after the fix was saved to disk (Turbopack dev servers don't always hot-reload a `proxy.ts`/middleware change reliably). Resolved by explicitly killing both stale processes (`Stop-Process -Force` on their PIDs) and starting a single fresh `next dev` on port 3000 before re-verifying with `curl`. No functional impact on the shipped code — this was purely a local verification-environment hygiene issue.

## User Setup Required

None - no external service configuration required. (Adding real `SUPABASE_SERVICE_ROLE_KEY` (to Production), `RESEND_API_KEY`, and `CRON_SECRET` to Vercel Production, and confirming the cron registration in the Vercel Dashboard, remains explicitly plan 07-03's responsibility, per this plan's own `<artifacts_this_phase_produces>` contract.)

## Next Phase Readiness

- Plan 07-03 (Wave 3, production env vars + run-log UI) can add `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `CRON_SECRET` to Vercel Production and expect the SAME code path to work when deployed — no code change anticipated unless production verification surfaces a real defect.
- `reminder_runs`/`demanda_reminders_log` are already being written correctly by this route (proven live, not just unit-tested) — plan 07-03's `/painel` run-log panel is a pure read composition over data this plan's route already produces correctly.
- `vercel.json`'s cron registration takes effect automatically on the next Vercel deployment; plan 07-03 only needs to confirm (post-deploy) that the Vercel Dashboard's Cron Jobs view shows it registered — no re-creation needed.
- **Important carry-forward for plan 07-03's own verification:** confirm the `src/proxy.ts` fix (Deviation 1) survives the actual Vercel deployment — this was only verified against local `next dev`, and while the fix is a plain pathname-prefix check with no environment-specific logic, it's worth a quick post-deploy `curl` against the production URL as part of 07-03's own checkpoint, given how silently this exact class of bug would have failed (every symptom would have looked like "the cron just isn't running" with no error in the route's own logs, since the route was never reached).
- No other blockers. `npx tsc --noEmit` clean; `npm test` green (73 passed, 2 skipped — this plan added exactly 7 new passing tests, matching its own 7 `<behavior>` cases); `npm run build` succeeds and registers `/api/cron/reminders` as a dynamic route.

## Self-Check: PASSED

All created files verified to exist on disk (`src/lib/supabase/admin.ts`, `src/emails/reminder-email.tsx`, `src/lib/reminders/send-reminder.ts`, `src/app/api/cron/reminders/route.ts`, `vercel.json`, `tests/db/reminder-run-log.test.ts`, this SUMMARY). All 7 task commits verified present in `git log` (`0b62cb3`, `2be6eea`, `f9c42bb`, `0f50d46`, `2b322fc`, `fbf45e4`, `d3cdb0c`).

---
*Phase: 07-email-reminders*
*Completed: 2026-08-04*

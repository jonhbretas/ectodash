---
phase: 01-project-scaffold-institutional-login
plan: 03
subsystem: auth
tags: [supabase, nextjs, vitest, resend, smtp, magic-link, invite]

# Dependency graph
requires:
  - phase: 01-02
    provides: "public.profiles table, RLS policies, and the handle_new_user identity trigger that fires on any new auth.users row"
provides:
  - "Working end-to-end magic-link login: /login form -> requestMagicLink Server Action (shouldCreateUser: false) -> Supabase Auth -> /auth/callback code exchange -> session cookie -> middleware guard -> signed-in dashboard reading the caller's profiles row"
  - "scripts/seed-coordinator.ts — the only account-creation path in the system, via admin.inviteUserByEmail, committed and proven against the real hosted project"
  - "Confirmed working invite-only onboarding end-to-end in production, including the previously-unverified invite-email template/redirect path (RESEARCH.md Assumption A4 / Open Question 2, now resolved)"
  - "Live proof that public.profiles.id ON DELETE CASCADE works correctly (bonus finding from deleting the temporary bypass account)"
affects: [phase-02-roles-rls, phase-03-accessible-ui, phase-04-demandas-crud]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "seed-coordinator.ts is idempotent-safe but not error-free on resend: re-inviting a still-pending (unconfirmed) user succeeds and resends rather than erroring — Supabase's admin.inviteUserByEmail only rejects with 'already registered' once the invited user has actually confirmed via the link. Any future re-invite tooling/logic should account for this state distinction rather than treating a non-zero-exit assumption as universal."

key-files:
  created: []
  modified:
    - scripts/seed-coordinator.ts (committed for the first time — content was never changed from the original plan spec)
    - package.json (seed:coordinator npm script entry, committed for the first time)

key-decisions:
  - "Deleted the temporary admin.createUser-bypass account for jonathanbretas@gmail.com via auth.admin.deleteUser before re-running the real invite path, so the Coordenador geral's final account is created exclusively through the plan's intended admin.inviteUserByEmail flow (D-02) with no bypass residue."
  - "Verified the profiles-row cascade-delete as a side effect of the account deletion (public.profiles row was PRESENT before deleteUser and GONE after), confirming plan 01-02's ON DELETE CASCADE works correctly against the live project."
  - "Resequenced the duplicate-invite acceptance check to run twice: once immediately after the first successful invite (before human confirmation — this returned exit 0/resend, not an error, because the account was still pending) and once again after the human confirmed Task 3 and the account became genuinely confirmed (this returned exit 1 with 'A user with this email address has already been registered', the actual acceptance-criteria behavior). This ordering was necessary because Supabase's inviteUserByEmail only rejects already-CONFIRMED users, not pending ones — a fact not evident from the plan text alone."
  - "The Supabase Auth 'Rate limit for sending emails' dashboard setting had to be raised (2/hour default -> 30/hour) before the real invite could be sent — custom SMTP alone does not raise this limit automatically. Human action performed in Supabase Dashboard -> Authentication -> Rate Limits, outside CLI/automation reach."

requirements-completed: [AUTH-01, AUTH-04]

coverage:
  - id: D1
    description: "requestMagicLink Server Action locks signInWithOtp to shouldCreateUser: false, builds emailRedirectTo only from NEXT_PUBLIC_SITE_URL, and returns an identical response on every outcome (no email-existence enumeration)"
    requirement: "AUTH-01"
    verification:
      - kind: unit
        ref: "tests/auth/signInWithOtp.test.ts#Test 1-4"
        status: pass
    human_judgment: false
  - id: D2
    description: "A never-invited address creates no account against the real hosted Supabase project (live integration proof of D-02, not just a mock)"
    requirement: "AUTH-01"
    verification:
      - kind: integration
        ref: "tests/auth/signInWithOtp.test.ts#Test 5 (live, SUPABASE_SERVICE_ROLE_KEY present, not skipped)"
        status: pass
    human_judgment: false
  - id: D3
    description: "middleware.ts (src/proxy.ts) redirects unauthenticated requests to /login and validates sessions via getUser(), never a non-validating session read"
    requirement: "AUTH-01"
    verification:
      - kind: e2e
        ref: "npm run build + curl smoke checks recorded in prior session's Task 1 commit (121785d)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Coordenador geral seeded through the real admin.inviteUserByEmail path (not the temporary admin.createUser bypass): old bypass account deleted, profiles-row cascade confirmed, new invite succeeds and prints a user id, matching profiles row confirmed present"
    requirement: "AUTH-01"
    verification:
      - kind: other
        ref: "npm run seed:coordinator -- jonathanbretas@gmail.com (this session) -> printed user id d96c842a-4f13-4d39-8fc1-1409ab1731ad; admin-client profiles query confirmed matching row"
        status: pass
    human_judgment: false
  - id: D5
    description: "Re-inviting an already-registered (confirmed) coordinator is rejected cleanly, proving no silent duplicate account/profiles row is ever created"
    requirement: "AUTH-01"
    verification:
      - kind: other
        ref: "npm run seed:coordinator -- jonathanbretas@gmail.com re-run after Task 3 confirmation -> exit 1, 'A user with this email address has already been registered'; listUsers + profiles query confirmed exactly one account/row throughout"
        status: pass
    human_judgment: false
  - id: D6
    description: "grep-based acceptance criteria: inviteUserByEmail present in seed script; seed-coordinator and SERVICE_ROLE never referenced under src/ or middleware.ts; npm run build exits 0"
    requirement: "AUTH-01"
    verification:
      - kind: other
        ref: "grep -q 'inviteUserByEmail' scripts/seed-coordinator.ts; grep -rn 'seed-coordinator' src/ middleware.ts (no matches); grep -rn 'SERVICE_ROLE' src/ middleware.ts (no matches); npm run build (exit 0)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Coordenador geral's institutional address receives a real invite e-mail in a real inbox, clicks it, and lands signed in on the live production URL with no credential-setting screen at any point — resolving RESEARCH.md Open Question 2 for the invite path specifically (the magic-link path was already resolved in plan 01-04)"
    requirement: "AUTH-01"
    verification: []
    human_judgment: true
    rationale: "Requires a real institutional inbox and a real click-through on the live production deployment — Docker/local inbox tooling was unavailable, so this can only be confirmed by the human directly. Confirmed: human replied 'approved' — the invite link signed them in cleanly on production, no credential screen."

# Metrics
duration: ~25min active this session (deletion+re-invite+verification+checkpoint+summary); Task 1 was committed in a prior session segment (see 121785d); Task 2 was implemented in a prior session but held uncommitted pending the real invite proof, which required this session's SMTP-fix follow-through
completed: 2026-08-03
status: complete
---

# Phase 1 Plan 03: Tracer — Invite-Only Magic-Link Login Summary

**End-to-end invite-only, password-free magic-link login (login form -> Server Action -> Supabase Auth -> /auth/callback -> session cookie -> middleware -> profiles-backed dashboard) with the Coordenador geral seeded through the real `admin.inviteUserByEmail` path and the invite-email template/redirect confirmed working in production for the first time.**

## Performance

- **Duration:** ~25 min active this session (bypass-account cleanup, real invite re-run, verification, checkpoint, this summary); Task 1 (the tracer slice itself) was implemented and committed in a prior session segment
- **Completed:** 2026-08-03
- **Tasks:** 3/3 (Task 1 tracer + Task 2 seed script + Task 3 checkpoint, all now closed)
- **Files modified:** 2 this session (`scripts/seed-coordinator.ts`, `package.json`); 9 in the prior Task 1 commit

## Accomplishments

- Full tracer slice proven end-to-end in a prior session: `/login` (single e-mail field, no password anywhere), `requestMagicLink` Server Action locked to `shouldCreateUser: false`, `/auth/callback` code-exchange Route Handler shared by both magic-link and invite e-mails, session middleware (`src/proxy.ts`) validating via `getUser()`, and a signed-in dashboard reading the caller's `public.profiles` row.
- **Closed out this session:** deleted the temporary `admin.createUser`-bypass account used while Supabase Auth's SMTP was broken, confirming as a bonus proof point that `public.profiles`' `ON DELETE CASCADE` (from plan 01-02) fires correctly — the row was present before and gone immediately after deleting the auth user.
- Re-ran the plan's real onboarding path — `npm run seed:coordinator -- jonathanbretas@gmail.com` via `admin.inviteUserByEmail` — against the now-fixed Resend SMTP relay (verified `ectolab.org` domain). Succeeded cleanly, printed a user id, and a matching `public.profiles` row was confirmed present via an admin-client query.
- Confirmed the duplicate-invite safety property in two stages, in the correct order given Supabase's actual API behavior: immediately re-running the seed command against a still-*pending* invite returned exit 0 with a resend (not an error) and created no duplicate account/row; re-running it again *after* the coordinator confirmed via the real invite link returned exit 1 with "A user with this email address has already been registered" — the literal acceptance-criteria behavior, now correctly exercised.
- All Task 2 grep-based acceptance criteria hold: `inviteUserByEmail` present in the (never-modified) seed script; no reference to `seed-coordinator` or `SERVICE_ROLE` anywhere under `src/` or `middleware.ts`; `npm run build` exits 0; `npm test` reports 14/14 passing including the live no-self-signup integration case.
- **Human-verified in production (Task 3, previously the plan's only remaining open item):** the coordinator opened the real invite e-mail, clicked the link, and landed signed in on `https://ectodash.vercel.app` with no credential-setting screen at any point — resolving RESEARCH.md Assumption A4 / Open Question 2 for the invite path specifically. (The magic-link path was already independently confirmed in plan 01-04's checkpoint.)

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "invited volunteer signs in with a magic link"** - `121785d` (feat, prior session)
2. **Task 2: Seed the Coordenador geral through the invite-only onboarding path** - `464c53f` (feat, this session — committed `scripts/seed-coordinator.ts` and the `seed:coordinator` npm script for the first time, after the real invite was proven working)
3. **Task 3: Real-inbox verification — invite link signs the coordinator in with no credential screen** - `checkpoint:human-verify`, no code commit — approved by the human against live production

**Plan metadata:** commit follows this summary.

## Files Created/Modified

- `scripts/seed-coordinator.ts` - one-off, never-deployed invite script calling `admin.inviteUserByEmail`; content was never changed from the original plan spec, only its commit was deferred until the real invite path was proven
- `package.json` - `seed:coordinator` npm script entry (`node --env-file=.env.local --experimental-strip-types scripts/seed-coordinator.ts`)

## Decisions Made

- Deleted the temporary `admin.createUser`-bypass coordinator account via `auth.admin.deleteUser` before re-running the real invite flow, so the final account exists exclusively through the intended `admin.inviteUserByEmail` path with no bypass residue — and confirmed the `public.profiles` cascade-delete fires correctly as a side effect.
- Resequenced the duplicate-invite verification into two passes (pending-invite resend, then post-confirmation rejection) because Supabase's `inviteUserByEmail` only errors "already registered" for a *confirmed* user, not a pending one — a real-world nuance the original plan text didn't anticipate. No account or profiles-row duplication occurred at either stage.
- The Supabase Dashboard's "Rate limit for sending emails" setting (Authentication -> Rate Limits) had to be raised by the user from its conservative default to 30/hour before the real invite could succeed — switching to custom SMTP does not raise this limit automatically. This is a dashboard-only action, performed by the human, analogous to this plan's own `user_setup` items.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/environment] Supabase Auth email rate limit blocked the first real invite attempt**
- **Found during:** Task 2 re-execution
- **Issue:** `npm run seed:coordinator -- jonathanbretas@gmail.com` failed with "email rate limit exceeded" — Supabase Auth's own send-rate limiter (separate from the custom SMTP relay), still at its conservative default despite the Resend/domain SMTP fix.
- **Fix:** Not auto-fixable from the CLI without risking overwriting other live Dashboard-only Auth settings (`supabase config push` would push the *entire* local config over the project, risking reverting the pt-BR email templates and sign-up-disabled toggle this same plan required by hand). Surfaced as a checkpoint; the human raised the Dashboard rate limit to 30/hour, after which the command succeeded cleanly on retry.
- **Files modified:** none (external service configuration only)
- **Verification:** Re-run of `npm run seed:coordinator` printed a user id; confirmed via admin-client query and `listUsers` that exactly one account/profiles row exists.
- **Committed in:** N/A (no code change; STATE.md blocker/history entries record this)

**2. [Not a bug — a corrected assumption] Duplicate-invite acceptance criterion required resequencing**
- **Found during:** Task 2, first duplicate-invite check
- **Issue:** The plan's acceptance criteria assumed any repeat `seed:coordinator` invocation would exit non-zero with an "already registered" message. In practice, Supabase's `inviteUserByEmail` resends successfully (exit 0, same user id) for a still-*pending* invite, and only rejects once the target user has actually confirmed via the link.
- **Fix:** No code change was needed — `scripts/seed-coordinator.ts` behaves correctly either way (never creates a duplicate). Re-verified the true rejection path after the human confirmed Task 3 (i.e., after the coordinator's account became confirmed), which produced the expected non-zero exit and message.
- **Files modified:** none
- **Verification:** Two verification runs, documented above under Accomplishments and coverage `D5`.
- **Committed in:** N/A (verification-only, no code change)

---

**Total deviations:** 2 (1 environment/blocking-issue fix requiring human dashboard action, 1 corrected verification-ordering assumption). Neither required a code change to `scripts/seed-coordinator.ts` — the script was never modified from its original plan-spec content throughout this entire closure.
**Impact on plan:** No scope creep. Both deviations were necessary to get from "plan text as written" to "actually proven against the real system," which is exactly what this closure pass was for.

## Issues Encountered

- The original blocker (documented in STATE.md prior to this session): Supabase Auth's `admin.inviteUserByEmail` failed with an HTTP 500 (`unexpected_failure`, "Error sending invite email") due to broken SMTP delivery. The Coordenador geral's account was created via a one-off `admin.createUser({ email_confirm: true })` bypass at the time, explicitly leaving Task 2's and Task 3's real acceptance criteria unverified and this SUMMARY unwritten.
- Since then: custom SMTP was reconfigured through Resend with a verified `ectolab.org` sending domain, and email delivery was independently confirmed working during plan 01-04's checkpoint (a magic-link email was sent and used to sign in).
- This session closed the loop formally: the bypass account was deleted (with cascade confirmed), the real invite path was re-run and succeeded, the duplicate-invite safety property was verified in the correct two-stage order, and the human confirmed the invite-email template/redirect specifically works cleanly in production (the one thing plan 01-04's magic-link checkpoint had not exercised).

## User Setup Required

None further. The two dashboard actions this plan needed — the sign-up-disabled toggle / redirect allow-list (already done earlier in this plan's history) and the email send-rate-limit increase (done this session, 2/hour -> 30/hour) — are both already applied and confirmed working end-to-end.

## Next Phase Readiness

- AUTH-01 is now fully and formally proven end-to-end via both onboarding paths (magic-link re-request and real invite), in production, with no credential-setting screen anywhere. AUTH-04 remains proven per plan 01-04.
- The Coordenador geral has exactly one real, confirmed Supabase account (`d96c842a-4f13-4d39-8fc1-1409ab1731ad`) with a matching `public.profiles` row, created exclusively through the intended invite path — no bypass residue remains.
- **Phase 1 is now fully complete.** All four plans (01-01 scaffold, 01-02 profiles/RLS, 01-03 tracer + invite-only onboarding, 01-04 session persistence + deploy) are committed, summarized, and their checkpoints closed. Phase 2 (Role-Based Access Control) can proceed directly on top of the existing `public.profiles` table and proven auth/session stack.

---
*Phase: 01-project-scaffold-institutional-login*
*Completed: 2026-08-03*

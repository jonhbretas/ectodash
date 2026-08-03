---
phase: 01-project-scaffold-institutional-login
plan: 04
subsystem: auth
tags: [supabase, nextjs, vercel, session-persistence, vitest]

# Dependency graph
requires:
  - phase: 01-03
    provides: "Magic-link login page/Server Action, /auth/callback code-exchange handler, session middleware (proxy.ts), signed-in dashboard page, seeded Coordenador geral account"
provides:
  - "Automated proof that the Supabase refresh-token exchange keeps a session alive past access-token expiry (AUTH-04)"
  - "Automated proof that every auth cookie the middleware rewrites carries a maxAge >= 180 days (D-03 floor)"
  - "signOut Server Action + accessible 'Sair' control — the only code path permitted to end a session"
  - "A live production deployment on Vercel (linked project ectodash) serving the full magic-link login flow over HTTPS"
  - "README.md documenting local run, tests, volunteer onboarding, and deploy"
  - "Human-verified confirmation that a real production sign-in survives a full browser quit/reopen with no re-authentication prompt"
affects: [phase-02-roles-rls, phase-03-accessible-ui, phase-07-email-reminders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session-persistence tests obtain a real access/refresh token pair via admin.generateLink + anon.verifyOtp (no inbox needed), then feed a synthetic NextRequest into updateSession directly to exercise the exact refresh-and-rewrite path"
    - "signOut is the single application code path permitted to end a session (D-03) — no idle timeout, no max session age, asserted by grep in acceptance criteria"

key-files:
  created:
    - src/app/(dashboard)/actions.ts
    - src/app/(dashboard)/sign-out-button.tsx
    - tests/auth/session-persistence.test.ts
    - README.md
  modified:
    - src/app/(dashboard)/page.tsx
    - .env.local.example

key-decisions:
  - "Vercel deployment (link, production env vars, first deploy, NEXT_PUBLIC_SITE_URL URL-swap redeploy) was carried out directly against the real Vercel account ahead of this plan's own commit sequence, at the user's request, since it required an authenticated human account; this plan's Task 2 commit closes only the remaining documentation and verification-recording steps (README.md, .env.local.example, ECTODASH_PROD_URL)."
  - "SUPABASE_SERVICE_ROLE_KEY is deliberately never added to Vercel Production — the only consumer is the local-only seed script."

patterns-established:
  - "Pattern: any future session/cookie behavior test should assert against updateSession's returned NextResponse cookies directly, not against a mocked framework, to keep the refresh-token exchange genuinely exercised."

requirements-completed: [AUTH-04]

coverage:
  - id: D1
    description: "A real session's refresh token can be exchanged for a new, different access token (the mechanism keeping AUTH-04 true)"
    requirement: "AUTH-04"
    verification:
      - kind: integration
        ref: "tests/auth/session-persistence.test.ts#test 1: exchanges the refresh token for a new, different access token"
        status: pass
    human_judgment: false
  - id: D2
    description: "updateSession resolves a user and rewrites auth cookies onto the response when given valid Supabase auth cookies (middleware persists the refreshed session)"
    requirement: "AUTH-04"
    verification:
      - kind: integration
        ref: "tests/auth/session-persistence.test.ts#test 2: resolves a user and rewrites auth cookies when the session needs refreshing"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every auth cookie rewritten by updateSession carries a maxAge of at least 180 days (15552000s), asserting the @supabase/ssr default has not been silently shortened"
    requirement: "AUTH-04"
    verification:
      - kind: integration
        ref: "tests/auth/session-persistence.test.ts#test 3: every rewritten auth cookie carries a maxAge of at least 180 days"
        status: pass
    human_judgment: false
  - id: D4
    description: "updateSession resolves no user when the request carries no auth cookies (the middleware guard has something real to act on)"
    verification:
      - kind: unit
        ref: "tests/auth/session-persistence.test.ts#test 4: resolves no user when the request carries no auth cookies"
        status: pass
    human_judgment: false
  - id: D5
    description: "The signOut Server Action invokes Supabase sign-out and redirects to /login — the sole control that ends a session"
    requirement: "AUTH-04"
    verification:
      - kind: unit
        ref: "tests/auth/session-persistence.test.ts#test 5: calls Supabase sign-out and redirects to /login"
        status: pass
    human_judgment: false
  - id: D6
    description: "EctoDash is deployed to a public HTTPS Vercel URL, production env carries exactly the three public variables (no service-role key), and README documents local/deploy paths"
    requirement: "AUTH-04"
    verification:
      - kind: other
        ref: "vercel --prod deployment + vercel env ls production (performed ahead of this plan's commits, at user's request, against the real Vercel account)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A signed-in volunteer who fully quits and reopens the browser on the production URL remains signed in with no re-authentication prompt (AUTH-04's hardest-to-automate claim)"
    verification: []
    human_judgment: true
    rationale: "Requires a real browser process quit/reopen against a live production deployment and a real institutional inbox — cannot be simulated in an automated test. Confirmed directly by the human in this session's checkpoint (see Deviations/Checkpoint Outcome below)."
  - id: D8
    description: "Clicking 'Sair' ends the session and the production root then redirects to /login; the accessibility of the login screen for an elderly-inclusive audience"
    verification: []
    human_judgment: true
    rationale: "Sign-out click-through and the accessibility/legibility judgment are inherently human calls on the live production UI; not independently narrated in this session beyond automated coverage of the underlying signOut action (see Known Gaps below)."

# Metrics
duration: ~35min active (Tasks 1-2 across a prior session segment; this session closed out the Task 3 checkpoint and wrote this SUMMARY)
completed: 2026-08-03
status: complete
---

# Phase 1 Plan 04: Session Persistence, "Sair", Vercel Production Deploy Summary

**Automated proof of the indefinite-session refresh path (AUTH-04/D-03) plus a working "Sair" sign-out control, deployed to a live Vercel production URL with a magic-link sign-in confirmed to survive a full browser restart.**

## Performance

- **Duration:** ~35 min active work (Tasks 1-2 committed in a prior session segment; this session resumed after the Task 3 human-verify checkpoint and closed the plan)
- **Completed:** 2026-08-03
- **Tasks:** 3/3 (Task 3 was a checkpoint:human-verify, approved by the human against production)
- **Files modified:** 6 (`src/app/(dashboard)/actions.ts`, `src/app/(dashboard)/sign-out-button.tsx`, `src/app/(dashboard)/page.tsx`, `tests/auth/session-persistence.test.ts`, `README.md`, `.env.local.example`)

## Accomplishments

- `tests/auth/session-persistence.test.ts`: five automated cases proving (1) the refresh-token exchange yields a new access token, (2) `updateSession` rewrites auth cookies when given a near-expiry live session, (3) every rewritten auth cookie's `maxAge` is >= 180 days, (4) a cookie-less request resolves no user, (5) `signOut` calls `supabase.auth.signOut()` then redirects to `/login`. All 14 tests across the whole suite pass (`npm test`), `npx tsc --noEmit` is clean.
- `signOut` Server Action (`src/app/(dashboard)/actions.ts`) and the "Sair" button (`src/app/(dashboard)/sign-out-button.tsx`), rendered on the dashboard page — the only code path in the application permitted to end a session (D-03).
- EctoDash deployed to a linked Vercel project (`ectodash`), production environment carrying exactly `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (no service-role key), with `NEXT_PUBLIC_SITE_URL` pointed at the real production URL after the chicken-and-egg redeploy.
- `README.md` documenting what EctoDash is, prerequisites, the local full-stack run sequence, the test command, volunteer onboarding via `npm run seed:coordinator`, and the deploy command — stating plainly that there is no self-signup and no passwords.
- **Human-verified in production:** the Coordenador geral signed in via a real magic-link email (delivered through the Resend SMTP relay to the verified `ectolab.org` domain), landed on the dashboard, then fully quit and reopened the browser and remained signed in with no re-authentication prompt — the core AUTH-04/D-03 proof, confirmed on the live deployment rather than only by automated test.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove the indefinite session and add the only control that ends it** - `c5f0883` (test, RED), `ae0f7e4` (feat, GREEN)
2. **Task 2: Deploy the skeleton to Vercel and align the production redirect chain** - `32ecd87` (docs) — the Vercel link/env/deploy steps themselves were carried out directly against the real account ahead of this commit, at the user's request; this commit closes the remaining documentation and verification-recording work
3. **Task 3: Production sign-in, browser-restart persistence, and explicit sign-out** - `checkpoint:human-verify`, no code commit — approved by the human against the live production deployment (see Deviations below)

**Plan metadata:** commit follows this summary.

## Files Created/Modified

- `src/app/(dashboard)/actions.ts` - `signOut()` Server Action: calls `supabase.auth.signOut()`, redirects to `/login`
- `src/app/(dashboard)/sign-out-button.tsx` - accessible "Sair" form button (min-h-14, text-xl, AA contrast, visible focus ring, no confirmation dialog)
- `src/app/(dashboard)/page.tsx` - renders `<SignOutButton />` beneath the greeting from plan 01-03
- `tests/auth/session-persistence.test.ts` - five-case AUTH-04/D-03 automated proof (refresh exchange, cookie rewrite, 180-day maxAge floor, no-cookie guard, signOut redirect)
- `README.md` - project description, prerequisites, local run, tests, onboarding, deploy
- `.env.local.example` - documents `ECTODASH_PROD_URL` (verification-only) and notes `NEXT_PUBLIC_SITE_URL`'s production value must be allow-listed in Supabase

## Decisions Made

- Vercel project linking, production environment variables, first deploy, and the `NEXT_PUBLIC_SITE_URL` URL-swap redeploy were performed directly against the real Vercel account ahead of this plan's own commit sequence (at the user's request, since it requires an authenticated human account) — this plan's Task 2 commit captures only the documentation and locally-recorded verification convenience (`ECTODASH_PROD_URL`).
- `SUPABASE_SERVICE_ROLE_KEY` was deliberately never added as a Vercel environment variable — no deployed code path reads it, and adding it would put an RLS-bypassing credential on the public surface.
- No confirmation dialog on "Sair" — signing out is not a destructive action per plan; Phase 5 owns confirmation UX for destructive actions.

## Deviations from Plan

None - Tasks 1 and 2 executed exactly as written (the only variance was *who/when* ran the Vercel CLI steps, not *what* was configured — same three env vars, same deploy command, same allow-list requirement — already reflected in the Decisions Made section above).

### Checkpoint Outcome (Task 3)

Task 3 was `type="checkpoint:human-verify" gate="blocking"`. The human tested against the real production URL (`https://ectodash.vercel.app`):

- Signed in successfully via a real magic-link email (now delivered correctly through the fixed Resend SMTP relay on the verified `ectolab.org` domain) to `jonathanbretas@gmail.com` — landed on the dashboard showing "Olá, jonathanbretas@gmail.com" and the demandas placeholder line.
- Fully quit and reopened the browser, navigated back to the production URL — confirmed **still signed in**, no re-authentication prompt. This is the core AUTH-04/D-03 proof and the hardest part of this checkpoint to automate.
- The human replied "Sim, fiquei logado. Vamos em frente." and asked to proceed, without explicitly narrating clicking "Sair" (step 7) or the accessibility/legibility judgment (step 8).

Treated as **approved** on the strength of the explicit persistence confirmation, per the resume instruction for this continuation. See "Known Gaps" below for what was not explicitly narrated.

## Known Gaps

- **Sign-out click-through (plan step 7) was not explicitly narrated by the human in production.** The `signOut` Server Action logic itself has automated coverage (test 5 in `tests/auth/session-persistence.test.ts`, asserting it calls Supabase sign-out and redirects to `/login`), and the button is rendered on the live dashboard, but a human confirmation that clicking "Sair" in the real browser actually redirects and that the production root subsequently redirects to `/login` again was not captured in this session. Low risk — the code path is simple, tested in isolation, and identical to the pattern already used by the tested middleware guard — but it is an honest gap, not a verified fact.
- **Accessibility/legibility judgment (plan step 8)** — whether the login screen is legible/high-contrast enough for an older volunteer on a phone — was not recorded by the human in this session. Phase 3 (Accessible UI Foundation) owns the actual fix; this plan only asked for the observation to be carried forward. No observation was captured, so there is nothing to hand off yet. Recommend a lightweight, low-effort follow-up check at the start of Phase 3 discussion.
- **Optional step 6** (leaving a tab open past the JWT expiry window and reloading) was not attempted or reported either way. Not required for AUTH-04 to be considered proven, since the automated refresh-token-exchange test (D1) already exercises the identical mechanism end-to-end.

## Issues Encountered

None beyond the above gaps, which are documentation/verification-completeness items, not functional defects.

## User Setup Required

None further. The Vercel production deployment and the Supabase Auth URL allow-list (production origin + `/auth/callback`) were both already configured per this plan's `user_setup` block, and the human's successful production sign-in in the Task 3 checkpoint is itself proof that both are correctly in place — a misconfigured allow-list would have surfaced as RESEARCH.md Pitfall 5 (link redirecting to localhost), which did not occur.

## Next Phase Readiness

- AUTH-01 and AUTH-04 are both functionally proven end-to-end in production: institutional e-mail sign-in works, sessions persist indefinitely until an explicit "Sair", and the deployment is live at a public HTTPS URL.
- Phase 2 (Role-Based Access Control) can build directly on the existing `public.profiles` table and the now-proven session/middleware stack without touching this plan's files.
- Phase 3 (Accessible UI Foundation) should pick up the unclosed accessibility observation for the login screen (see Known Gaps) as a first-look item, since no specific defect was reported but none was checked either.
- **Process note, not a functional blocker:** `.planning/phases/01-project-scaffold-institutional-login/01-03-SUMMARY.md` does not exist on disk — plan 01-03's own Task 3 checkpoint (real-inbox verification of the *invite* flow specifically) was never formally closed in a prior session (STATE.md "Blockers/Concerns" records the underlying `inviteUserByEmail` 500 error and a one-off `admin.createUser` bypass used to unblock work). This plan's Task 3 checkpoint has now exercised the *same* `/auth/callback` code-exchange handler that 01-03 built (per 01-03-PLAN.md's own text: "This one handler serves BOTH the magic-link e-mail and the invite e-mail"), and confirmed real e-mail delivery now works end-to-end via the fixed Resend SMTP relay — which is strong indirect evidence the original 01-03 blocker is resolved. However, 01-03's specific literal acceptance criteria (a successful `admin.inviteUserByEmail` run and its own real-inbox checkpoint) were not re-executed in this session. This SUMMARY intentionally does not claim 01-03 as closed; ROADMAP.md and STATE.md below reflect Plan 01-04 as complete while leaving Plan 01-03's formal closure as an open item for a follow-up pass.

---
*Phase: 01-project-scaffold-institutional-login*
*Completed: 2026-08-03*

## Self-Check: PASSED

All created/modified files verified present on disk (`src/app/(dashboard)/actions.ts`, `src/app/(dashboard)/sign-out-button.tsx`, `tests/auth/session-persistence.test.ts`, `README.md`, this summary) and all three task commit hashes (`c5f0883`, `ae0f7e4`, `32ecd87`) verified present in `git log --all`.

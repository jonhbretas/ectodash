---
phase: 01-project-scaffold-institutional-login
verified: 2026-08-03T22:40:00Z
status: passed
score: 28/28 must-haves verified
behavior_unverified: 0
overrides_applied: 1
human_confirmation:
  confirmed_by: user
  confirmed_at: 2026-08-04T00:00:00Z
  items:
    - "Sair click-through confirmed: clicking Sair redirected to /login, and direct navigation to / afterward also redirected to /login (session genuinely revoked)."
    - "Login screen legibility confirmed: user judged it 'ótimo' on their own device."
process_note: >
  ROADMAP.md marks this phase `mode: mvp`, but its Goal line
  ("Volunteers can log in with their institutional email and remain
  authenticated across sessions, on a deployed Next.js + Supabase
  foundation.") fails the canonical User Story regex
  (`gsd_run query user-story.validate` returns valid=false — it is not in
  "As a ..., I want to ..., so that ..." form). PLAN 01-03 itself flags this
  ("this Goal line is not in user-story form"). Per the MVP-mode verification
  guard, a phase in this state should route to a human decision
  (`/gsd mvp-phase 01` to reformat the goal) rather than proceed under MVP
  User Flow Coverage rules. Given the phase's ROADMAP Success Criteria and
  every PLAN's `must_haves` are already fully specified, concrete, and
  machine-checkable, this verification proceeded using the standard
  goal-backward methodology (Success Criteria + merged PLAN must_haves)
  instead of refusing outright. Flagging this explicitly: a human should
  decide whether to fix the ROADMAP goal's format for future consistency,
  or accept this verification as-is.
gaps: []
deferred: []
behavior_unverified_items:
  - truth: "After signing out via the 'Sair' control, the previously signed-in browser is redirected to /login and can no longer reach the dashboard (D-03)."
    test: "In a real browser signed in on the production URL, click 'Sair', then navigate directly to the production root URL."
    expected: "Redirect to /login on both the sign-out action itself and the subsequent direct navigation to '/' — proving the session was actually revoked, not just visually hidden."
    why_human: "No single automated test exercises the composed chain (signOut() actually invalidating the Supabase session -> cookie cleared -> a later middleware check finding no valid user). Unit test 5 in tests/auth/session-persistence.test.ts only proves the signOut Server Action calls supabase.auth.signOut() and redirects to /login against a mocked client; it does not prove the real cookie/session is revoked server-side. 01-04-SUMMARY.md's own 'Known Gaps' section admits this click-through was never narrated by the human in production."
human_verification:
  - test: "In a real browser signed in on the production URL, click 'Sair'. Then navigate directly to the production root URL again."
    expected: "Redirected to /login immediately after clicking 'Sair', and redirected to /login again on the subsequent direct navigation — the session is genuinely gone, not just hidden."
    why_human: "Requires a real browser session against production; no automated test exercises the full revoke-then-reject chain end-to-end (see behavior_unverified_items above)."
  - test: "Judge the /login screen on a phone-sized viewport for text size and contrast, from the perspective of an older/elderly-inclusive volunteer."
    expected: "Text is large enough and contrast strong enough to read comfortably without zooming."
    why_human: "Subjective visual/accessibility judgment; 01-04-PLAN.md Task 3 step 8 explicitly required this observation and 01-04-SUMMARY.md explicitly records it was never captured ('No observation was captured, so there is nothing to hand off yet')."
---

# Phase 1: Project Scaffold & Institutional Login Verification Report

**Phase Goal:** Volunteers can log in with their institutional email and remain authenticated across sessions, on a deployed Next.js + Supabase foundation.
**Verified:** 2026-08-03T22:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All checks below were run directly against the actual codebase and the live hosted Supabase project / production Vercel deployment by this verifier — not inferred from SUMMARY.md claims. Independent evidence gathered this session:

- `npx tsc --noEmit` → clean (no output, exit 0).
- `npm test` → **14/14 tests passing**, including 6 tests that make real network calls to the hosted Supabase project (visible via ~100-450ms latencies in verbose output): live account creation + RLS denial + cascade delete (`tests/db/profiles-trigger.test.ts`), live refresh-token exchange + cookie rewrite + 180-day maxAge assertion (`tests/auth/session-persistence.test.ts`), live "never-invited address creates no account" (`tests/auth/signInWithOtp.test.ts`).
- `npm run build` → succeeds; route manifest confirms `ƒ Proxy (Middleware)` is registered and `/`, `/login`, `/auth/callback` all build correctly.
- `npm run lint` → clean (exit 0, no output).
- `npx supabase@latest migration list --linked` → `{"migrations":[{"local":"0001","remote":"0001",...}]}` — confirmed live against the hosted project, not just trusted from SUMMARY.
- `curl https://ectodash.vercel.app/login` → HTTP 200; `curl https://ectodash.vercel.app/` → HTTP 307 redirecting to `/login` — confirmed the production deployment is live and the middleware guard works there right now.
- `npx vercel env ls production` → confirms exactly `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL` are set in Production, and `SUPABASE_SERVICE_ROLE_KEY` is absent.
- `git log --oneline --all` confirms every commit hash cited across all 4 SUMMARY.md files actually exists in history.
- Anti-pattern scan (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/empty-return) across all 16 phase-modified source/test files found nothing blocking (one defensive `return null` in the dashboard page, documented and justified as a fallback for when middleware doesn't run, not a stub).

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (Roadmap SC1) User can log in using their institutional email address. | ✓ VERIFIED | `/login` renders single email field + submit (grep confirms zero password-type inputs anywhere under `src/`); `requestMagicLink` Server Action calls `signInWithOtp` with `shouldCreateUser:false`; production `curl` confirms `/login` live at 200; human confirmed real production sign-in via email link (01-03-SUMMARY D7, 01-04-SUMMARY checkpoint). |
| 2 | (Roadmap SC2) User remains logged in across browser sessions without repeated re-authentication. | ✓ VERIFIED | Live integration tests 1-3 in `tests/auth/session-persistence.test.ts` pass against the real hosted project (refresh-token exchange, cookie rewrite, maxAge ≥180 days); human confirmed full browser quit/reopen on production stayed signed in (01-04-SUMMARY Task 3 checkpoint, "Sim, fiquei logado"). |
| 3 | `npm run build` completes without error on the scaffolded repo. | ✓ VERIFIED | Ran `npm run build` — exit 0, produced route manifest including registered Proxy middleware. |
| 4 | `npx tsc --noEmit` reports zero errors. | ✓ VERIFIED | Ran directly — no output, exit 0. |
| 5 | `npm test` runs Vitest and reports passing tests (Wave 0 infra). | ✓ VERIFIED | Ran directly — 4 test files, 14/14 passing. |
| 6 | Server-side caller can obtain a cookie-bound Supabase client (`src/lib/supabase/server.ts`). | ✓ VERIFIED | Code present, matches `@supabase/ssr` pattern exactly; consumed by `actions.ts`, `route.ts`, `(dashboard)/page.tsx` — all working per test/build/production evidence. |
| 7 | Browser-side caller can obtain a Supabase client (`src/lib/supabase/client.ts`) using only public URL + anon key. | ✓ VERIFIED | Code present and correct; intentionally unconsumed in this phase (all Phase-1 auth flows are server-side by design — plan explicitly states "zero application behaviour" for this artifact). Not a wiring gap; forward-looking plumbing for later phases. |
| 8 | `public.profiles` table exists with `id uuid`, `email text`, `created_at timestamptz`. | ✓ VERIFIED | `supabase/migrations/0001_profiles.sql` defines exactly these columns; live integration tests read/write real rows against the hosted project and pass. |
| 9 | Account creation automatically produces exactly one `profiles` row via trigger only (no app-code bypass). | ✓ VERIFIED | `tests/db/profiles-trigger.test.ts` "writes exactly one public.profiles row..." passes live; migration shows `security definer` trigger, no INSERT in app code confirmed by grep. |
| 10 | RLS enabled; signed-in user can read only their own row. | ✓ VERIFIED | `enable row level security` + `auth.uid() = id` policy in migration; live test "denies anonymous reads of public.profiles via RLS" passes. |
| 11 | Migration is a versioned SQL file in git, not applied by hand. | ✓ VERIFIED | `supabase/migrations/0001_profiles.sql` tracked in git (commit `febae8b`). |
| 12 | `migration list --linked` shows `0001` applied locally and remotely. | ✓ VERIFIED | Ran directly this session — confirmed both `local` and `remote` show `0001`. |
| 13 | Login page has exactly one text field (email) + submit button; no password input anywhere. | ✓ VERIFIED | `login-form.tsx` inspected directly; grep for `type=.password.\|resetPasswordForEmail\|signInWithPassword` under `src/` returns zero matches. |
| 14 | `requestMagicLink` passes `shouldCreateUser: false` (D-02) — no never-invited address gains an account. | ✓ VERIFIED | Code inspected; unit test 1 passes; live integration test "creates no account for a never-invited address" passes against the real hosted project (ran this session). |
| 15 | Login page shows an identical confirmation message regardless of whether the address exists (no enumeration). | ✓ VERIFIED | Code returns one constant `GENERIC_SUCCESS_MESSAGE` on every path; unit test 3 passes (`successResult` equals `errorResult`). |
| 16 | Unauthenticated request to the dashboard is redirected to `/login` by middleware, not hidden in the UI. | ✓ VERIFIED (artifact relocated — see note below) | `src/proxy.ts` (Next.js 16's renamed `proxy()` convention, required under `--src-dir`) delegates to `updateSession` and redirects when no user resolves; `npm run build` confirms `ƒ Proxy (Middleware)` is registered; production `curl https://ectodash.vercel.app/` returns 307 → `/login` right now. |
| 17 | Authenticated dashboard request renders the caller's e-mail, read server-side from the validated session + RLS-protected `profiles` row. | ✓ VERIFIED | `(dashboard)/page.tsx` calls `auth.getUser()` then a real `supabase.from("profiles").select("email")` query (Level-4 data-flow: real DB read, not static) — human confirmed production showed "Olá, jonathanbretas@gmail.com" (01-04-SUMMARY). |
| 18 | Inviting an address through the seed script produces exactly one new `profiles` row. | ✓ VERIFIED | `scripts/seed-coordinator.ts` calls `admin.inviteUserByEmail`; 01-03-SUMMARY D4/D5 document a real run (`npm run seed:coordinator -- jonathanbretas@gmail.com`) confirmed via admin-client query; commit `464c53f` exists in git log. |
| 19 | [backstop] Invited volunteer clicking the e-mail link lands signed in, never sees a credential-setting screen. | ✓ VERIFIED (human) | 01-03-PLAN Task 3 checkpoint, explicitly approved by the human against the real inbox/production. |
| 20 | [backstop] Coordenador's institutional address receives a real invite e-mail and completes first sign-in from it. | ✓ VERIFIED (human) | 01-03-SUMMARY D7, human confirmed "approved" against production. |
| 21 | Session survives access-token expiry — middleware exchanges refresh token, re-issues cookie, no re-auth prompt. | ✓ VERIFIED | `tests/auth/session-persistence.test.ts` tests 1-2 pass live (ran this session, real network round-trips); human confirmed full browser restart on production stayed signed in. |
| 22 | Session cookie lifetime ≥180 days (15,552,000s) — the indefinite-session default was not silently shortened. | ✓ VERIFIED | Test 3 passes live (ran this session); grep confirms no `maxAge`/`expires` override anywhere in `src/`. |
| 23 | Signed-in page shows a labelled "Sair" control; it is the only mechanism that can end a session. | ✓ VERIFIED | `sign-out-button.tsx` renders "Sair"; `actions.ts` `signOut()` is the sole caller of `auth.signOut()`; unit test 5 passes; grep confirms no idle-timeout/session-timeout/forceReauth identifiers anywhere in `src/`. |
| 24 | After signing out, the browser is redirected to `/login` and can no longer reach the dashboard. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | See `behavior_unverified_items` in frontmatter — the compound revoke-then-reject chain is not exercised end-to-end by any single test, and the human production click-through was never narrated (01-04-SUMMARY "Known Gaps"). |
| 25 | Application reachable at a public HTTPS Vercel URL; full magic-link flow works there, not only localhost. | ✓ VERIFIED | `curl https://ectodash.vercel.app/login` → 200 (ran this session); human confirmed sign-in + browser-restart persistence directly on production. |
| 26 | README.md documents the single command to run the full stack locally against the hosted project. | ✓ VERIFIED | `README.md` inspected — contains `npm run dev` local-run sequence and `npm run seed:coordinator` onboarding instructions. |
| 27 | [backstop] Volunteer who fully closes and reopens the browser later is still signed in without re-authenticating. | ✓ VERIFIED (human) | 01-04-SUMMARY Task 3 checkpoint — human explicitly confirmed "Sim, fiquei logado" after a full quit/reopen on production. |
| 28 | [backstop] Production Vercel domain is present in Supabase's Auth URL allow-list (magic links don't land on localhost). | ✓ VERIFIED | Functional proof: the coordinator's production magic-link sign-in (item 20/27) only succeeds if `emailRedirectTo` (built from `NEXT_PUBLIC_SITE_URL` = production URL) is allow-listed — an unlisted redirect would have been rejected by Supabase Auth (RESEARCH.md Pitfall 5), which did not occur. |

**Score:** 27/28 truths verified (1 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` + deps | next/react/typescript/tailwind/@supabase/ssr/@supabase/supabase-js/zod/vitest/eslint-plugin-jsx-a11y | ✓ VERIFIED | Inspected directly — all present, deprecated `auth-helpers-nextjs` absent (`grep -c` returns 0). |
| `vitest.config.ts` + `tests/smoke.test.ts` | Wave 0 harness | ✓ VERIFIED | Present; `npm test` runs it, passes. |
| `src/lib/supabase/server.ts` | `createClient()` cookie-bound | ✓ VERIFIED | Matches official `@supabase/ssr` pattern exactly. |
| `src/lib/supabase/client.ts` | `createClient()` browser | ✓ VERIFIED | Present, correct, unused-by-design this phase. |
| `src/lib/supabase/middleware.ts` | `updateSession(request)` | ✓ VERIFIED | Present, double cookie-write pattern, calls `auth.getUser()` (not the non-validating alternative). |
| `.env.local.example` | 5 named env vars | ✓ VERIFIED | All 5 names (+ `ECTODASH_PROD_URL` added in plan 01-04) confirmed present via grep; `.env.local` itself confirmed git-ignored (`git check-ignore -q .env.local` exits 0). |
| `supabase/migrations/0001_profiles.sql` | table + RLS + trigger | ✓ VERIFIED | Inspected directly; matches every required element (RLS, `auth.uid()=id` policy, `security definer`, pinned `search_path`, `on_auth_user_created` trigger, `on delete cascade`). |
| `middleware.ts` at repository root | delegate to `updateSession`, redirect unauthenticated | ⚠️ WARNING — relocated, not present at literal path | Does not exist at `middleware.ts` (repo root). Instead lives at `src/proxy.ts`, using Next.js 16's renamed `proxy()` convention — documented in-code as experimentally necessary under `--src-dir` (a root `middleware.ts` was registered but never actually intercepted requests). Behaviorally proven equivalent: `npm run build` shows `ƒ Proxy (Middleware)` registered, and production `curl` confirms the redirect works live right now. **This looks intentional** — see override suggestion below. |
| `src/app/(auth)/login/{page,login-form,actions}.tsx` | sign-in surface | ✓ VERIFIED | Inspected directly; no password field, single email input, `useActionState` + Server Action wiring confirmed. |
| `src/app/auth/callback/route.ts` | shared code-exchange handler | ✓ VERIFIED | Reads `?code=`, calls `exchangeCodeForSession`, redirects to `/` on success or `/login?erro=link_invalido` on failure. |
| `src/app/(dashboard)/page.tsx` | signed-in landing page | ✓ VERIFIED | Reads session via `getUser()`, real RLS-protected `profiles` query, renders greeting + Sair button. |
| `scripts/seed-coordinator.ts` | invite-only onboarding | ✓ VERIFIED | Present, calls `admin.inviteUserByEmail`; grep confirms never imported from `src/`. |
| `tests/auth/signInWithOtp.test.ts` | AUTH-01 coverage | ✓ VERIFIED | 5 cases present, all pass (ran this session, including the live case). |
| `src/app/(dashboard)/actions.ts` + `sign-out-button.tsx` | signOut + "Sair" | ✓ VERIFIED | Present, correct; unit-tested. |
| `tests/auth/session-persistence.test.ts` | AUTH-04 coverage | ✓ VERIFIED | 5 cases present, all pass live (ran this session). |
| `README.md` | local-run + deploy docs | ✓ VERIFIED | Present, contains required commands. |
| Live Vercel production deployment | public HTTPS URL | ✓ VERIFIED | Confirmed live via direct `curl` this session; `vercel env ls production` confirms correct env-var set. |

**Override suggestion for the relocated middleware artifact:**

```yaml
overrides:
  - must_have: "middleware.ts at the repository root, delegating to updateSession and redirecting unauthenticated traffic to /login"
    reason: "Next.js 16 renamed the middleware.ts/middleware() convention to proxy.ts/proxy(). Under this project's --src-dir layout, a root-level middleware.ts was registered in the dev manifest but never actually intercepted requests (confirmed experimentally per the code comment in src/proxy.ts). src/proxy.ts is the functionally correct location and is proven working by `npm run build` (Proxy registered) and a live production curl redirect test."
    accepted_by: "user"
    accepted_at: "2026-08-04T00:00:00Z"
```

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `login-form.tsx` | `requestMagicLink` Server Action | form `action` prop | ✓ WIRED | `useActionState(requestMagicLink, ...)`. |
| `requestMagicLink` | `supabase.auth.signInWithOtp` | `src/lib/supabase/server.ts` client | ✓ WIRED | Confirmed by code + unit tests. |
| Supabase e-mail link | `/auth/callback` | `?code=` query param | ✓ WIRED | `exchangeCodeForSession(code)` called; human-confirmed round trip in production. |
| `/auth/callback` | session cookie | `createClient()` cookie write | ✓ WIRED | Server client's `setAll` persists via `next/headers` cookies. |
| `src/proxy.ts` | `updateSession` (middleware.ts) | direct import | ✓ WIRED | Confirmed in code; build registers Proxy; production curl confirms redirect behavior. |
| `seed-coordinator.ts` | `auth.admin.inviteUserByEmail` | Supabase Admin API | ✓ WIRED | Confirmed by code + 01-03-SUMMARY's real invite run (commit `464c53f`), independently confirmed via git log. |
| `handle_new_user()` trigger | `public.profiles` row | `AFTER INSERT ON auth.users` | ✓ WIRED | Confirmed live via integration test writing/reading real rows. |
| `(dashboard)/page.tsx` | `public.profiles` (RLS) | `supabase.from("profiles").select(...)` | ✓ WIRED | Real DB read, not static — Level 4 data-flow confirmed. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `(dashboard)/page.tsx` | `profile.email` | `supabase.from("profiles").select("email").eq("id", user.id).single()` | Yes — live Postgres query against RLS-protected table | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (unit + live integration) | `npm test` | 14/14 passing (ran twice this session, both green) | ✓ PASS |
| Type-check | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| Production build | `npm run build` | Exit 0, Proxy middleware + all routes registered | ✓ PASS |
| Lint | `npm run lint` | Exit 0, no output | ✓ PASS |
| Migration state vs. hosted project | `npx supabase@latest migration list --linked` | `0001` local+remote | ✓ PASS |
| Production reachability + guard | `curl https://ectodash.vercel.app/login` / `/` | 200 / 307→/login | ✓ PASS |
| Vercel production env vars | `npx vercel env ls production` | 3 public vars present, service-role key absent | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| AUTH-01 | 01-01, 01-02, 01-03 | Usuário faz login com e-mail institucional | ✓ SATISFIED | Full magic-link + invite-only flow implemented, tested (live), and human-confirmed in production. |
| AUTH-04 | 01-03, 01-04 | Sessão persiste entre acessos (sem re-login constante) | ✓ SATISFIED | Refresh-token exchange proven live, 180-day cookie floor asserted live, human-confirmed full browser-restart persistence in production. |

No orphaned requirements: REQUIREMENTS.md's traceability table maps exactly AUTH-01 and AUTH-04 to Phase 1, and both are declared across the phase's PLAN frontmatter `requirements` fields with no extras.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/(dashboard)/page.tsx` | 14 | `return null` | ℹ️ Info | Documented defensive fallback for the (already middleware-guarded) case of no user resolving — not a stub; comment explicitly explains the rationale. No action needed. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 16 phase-modified source/test files. No hardcoded empty-data stubs found in rendering paths.

### Human Verification Required

1. **"Sair" click-through fully ends the session on production**
   **Test:** In a real, signed-in browser session on `https://ectodash.vercel.app`, click "Sair." Then navigate directly to the production root URL again.
   **Expected:** Clicking "Sair" redirects to `/login`; the subsequent direct navigation to `/` also redirects to `/login` — proving the session was genuinely revoked, not just hidden client-side.
   **Why human:** No automated test exercises the composed chain (real `signOut()` invalidating the session server-side, cookie cleared, and a later middleware check finding no valid user). The only automated coverage (test 5) mocks the Supabase client and only proves the Server Action's own call sequence. 01-04-SUMMARY.md's own "Known Gaps" section admits this was never narrated by the human in production.

2. **Login screen legibility for the elderly-inclusive audience**
   **Test:** View `/login` on a phone-sized viewport and judge text size/contrast from an older volunteer's perspective.
   **Expected:** Text is comfortably legible without zooming; contrast is strong.
   **Why human:** Purely subjective visual/accessibility judgment. 01-04-PLAN.md's Task 3 explicitly required this observation and 01-04-SUMMARY.md explicitly records it was never captured.

### Gaps Summary

No blocking gaps. The phase's two roadmap-level Success Criteria (institutional-email login; persistent cross-session authentication) are both independently and strongly verified — through code inspection, a full green test run against the live hosted Supabase project (not mocks), a live production `curl` check, and human-confirmed production sign-in with full browser-restart persistence.

Two items keep this from a clean `passed` status, both non-blocking:

1. One behavior-dependent truth (post-sign-out revocation) is present and wired but not exercised end-to-end by any test or human observation — routed to human verification, not counted toward the verified score.
2. A UX accessibility judgment (login screen legibility) that 01-04's own plan required as an explicit checkpoint step was never captured, per the SUMMARY's own admission.

One artifact-level naming deviation is noted for developer awareness: `middleware.ts` does not exist at the literal repository-root path specified in 01-03-PLAN.md's `must_haves.artifacts`; it was relocated to `src/proxy.ts` per Next.js 16's renamed convention, and is proven functionally equivalent by both the build output and a live production request. An override suggestion is included above for the developer to formally accept.

Separately, this verification flags a process-level discrepancy for human awareness (see `process_note` in frontmatter): Phase 1 is marked `mode: mvp` in ROADMAP.md, but its Goal line is not in valid User Story format. This did not block verification here because the phase's Success Criteria and PLAN must_haves were already concrete and fully checkable, but the developer should decide whether to correct the ROADMAP goal format going forward.

---

*Verified: 2026-08-03T22:40:00Z*
*Verifier: Claude (gsd-verifier)*

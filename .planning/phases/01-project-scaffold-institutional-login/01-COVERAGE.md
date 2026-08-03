# API Coverage — Supabase Auth (`@supabase/supabase-js` + `@supabase/ssr`)

**Phase:** 1 — Project Scaffold & Institutional Login
**Generated:** 2026-08-03

> Full coverage by default. Every capability starts as INTEGRATE; each OPT-OUT below is an explicit, reasoned decision rather than an un-enumerated hole. This matrix persists — a later phase extending Supabase Auth starts from these decisions, not from zero.

Scope note: this matrix covers the Supabase **Auth** surface as it bears on this phase (AUTH-01 institutional-email login, AUTH-04 session persistence) under the three locked decisions D-01 (magic link only, no passwords), D-02 (invite-only, no self-signup) and D-03 (session ends only on explicit sign-out). The Supabase Postgres/PostgREST surface is covered incidentally through `public.profiles` and is re-decided in Phase 2 when RLS becomes the authorization boundary.

| capability | decision | reason |
|---|---|---|
| `auth.signInWithOtp` — magic link by e-mail | INTEGRATE | |
| `signInWithOtp` `shouldCreateUser: false` lockdown | INTEGRATE | |
| `signInWithOtp` `emailRedirectTo` (server-controlled) | INTEGRATE | |
| `auth.exchangeCodeForSession` — PKCE code exchange in the callback | INTEGRATE | |
| `auth.admin.inviteUserByEmail` — the only account-creation path | INTEGRATE | |
| `auth.admin.generateLink` (type `magiclink`) | INTEGRATE | used by the session-persistence test to obtain a real session without an inbox |
| `auth.verifyOtp` with `token_hash` — redeeming a generated link | INTEGRATE | test-path only in this phase; the user-facing flow is link-click plus code exchange |
| `auth.getUser` — server-side session validation | INTEGRATE | |
| `auth.refreshSession` / refresh-token rotation | INTEGRATE | the mechanism behind AUTH-04 and D-03 |
| Cookie session management via `@supabase/ssr` `createServerClient` / `createBrowserClient` (`getAll` / `setAll`) | INTEGRATE | |
| Middleware-driven session refresh and cookie rewrite | INTEGRATE | |
| `auth.signOut` — explicit "Sair" | INTEGRATE | |
| Auth e-mail templates — Magic Link and Invite user | INTEGRATE | rewritten into plain Brazilian Portuguese |
| Auth URL Configuration — Site URL and redirect allow-list | INTEGRATE | |
| Dashboard toggle "Allow new users to sign up" (OFF) | INTEGRATE | defence-in-depth layer for D-02 |
| RLS via `auth.uid()` on `public.profiles` | INTEGRATE | |
| `auth.admin.createUser` / `auth.admin.deleteUser` | INTEGRATE | test-fixture path only — never wired to a user-facing surface |
| `auth.getSession` (non-validating session read) | OPT-OUT | deliberately unused — it does not validate against the Auth server and never exercises the refresh token, which silently breaks D-03 (RESEARCH.md Pitfall 3) |
| `verifyOtp` with a 6-digit code typed by the user | OPT-OUT | not needed — D-01 chose a link-only flow; a code-entry screen adds a step for an audience that struggles with transcription |
| `auth.signUp` (e-mail + password) | OPT-OUT | explicitly out of scope — D-01 forbids passwords and D-02 forbids self-signup |
| `auth.resetPasswordForEmail` | OPT-OUT | explicitly out of scope — there is no credential to reset (D-01) |
| `auth.updateUser` for credential changes | OPT-OUT | explicitly out of scope — there is no credential to change (D-01) |
| `auth.signInWithOAuth` — Google/GitHub/social providers | OPT-OUT | not needed — AUTH-01 requires institutional e-mail identity; a social provider would let a personal account in through a side door |
| `auth.signInWithSSO` — SAML enterprise SSO | OPT-OUT | not needed — the institution has no SAML IdP; magic link to the institutional address is the identity assertion |
| Phone / SMS OTP (`signInWithOtp` with `phone`) | OPT-OUT | explicitly out of scope — REQUIREMENTS.md excludes SMS/WhatsApp channels; e-mail is the institution's standard channel |
| `auth.mfa.*` — multi-factor enrolment and challenge | OPT-OUT | not needed yet — not required by AUTH-01/AUTH-04, and a second factor is real friction for an elderly-inclusive volunteer base; revisit only if financial data exposure (Phase 10) changes the risk calculus |
| `auth.signInAnonymously` | OPT-OUT | explicitly out of scope — the system is invite-only by D-02; an anonymous identity has nothing it may read |
| `auth.admin.listUsers` / `updateUserById` — user-management UI | OPT-OUT | not needed yet — a coordinator-facing invite and management screen is Phase 2's work, once a role model exists to gate it (01-CONTEXT.md, Claude's Discretion) |
| Auth Hooks — custom access-token claims | OPT-OUT | not needed yet — Phase 2 decides between JWT role claims and a profiles-table lookup; committing to a claims shape now would prejudge that |
| `auth.onAuthStateChange` — client-side session listener | OPT-OUT | not needed — auth state is resolved server-side by middleware and Server Components; there is no client-side session UI in v1 |
| Custom SMTP provider for Auth e-mails | OPT-OUT | not needed yet — Supabase's built-in sender covers Phase-1 invite volume; revisit if the free-tier auth-email rate limit is reached |
| Identity linking (`auth.linkIdentity` / `unlinkIdentity`) | OPT-OUT | not needed — a volunteer has exactly one institutional e-mail identity; there is no second provider to link |
| Third-party / external JWT auth integration | OPT-OUT | explicitly out of scope — Supabase Auth is the sole identity source, per the locked project stack constraint |

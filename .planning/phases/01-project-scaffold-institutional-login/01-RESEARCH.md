# Phase 1: Project Scaffold & Institutional Login - Research

**Researched:** 2026-08-03
**Domain:** Next.js 16 App Router scaffold + Supabase Auth (magic link) + Vercel deployment — first phase of a greenfield project
**Confidence:** MEDIUM-HIGH (official Supabase/Next.js docs cross-checked via WebSearch, no Context7 MCP available in this environment; package versions and CLI/tool availability directly verified via `npm view` and local shell probes)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Login is via magic link (e-mail only, no password) — no password field, no password-reset flow needed. Chosen for the elderly-heavy volunteer audience, who are prone to forgetting passwords.
- **D-02:** No self-signup. Coordenador geral manually registers/invites each volunteer's institutional e-mail; the volunteer receives an invite and logs in via magic link from then on. There is no public registration screen. — **Reversibility:** costly — switching to self-signup later means adding a public signup flow and deciding how to retroactively validate existing manually-added accounts.
- **D-03:** Session does not expire on its own — user stays logged in until they explicitly click "sair" (logout). No idle timeout, no forced re-login after N days.

### Claude's Discretion

- Exact Supabase Auth configuration (magic link template copy, invite e-mail template, session/cookie implementation details) — implementer's call, as long as it satisfies D-01/D-02/D-03.
- Whether coordinator invite UI ships in this phase or is a minimal seed/admin script — Phase 1 only requires that a coordinator account can get in; a full "invite volunteer" UI screen can be part of Phase 2 (roles) if it's more natural there, since Phase 1 has no role model yet.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| AUTH-01 | Usuário faz login com e-mail institucional | Standard Stack + Architecture Patterns 1-3 (magic link via `signInWithOtp` + `@supabase/ssr` cookie session); Pitfall 1 (auto-signup lockdown) ensures only institutional/invited emails can actually log in |
| AUTH-04 | Sessão persiste entre acessos (sem re-login constante) | Architecture Pattern 4 + "Session Persistence" findings below — default Supabase refresh-token rotation + `@supabase/ssr`'s ~1-year cookie already satisfies "no auto-expiry"; Pitfall 3 flags the one place this can silently break |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Vercel + Supabase free tier only — avoid paid services; do not introduce infra that requires a paid plan in this phase.
- **Accessibility/UX:** audience includes many elderly users — even the "minimal" login screen must use legible font sizes/contrast and avoid jargon (full design system is Phase 3, but don't ship something actively hostile to this audience now).
- **No self-signup surface** (from AUTH domain in REQUIREMENTS.md context) — reinforces D-02.

## Summary

This phase scaffolds the Next.js 16 project and stands up Supabase Auth using **magic link (passwordless OTP)** as the only sign-in method, wired through `@supabase/ssr` for cookie-based sessions in the App Router, and deployed to Vercel. The three locked decisions (D-01 magic link, D-02 no self-signup, D-03 indefinite session) map cleanly onto well-documented Supabase primitives — but each has a **default-behavior trap** that silently violates the decision unless explicitly configured:

1. **D-02 is not free by default.** `supabase.auth.signInWithOtp()` auto-creates a new user for any email typed into the form unless `options.shouldCreateUser: false` is explicitly passed. Without this, the "no self-signup" decision is silently defeated by the login form itself — anyone with any email could type it in and get an account. This must be set in the login Server Action, and public signup must also be disabled in the Supabase Dashboard (Authentication → Providers → Email → "Allow new users to sign up" OFF) as defense-in-depth.
2. **D-03 is mostly free by default, but verify it.** Supabase refresh tokens never expire (single-use rotation) and `@supabase/ssr` sets cookies with ~1 year `maxAge` by default — so `autoRefreshToken` + `persistSession` (both on by default) already deliver "stay logged in indefinitely." The main risk is a bug or manual override that shortens cookie `maxAge`, or forgetting to run `supabase.auth.getUser()` in middleware, which silently stops the refresh from happening at all.
3. **D-01 needs the invite flow to bypass password entirely.** `supabase.auth.admin.inviteUserByEmail()` (the standard "no self-signup" onboarding primitive) defaults to a flow that expects the invited user to *set a password*. Since this project never uses passwords, the auth callback route must treat the invite-confirmation link exactly like a magic-link login (establish a session, redirect straight into the app) — it must never route to a "set your password" screen.

The walking-skeleton scope for this phase (per CONTEXT.md: MVP mode, thinnest end-to-end slice) is: `create-next-app` scaffold → Supabase project + `profiles` table with a `handle_new_user` trigger (the "one real Supabase read/write") → magic-link login page + `/auth/callback` route handler → middleware-based session refresh → one coordinator account manually invited/seeded → deployed to Vercel with the Supabase↔Vercel env-var integration. Role logic, RLS, and any invite UI are explicitly deferred to Phase 2.

**Primary recommendation:** Use `@supabase/ssr` (never the deprecated `auth-helpers-nextjs`), lock `signInWithOtp` to `shouldCreateUser: false`, and treat both the magic-link callback and the invite-acceptance callback as the same "establish session and go" code path — no password screen anywhere in this app.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login form (email input, submit) | Frontend Server (SSR) | Browser/Client | Rendered as a Server Component with a Server Action handling submit; only a thin client boundary needed for form interactivity/pending state |
| Magic-link / invite verification | API/Backend | — | `/auth/callback` Route Handler exchanges the emailed code/token for a session — must run server-side (Supabase secrets, cookie writes) |
| Session cookie issuance & refresh | Frontend Server (SSR) | Browser/Client | Next.js `middleware.ts` calls `supabase.auth.getUser()` on every request to refresh and rewrite cookies; browser only stores/sends them |
| Session persistence (indefinite) | Database/Storage | Frontend Server (SSR) | Refresh-token validity/rotation lives in Supabase's Auth schema (Postgres); the cookie is just a pointer to it |
| Coordinator/volunteer invite | API/Backend | — | `auth.admin.inviteUserByEmail()` requires the service-role key — must run in a server-only script or protected server action, never in browser code |
| `profiles` row creation | Database/Storage | — | A Postgres trigger (`handle_new_user`) on `auth.users` insert — zero application code, so it can't be bypassed by any auth path (magic link or invite) |
| Deployment/hosting | CDN/Static | Frontend Server (SSR) | Vercel serves static assets via CDN/edge and runs Server Components/Actions/Route Handlers in its Node/Edge runtime |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.12 [VERIFIED: npm registry] | Full-stack React framework, App Router, Route Handlers, Server Actions | Vercel-native, zero-config deploy; matches project-level STACK.md recommendation |
| React / react-dom | 19.2.8 [VERIFIED: npm registry] | UI runtime | Bundled/required peer for Next.js 16.2 |
| TypeScript | 7.0.2 [VERIFIED: npm registry] | Type safety | Latest major on npm as of this research date — see Common Pitfalls for a compatibility flag on this specific major jump |
| Tailwind CSS | 4.3.3 [VERIFIED: npm registry] | Styling | Bundled by `create-next-app --tailwind`; matches project-level stack |
| `@supabase/supabase-js` | 2.112.0 [VERIFIED: npm registry] | Supabase JS client (auth, db, admin) | Official client, required base package |
| `@supabase/ssr` | 0.12.4 [VERIFIED: npm registry] | Cookie-based session handling for Next.js App Router | Current supported replacement for deprecated `@supabase/auth-helpers-nextjs` [CITED: supabase.com/docs/guides/auth/server-side/nextjs] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | latest 4.x [VERIFIED: npm registry — verdict OK] | Optional server-side email shape validation | Discretionary for this phase — the login form has one field (email); native HTML `type="email"` + a one-line regex/zod check server-side is enough. Skip `react-hook-form` entirely per project STACK.md guidance for 1-2 field forms. |
| `eslint-config-next` | bundled with Next 16.2 [ASSUMED — not independently version-pinned] | Lint | Ships with `create-next-app`; add `eslint-plugin-jsx-a11y` per project convention (accessibility is a hard requirement) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Magic link (`signInWithOtp`) | Email + password | Rejected by D-01 — passwords are a known friction/support-burden point for an elderly-heavy user base |
| `admin.inviteUserByEmail` seed script | Manual SQL insert into `auth.users` | Never do this — `auth.users` is a Supabase-managed table; inserting directly bypasses Auth's password/token hashing and email-confirmation invariants and is explicitly warned against in Supabase docs |
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | Deprecated — do not use; silently mishandles session cookies on current Next.js versions [CITED: project STACK.md] |

**Installation:**
```bash
npx create-next-app@latest ectodash --typescript --tailwind --eslint --app --src-dir
cd ectodash
npm install @supabase/supabase-js @supabase/ssr
npm install zod          # optional, discretionary
npm install -D eslint-plugin-jsx-a11y
```

**Version verification:** All Core versions above were checked directly via `npm view <pkg> version` on 2026-08-03 (see Package Legitimacy Audit below for the accompanying legitimacy check). Re-run this check if planning is picked up more than ~2 weeks after this research date — Next.js/Supabase ship frequently.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-----|--------------|-------------|---------|-------------|
| next | npm | mature (est. ~9 yrs) [ASSUMED] | 54.8M | github.com/vercel/next.js | SUS (`too-new`) | Approved — false positive, see note below |
| react | npm | mature (est. ~12 yrs) [ASSUMED] | 162.6M | github.com/react/react (official mirror) | SUS (`too-new`) | Approved — false positive |
| react-dom | npm | mature [ASSUMED] | 153.7M | github.com/react/react | SUS (`too-new`) | Approved — false positive |
| typescript | npm | mature (est. ~13 yrs) [ASSUMED] | 259.5M | github.com/microsoft/TypeScript | SUS (`too-new`) | Approved — false positive, but flag the 5.x→7.x major jump for a quick compat sanity check during scaffold |
| tailwindcss | npm | mature (est. ~8 yrs) [ASSUMED] | 118.2M | github.com/tailwindlabs/tailwindcss | SUS (`too-new`) | Approved — false positive |
| @supabase/supabase-js | npm | mature (est. ~5-6 yrs) [ASSUMED] | 25.1M | github.com/supabase/supabase-js | SUS (`too-new`, latest patch published same day as this research) | Approved — false positive |
| @supabase/ssr | npm | ~2-3 yrs [ASSUMED] | 6.3M | github.com/supabase/ssr | SUS (`too-new`) | Approved — false positive |
| eslint-config-next | npm | bundled w/ Next.js | 30.9M | github.com/vercel/next.js | SUS (`too-new`) | Approved — false positive |
| zod | npm | mature (est. ~5 yrs) [ASSUMED] | 251.1M | github.com/colinhacks/zod | OK | Approved |

**Packages removed due to `[SLOP]` verdict:** none.

**Packages flagged as suspicious `[SUS]`:** next, react, react-dom, typescript, tailwindcss, @supabase/supabase-js, @supabase/ssr, eslint-config-next — **all flagged solely on the `too-new` heuristic**, which triggers on a recent *version publish date*, not package novelty. Every flagged package has tens-to-hundreds of millions of weekly downloads and an official first-party GitHub repo matching its known maintainer (Vercel, Meta/React core team, Microsoft, Tailwind Labs, Supabase) — this is the expected signature of an actively-maintained mainstream package shipping a routine patch release, not a slopsquat. Per protocol these are still marked `[SUS]` and the planner should add one lightweight `checkpoint:human-verify` before `npm install` (a one-line "yes these are the real packages" sanity check, not a deep audit) — do not skip the checkpoint, but do not over-invest in it either.

*The package names themselves come from this session's prior project-level STACK.md research plus this agent's training knowledge (all are extremely well-known, unambiguous names) — tagged `[ASSUMED]` for provenance per protocol even though registry existence and version were independently verified via `npm view`.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser                                                              │
│  [Login page: email input] ──submit (Server Action)──┐              │
│                                                        │              │
│  Clicks magic-link/invite email (opens new tab) ──────┼────┐         │
└────────────────────────────────────────────────────────────┼────┼───┘
                                                          │    │
                                                          ▼    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Next.js (Vercel) — Frontend Server / API tier                       │
│                                                                       │
│  Server Action: signInWithOtp(email, {shouldCreateUser:false})      │
│         │                                                             │
│         ▼ (Supabase sends email out-of-band)                        │
│  Route Handler /auth/callback ── exchangeCodeForSession(code) ───┐   │
│         │                                                         │   │
│         ▼                                                         │   │
│  middleware.ts ── supabase.auth.getUser() on every request       │   │
│         │  (reads/refreshes/rewrites session cookie)             │   │
│         ▼                                                         │   │
│  Protected pages (Server Components) read session, render UI     │   │
└──────────┼─────────────────────────────────────────────────────────┘
           │                                                            │
           ▼                                                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Supabase (Postgres + Auth)                                          │
│  auth.users (Supabase-managed) ──trigger(handle_new_user)──▶ profiles │
│  Refresh tokens stored/rotated here — this is what makes D-03 work  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ One-off / admin path (NOT part of the running app's UI)             │
│  Coordinator seed script (Node, service-role key) ──▶               │
│    supabase.auth.admin.inviteUserByEmail(coordinator_email)         │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx        # email input + submit, Server Action
│   ├── auth/
│   │   └── callback/route.ts     # exchanges magic-link/invite code for session
│   ├── (dashboard)/
│   │   └── page.tsx              # minimal post-login landing page (proves login worked)
│   └── layout.tsx
├── lib/
│   └── supabase/
│       ├── server.ts             # createServerClient (Server Components/Actions)
│       ├── client.ts             # createBrowserClient (client components, if any)
│       └── middleware.ts         # updateSession helper used by middleware.ts
├── middleware.ts                 # session refresh, route matcher
└── scripts/
    └── seed-coordinator.ts       # one-off admin.inviteUserByEmail(coordinator) — run locally, never deployed as a route
supabase/
└── migrations/
    └── 0001_profiles.sql         # profiles table + handle_new_user trigger
```

### Structure Rationale

- **`app/auth/callback/route.ts` handles both magic-link and invite links** — Supabase's email templates for "Magic Link" and "Invite user" both redirect to a configurable URL with a verifiable code/token; pointing both at the same callback keeps "click email link → land in the app, logged in" a single code path with no password branch.
- **`scripts/seed-coordinator.ts` is not a route** — it must never be deployed or reachable over HTTP (it uses the service-role key). Run it once, locally, against the hosted Supabase project, to bootstrap the first coordinator account. This satisfies the CONTEXT.md discretion note ("full invite UI can wait for Phase 2").
- **`supabase/migrations/`** — SQL files checked into the repo (not applied via the Dashboard UI) so the `profiles` table and its trigger are versioned and reviewable, matching project-level ARCHITECTURE.md guidance.

### Pattern 1: Triple Supabase client setup for App Router

**What:** Three distinct client constructors — one for Server Components/Actions (`createServerClient` reading/writing cookies via Next's `cookies()`), one for any Client Components (`createBrowserClient`), one used inside `middleware.ts`.
**When to use:** Always, for any Supabase + Next.js App Router project.
**Example:**
```typescript
// lib/supabase/server.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs [CITED]
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )
}
```

### Pattern 2: Middleware refreshes the session on every request

**What:** `middleware.ts` calls `supabase.auth.getUser()` (not just `getSession()`) on each request, which transparently refreshes an expiring access token using the (never-expiring, single-use) refresh token and rewrites the response cookies.
**When to use:** Always — Server Components cannot write cookies, so without middleware the session silently stops refreshing.
**Example:**
```typescript
// middleware.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs [CITED]
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)
  await supabase.auth.getUser() // triggers refresh + cookie rewrite as a side effect
  return response
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
```

### Pattern 3: Lock down `signInWithOtp` to existing users only

**What:** Pass `shouldCreateUser: false` so magic-link sign-in never silently creates an account.
**When to use:** Every call to `signInWithOtp` in this app, given D-02.
**Example:**
```typescript
// app/(auth)/login/actions.ts
'use server'
export async function requestMagicLink(email: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  })
  // Show the SAME generic "check your email" message whether or not error is set —
  // see Security Domain below re: enumeration risk.
}
```

### Pattern 4: Coordinator/volunteer invite is a service-role, server-only call

**What:** `supabase.auth.admin.inviteUserByEmail(email)` creates the user and sends Supabase's built-in "Invite user" email — this is the only account-creation path in the whole app.
**When to use:** Once, manually, to bootstrap the coordinator account (this phase). Phase 2 can wrap this in a UI for the coordinator to invite volunteers.
**Example:**
```typescript
// scripts/seed-coordinator.ts — run with `npx tsx scripts/seed-coordinator.ts`, never deployed
// Source: https://supabase.com/docs/guides/auth/users [CITED]
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
await supabase.auth.admin.inviteUserByEmail('coordenador@instituicao.org', {
  redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
})
```

### Pattern 5: `profiles` row via Postgres trigger (not app code)

**What:** A `SECURITY DEFINER` trigger function on `auth.users` INSERT creates the matching `profiles` row automatically, regardless of whether the user arrived via invite or (future) another path.
**When to use:** This phase — it's the foundation Phase 2's `has_role()` RLS helper builds on [CITED: project ARCHITECTURE.md].
**Example:**
```sql
-- supabase/migrations/0001_profiles.sql
-- Source: https://supabase.com/docs/guides/auth/managing-user-data [CITED]
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### Anti-Patterns to Avoid

- **Calling `signInWithOtp` without `shouldCreateUser: false`:** Silently reopens self-signup, defeating D-02 — the single most important gotcha in this phase.
- **Building a "set your password" screen after invite acceptance:** There should be zero password UI anywhere in this app per D-01; the invite link should behave exactly like a magic link.
- **Reading `getSession()` in middleware instead of `getUser()`:** `getSession()` doesn't validate the token against the Auth server and won't trigger the refresh needed to keep D-03's "stay logged in" promise reliable.
- **Inserting directly into `auth.users`:** Never write to Supabase's managed auth schema by hand — always go through `admin.inviteUserByEmail` / the client SDK.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email OTP / magic-link token generation & verification | Custom token + email-send flow | Supabase Auth `signInWithOtp` / `verifyOtp` | Token entropy, expiry, single-use enforcement, and email delivery are already solved and audited — a hand-rolled version is a real security surface for zero benefit |
| Session cookie management for SSR | Manual JWT cookie parsing/refresh logic | `@supabase/ssr` | Handles PKCE code exchange, refresh-token rotation, and cookie read/write across Server Components/Actions/middleware correctly — this is exactly the kind of "looks simple, isn't" problem the deprecated `auth-helpers-nextjs` got wrong for newer Next.js versions |
| User invitation emails | Custom Resend-based invite email | Supabase's built-in "Invite user" template (customizable copy in Dashboard) | Reuses the same Auth token/verification path as magic link — a custom invite flow would need to reimplement token issuance just to hand off to the same login mechanism anyway |

**Key insight:** Every piece of "custom auth code" temptation in this phase (token generation, invite emails, session refresh) is really Supabase Auth doing it already — the actual engineering work in this phase is *configuration and wiring* (which flags to set, which callback handles which link type), not building auth primitives.

## Common Pitfalls

### Pitfall 1: `signInWithOtp` auto-creates users by default, silently defeating "no self-signup"

**What goes wrong:** With default options, typing any email into the login form creates a brand-new Supabase Auth user and logs them in — there is no visible "sign up" screen, but the *effect* of self-signup exists anyway.
**Why it happens:** `shouldCreateUser` defaults to `true` in `signInWithOtp` — this is Supabase's intentional default for apps that *want* magic-link-as-signup, which is the opposite of this project's D-02.
**How to avoid:** Pass `shouldCreateUser: false` explicitly on every `signInWithOtp` call, and turn off "Allow new users to sign up" in Supabase Dashboard → Authentication → Providers → Email as a second layer of defense.
**Warning signs:** A never-invited email address is able to log in and reach the dashboard.

### Pitfall 2: Invite-acceptance flow defaults to a password-setting screen

**What goes wrong:** The standard Supabase invite tutorial flow ends with the invited user setting a password — directly contradicting D-01 (no password anywhere).
**Why it happens:** Most Supabase invite examples assume password auth is the primary method; magic-link-only apps are a less common configuration and most tutorials don't cover it.
**How to avoid:** Route the invite-acceptance redirect to the same `/auth/callback` handler as the magic link, which should just call `exchangeCodeForSession`/`verifyOtp` and establish a session — never render a password form.
**Warning signs:** A newly-invited volunteer is shown a "create a password" screen on first login.

### Pitfall 3: Middleware misconfiguration silently breaks "stay logged in"

**What goes wrong:** If `middleware.ts` is missing, misconfigured (wrong matcher), or calls `getSession()` instead of `getUser()`, the refresh token never gets exercised — access tokens expire (5 min–1 hr) and the user appears logged out well before D-03's "indefinite" promise is met.
**Why it happens:** Server Components can read cookies but cannot write them — only middleware (or a Route Handler) can persist a refreshed session, so it's easy to skip this piece and only notice the bug when a token actually expires (which can be an hour after initial testing, not immediately).
**How to avoid:** Always include the middleware pattern from Pattern 2 above; manually test by waiting past the JWT expiry window (check the "JWT expiry limit" in Supabase Auth Settings) and confirming the app is still logged in on the next request.
**Warning signs:** User is logged out after roughly one hour of inactivity even though they never clicked "sair."

### Pitfall 4: Magic-link URL fragments aren't visible to server-side code

**What goes wrong:** Older/implicit-flow Supabase auth returns session data in the URL *fragment* (`#access_token=...`), which browsers never send to the server — a Route Handler at `/auth/callback` sees nothing to exchange.
**Why it happens:** The implicit flow was designed for pure client-side SPAs; Next.js Route Handlers only see query parameters, not fragments.
**How to avoid:** Use the PKCE/code-exchange flow (the current default for `@supabase/ssr` projects) so the email link contains a `code` query parameter, and call `exchangeCodeForSession(code)` server-side in the Route Handler.
**Warning signs:** `/auth/callback` runs with no error but the user isn't logged in; the URL in the browser has a `#` with token data that the server-side handler never receives.

### Pitfall 5: Redirect URL not allow-listed for the deployed domain

**What goes wrong:** Magic-link/invite emails redirect to `localhost` (or fail) once deployed, because Supabase only allows redirect targets present in its Site URL / Additional Redirect URLs configuration.
**Why it happens:** The Supabase project is often configured once during local development and never updated for the production Vercel URL (and preview-deployment URLs, which change per PR).
**How to avoid:** Add the production Vercel domain (and, if using preview deployments, a wildcard or the Supabase-Vercel integration which syncs this automatically) to Supabase Dashboard → Authentication → URL Configuration.
**Warning signs:** Clicking the magic link in production redirects to `localhost:3000` or shows a Supabase error page.

### Pitfall 6: Supabase free-tier auto-pause breaks the login flow with no visible error

**What goes wrong:** This is the project-level pitfall from `.planning/research/PITFALLS.md` (Pitfall 1) — after 7 days with no real database write activity, the free-tier project pauses, and both login and everything else silently stop working.
**Why it happens:** Nonprofit usage is bursty; a quiet week is plausible even before the app has real users during initial rollout.
**How to avoid:** Since this phase is "whichever phase sets up Supabase + Vercel cron" per the project-level research, consider adding a minimal heartbeat here (a trivial scheduled write) rather than deferring it — this phase is the foundation, and every later phase depends on the project staying active. At minimum, flag this as a near-term follow-up if not built in this phase.
**Warning signs:** Login stops working with no application-level error; Supabase Dashboard shows project status "Paused."

### Pitfall 7: TypeScript 7.x is a major-version jump from the commonly-documented 5.x

**What goes wrong:** Most current tutorials/StackOverflow answers assume TypeScript 5.x config defaults and behavior; scaffolding with the latest 7.0.2 could hit config or type-checking differences not covered by older guides.
**Why it happens:** `npm view typescript version` returned 7.0.2 as of this research date — a newer major than this agent's training-data baseline assumes.
**How to avoid:** After `create-next-app` scaffolds the project, run `tsc --noEmit` once immediately to confirm a clean baseline before writing any auth code; if `create-next-app`'s generated `tsconfig.json` produces unexpected errors, diff it against the officially generated config rather than hand-fixing blindly.
**Warning signs:** Type errors in freshly-scaffolded, unmodified boilerplate code.
**Confidence:** LOW — this is a version-verification flag, not a known specific breaking change; treat as "verify at scaffold time," not a documented issue.

## Code Examples

See Architecture Patterns 1-5 above for the primary verified patterns (client setup, middleware, locked-down `signInWithOtp`, invite script, `profiles` trigger). No additional standalone examples beyond those.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | Deprecated in favor of `@supabase/ssr` [CITED: project STACK.md, supabase.com/docs] | Any tutorial referencing `auth-helpers-nextjs` should be adapted, not copied verbatim |
| Implicit OAuth/magic-link flow (URL fragment tokens) | PKCE/code-exchange flow (query-param `code`) | Current default for `@supabase/ssr`-based projects [CITED: WebSearch, multiple Supabase GitHub discussions] | Server-side Route Handlers can now read the auth code directly; don't design around fragment-based token parsing |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: superseded by `@supabase/ssr`; do not add it as a dependency even if an older tutorial suggests it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Package ages (years) in the Package Legitimacy Audit table are approximate, not tool-verified | Package Legitimacy Audit | Low — doesn't affect the legitimacy verdict, which relies on downloads + repo, both of which are tool-verified |
| A2 | `eslint-config-next` version tracks the installed Next.js version automatically via `create-next-app` | Standard Stack | Low — if versions mismatch, lint may warn but won't block the walking-skeleton goal |
| A3 | TypeScript 7.0.2's specific compatibility with Next.js 16.2's generated `tsconfig.json` is untested this session | Common Pitfalls (Pitfall 7) | Medium — could cost scaffold-time debugging if there's an undocumented incompatibility; mitigated by the recommended `tsc --noEmit` sanity check immediately after scaffold |
| A4 | Supabase's default invite email template, when password auth is disabled project-wide, does not itself force a password-set UI (this is inferred from the fact that magic-link-only Supabase projects are a documented, supported configuration, not from a direct test of the invite email's rendered link behavior) | Architecture Pattern 4 / Pitfall 2 | Medium — if wrong, the invite flow needs an explicit redirect fix in the callback handler; recommend testing the actual invite-accept flow end-to-end early in execution, not assuming it from docs alone |

**If this table is empty:** N/A — see rows above; none of these block planning, but A3 and A4 warrant an early smoke test during execution.

## Open Questions

1. **Should the Supabase free-tier keep-alive heartbeat be built in this phase or deferred?**
   - What we know: Project-level PITFALLS.md flags this as needing attention "whichever phase sets up Supabase + Vercel cron," and this is that phase.
   - What's unclear: Whether a full Vercel Cron job is in-scope for the MVP walking-skeleton slice, or whether it's acceptable to defer to whichever phase first adds a Vercel Cron job for another purpose (e.g. reminders, Phase 7).
   - Recommendation: Planner's call — at minimum, note this as a tracked follow-up if not built now, since an idle project between Phase 1 completion and Phase 7 (reminders) could otherwise auto-pause.

2. **Exact behavior of Supabase's invite email when password auth is disabled project-wide.**
   - What we know: `admin.inviteUserByEmail` is the documented mechanism; most tutorials assume password-based acceptance.
   - What's unclear: Whether Supabase's hosted invite-email template needs its "Confirm your invite" link's redirect customized, or whether it already lands on the app's redirect URL in a way `exchangeCodeForSession` can consume directly (same as magic link).
   - Recommendation: Execution should test the actual invite flow end-to-end early (send a real invite to a test institutional email) rather than assuming from docs — treat this as a first-task smoke test, not an afterthought.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Next.js build/runtime | ✓ | v24.17.0 | — |
| npm | Package management | ✓ | 11.13.0 | — |
| git | Version control (repo already initialized, tracking `.planning/`) | ✓ | 2.54.0 | — |
| Vercel CLI | Local deploy testing | ✓ | 58.4.4 | — |
| Supabase CLI (global) | Migrations, type generation | ✗ (not on PATH) | — | Use `npx supabase@latest` — confirmed working (resolves to 2.111.0) |
| Docker | Local Supabase emulation (`supabase start`) | ✗ | — | Develop directly against a real hosted free-tier Supabase project; use `supabase link` + `supabase db push`/`supabase gen types typescript --linked` (neither requires Docker) instead of the local emulated stack |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:**
- Docker — plan development against the hosted Supabase project directly rather than a local Postgres/Inbucket stack; this also means there's no local email-inbox viewer for testing magic links locally (see Validation Architecture below — this pushes magic-link verification toward manual/real-inbox testing).
- Supabase CLI (global install) — use `npx supabase@latest` for every CLI invocation instead of assuming a global binary.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None installed yet — greenfield project, no `package.json` exists |
| Config file | none — see Wave 0 |
| Quick run command | To be established in Wave 0 (recommend Vitest for unit tests) |
| Full suite command | To be established in Wave 0 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|-------------|
| AUTH-01 | Login form rejects a non-invited email (no account created) | unit | `vitest run tests/auth/signInWithOtp.test.ts` (mock Supabase client, assert `shouldCreateUser: false` is passed) | ❌ Wave 0 |
| AUTH-01 | An invited user can complete magic-link login end-to-end | manual-only | N/A — requires a real institutional inbox; Docker unavailable means no local Inbucket for automated inbox assertions | N/A |
| AUTH-04 | Session cookie survives a simulated browser restart (new request with existing cookie, no re-auth prompt) | integration | `vitest run tests/auth/session-persistence.test.ts` (assert middleware refreshes and re-issues cookie given a valid refresh token) | ❌ Wave 0 |
| AUTH-04 | Redirect URL allow-list matches the deployed Vercel domain | manual-only | N/A — a Supabase Dashboard configuration check, not code | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run` (once installed in Wave 0)
- **Per wave merge:** full `npx vitest run` suite + a manual magic-link smoke test against the real deployed Vercel URL
- **Phase gate:** Full suite green + a successful manual login (magic link) and a successful manual "close browser, reopen, still logged in" check before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Install and configure Vitest (`npm install -D vitest`) — no test framework exists yet
- [ ] `tests/auth/signInWithOtp.test.ts` — covers AUTH-01 (shouldCreateUser lockdown)
- [ ] `tests/auth/session-persistence.test.ts` — covers AUTH-04 (middleware refresh behavior)
- [ ] No local email-inbox tooling available (Docker missing) — magic-link and invite end-to-end flows must be verified manually against a real inbox each time; flag this explicitly in the phase's UAT checklist rather than assuming automated coverage

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | yes | Supabase Auth `signInWithOtp` (magic link) — do not hand-roll token generation/verification |
| V3 Session Management | yes | `@supabase/ssr` cookie handling (httpOnly, secure, sameSite defaults) + middleware-driven refresh; verify cookie flags in production (must be `Secure` since Vercel serves HTTPS) |
| V4 Access Control | partial (deferred) | This phase has no role model yet; the only access-control surface is "logged in vs not" (middleware redirect) and the `profiles` RLS policy restricting each user to their own row — full RBAC is Phase 2 |
| V5 Input Validation | yes | Validate the email field shape (native `type="email"` + optional zod check) before calling `signInWithOtp` |
| V6 Cryptography | yes (delegated) | Token signing/hashing is entirely handled by Supabase Auth — never implement custom crypto for sessions/tokens |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Email enumeration via `shouldCreateUser: false` (API behavior differs for existing vs. non-existing email) | Information Disclosure | Show the identical generic "Se este e-mail estiver cadastrado, você receberá um link" message regardless of whether the email exists or the call errored [CITED: github.com/supabase/auth/issues/1547 — documented Supabase behavior] |
| Open redirect via an unvalidated `redirectTo`/`emailRedirectTo` parameter | Tampering | Only ever pass a hardcoded, server-controlled redirect URL (e.g. `${NEXT_PUBLIC_SITE_URL}/auth/callback`) — never accept a redirect target from user input |
| Session cookie theft (XSS/MITM) | Spoofing / Information Disclosure | Rely on `@supabase/ssr`'s default httpOnly + secure cookie flags; ensure the production deployment is HTTPS-only (default on Vercel) |
| Direct write to `auth.users` bypassing Auth invariants | Tampering | Never do this — always use `admin.inviteUserByEmail` / client SDK methods, as called out in Don't Hand-Roll |

## Sources

### Primary (MEDIUM-HIGH confidence — official docs, cross-checked via WebSearch)
- https://supabase.com/docs/guides/auth/auth-email-passwordless — magic link overview, `shouldCreateUser` behavior
- https://supabase.com/docs/guides/auth/server-side/nextjs — `@supabase/ssr` client/middleware setup pattern
- https://supabase.com/docs/guides/auth/quickstarts/nextjs — Next.js + Supabase Auth quickstart
- https://supabase.com/docs/guides/auth/sessions — session/refresh-token lifetime behavior
- https://supabase.com/docs/guides/auth/users — `admin.inviteUserByEmail`, `handle_new_user` trigger pattern
- https://supabase.com/docs/guides/auth/managing-user-data — `profiles` table + trigger example
- https://nextjs.org/docs/app/getting-started/installation — `create-next-app` current flags/defaults
- npm registry (`npm view <pkg> version`, run directly 2026-08-03) — Next.js, React, TypeScript, Tailwind, Supabase package versions

### Secondary (MEDIUM confidence — community sources cross-referencing official docs)
- https://github.com/supabase/auth/issues/1547 — email enumeration behavior of `shouldCreateUser: false`
- https://github.com/supabase/ssr/issues/40 — `@supabase/ssr` cookie `maxAge` defaulting to ~1 year
- https://www.rapidevelopers.com/supabase-tutorial/how-to-allow-login-only-for-invited-users-in-supabase — invite-only login pattern
- https://vercel.com/templates/next.js/supabase, https://supabase.com/blog/using-supabase-with-vercel — Vercel↔Supabase env-var integration behavior

### Tertiary (LOW confidence — flagged for validation)
- TypeScript 7.0.2 compatibility with Next.js 16.2 generated config — not independently verified this session (see Pitfall 7 / Assumption A3)
- Exact invite-email behavior when password auth is fully disabled — not directly tested (see Open Question 2 / Assumption A4)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions directly verified via `npm view`; patterns cross-checked against official Supabase/Next.js docs
- Architecture: MEDIUM-HIGH — patterns are mainstream/well-documented for Supabase+Next.js App Router; the invite-flow-without-password specifics (Pattern 4) carry more uncertainty (see Assumption A4)
- Pitfalls: HIGH for Pitfalls 1-6 (each has a specific documented mechanism or is inherited from verified project-level research); LOW for Pitfall 7 (version-jump flag, not a confirmed issue)

**Research date:** 2026-08-03
**Valid until:** 2026-08-17 (14 days — Next.js/Supabase/TypeScript ship frequently; re-verify versions if planning stalls past this window)

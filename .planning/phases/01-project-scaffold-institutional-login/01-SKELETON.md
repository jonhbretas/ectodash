# Walking Skeleton — EctoDash

**Phase:** 1
**Generated:** 2026-08-03

> This is the Phase-1 special case of the tracer: a whole-application slice, production-quality, wired through every layer. It is a contract, not a scratchpad — later phases add vertical slices on top of these decisions without re-litigating them.

## Capability Proven End-to-End

An invited volunteer types their institutional e-mail on the deployed site, clicks the link that arrives in their inbox, and lands on a page that reads their own row out of Postgres and greets them by e-mail — and they are still signed in when they come back days later.

That single sentence exercises: browser form → Server Action → Supabase Auth → outbound e-mail → Route Handler code exchange → session cookie → middleware refresh → server-rendered protected page → RLS-protected database read → a row written by a database trigger → HTTPS on Vercel.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.12, App Router, `--src-dir`, TypeScript, Tailwind 4 | Vercel-native zero-config deploy; Server Components ship minimal JS to the older/slower devices this audience uses; Server Actions give a mutation model without a hand-rolled API layer (project STACK.md) |
| Data layer | Supabase Postgres, schema as versioned SQL in `supabase/migrations/`, applied with `npx supabase@latest db push` | Real relational integrity for the demandas/responsáveis/prazos model coming in Phase 4; migrations in git so RLS policies are code-reviewed rather than clicked into a dashboard |
| Local database workflow | Hosted-only — no local emulation | Docker is unavailable in this environment (RESEARCH.md Environment Availability). `supabase link` + `db push` + `gen types` all work without it; `supabase start` is never used |
| Auth | Supabase Auth, magic link only (`signInWithOtp` with `shouldCreateUser` false), invite-only onboarding via `admin.inviteUserByEmail` | D-01: no passwords anywhere, chosen for an elderly-heavy volunteer base. D-02: no self-signup; the coordinator invites each institutional address |
| Session | `@supabase/ssr` cookie sessions, refreshed in root `middleware.ts` via the user-fetching auth call on every request | D-03: the session ends only when the volunteer clicks "Sair". Server Components cannot write cookies, so middleware is the only place a refreshed session can be persisted |
| Identity projection | `public.profiles` populated by a `security definer` Postgres trigger on account creation, never by application code | No auth entry point can produce a user without a profile. Phase 2's `has_role()` RLS helper builds directly on this table |
| Authorization boundary | Postgres Row Level Security, not UI hiding | Anyone can call a Server Action directly; RLS is the actual boundary (project CLAUDE.md, "What NOT to Use") |
| Deployment target | Vercel (Hobby / free), production deploy via `vercel --prod` | Free HTTPS/CDN, same-company Next.js integration, and the Cron surface Phase 7 needs. Non-commercial nonprofit use is within Hobby ToS |
| Directory layout | `src/app/` route groups — `(auth)` for the sign-in surface, `(dashboard)` for signed-in pages, `app/auth/callback` for the code exchange; `src/lib/supabase/` for the three client factories; `scripts/` for local-only admin utilities outside the module graph | Route groups keep auth and app surfaces separable as Phase 3's design system and Phase 5's role-scoped views arrive. Admin utilities stay out of `src/` so a service-role key can never reach the deployed bundle |
| Language / locale | Brazilian Portuguese UI copy, `<html lang="pt-BR">` | The volunteer base is Brazilian; jargon-free plain language is a hard constraint, not polish |

## Stack Touched in Phase 1

- [ ] **Project scaffold** — Next.js 16 + TypeScript + Tailwind + ESLint (with `jsx-a11y`) + Vitest (plan 01-01)
- [ ] **Routing** — three real routes: `GET /login`, `GET /auth/callback`, `GET /` (plans 01-03)
- [ ] **Database, one real write** — `admin.inviteUserByEmail` fires the `on_auth_user_created` trigger, inserting a `public.profiles` row (plans 01-02, 01-03)
- [ ] **Database, one real read** — the signed-in page selects the caller's own `public.profiles` row through the RLS policy (plan 01-03)
- [ ] **UI, one interactive element wired to the backend** — the login form's e-mail field submitting to the `requestMagicLink` Server Action (plan 01-03)
- [ ] **Deployment** — live HTTPS production deployment on Vercel, plus a documented local full-stack run command in README.md (plan 01-04)

## Full Artifact Inventory for Phase 1

**Files**
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`, `vitest.config.ts`, `README.md`, `.env.local.example`
- `src/app/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/login/login-form.tsx`, `src/app/(auth)/login/actions.ts`
- `src/app/auth/callback/route.ts`
- `src/app/(dashboard)/page.tsx`, `src/app/(dashboard)/actions.ts`, `src/app/(dashboard)/sign-out-button.tsx`
- `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`
- `middleware.ts` (repository root)
- `scripts/seed-coordinator.ts`
- `supabase/config.toml`, `supabase/migrations/0001_profiles.sql`
- `tests/smoke.test.ts`, `tests/db/profiles-trigger.test.ts`, `tests/auth/signInWithOtp.test.ts`, `tests/auth/session-persistence.test.ts`
- Deleted: `src/app/page.tsx` (scaffold default)

**Exported symbols**
- `createClient(): Promise<SupabaseClient>` — `src/lib/supabase/server.ts`
- `createClient(): SupabaseClient` — `src/lib/supabase/client.ts`
- `updateSession(request: NextRequest): Promise<NextResponse>` — `src/lib/supabase/middleware.ts`
- `middleware(request: NextRequest): Promise<NextResponse>`, `config` — `middleware.ts`
- `type LoginState`, `requestMagicLink(prevState, formData): Promise<LoginState>` — `src/app/(auth)/login/actions.ts`
- `LoginForm()` — `src/app/(auth)/login/login-form.tsx`
- `GET(request: NextRequest): Promise<NextResponse>` — `src/app/auth/callback/route.ts`
- `signOut(): Promise<void>` — `src/app/(dashboard)/actions.ts`
- `SignOutButton()` — `src/app/(dashboard)/sign-out-button.tsx`

**Database objects**
- Table `public.profiles(id uuid PK → auth.users(id) ON DELETE CASCADE, email text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`
- RLS policy `"users can view their own profile"` (SELECT, `auth.uid() = id`)
- Function `public.handle_new_user()` — `plpgsql`, `security definer`, `set search_path = public`
- Trigger `on_auth_user_created` — `AFTER INSERT ON auth.users FOR EACH ROW`

**Routes**
- `GET /login`, `GET /auth/callback?code=…`, `GET /`

**npm scripts**
- `dev`, `build`, `start`, `lint`, `test` (`vitest run`), `test:watch`, `seed:coordinator`

**Environment variable contract**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` — client-safe, set locally and in Vercel Production
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF` — local only, never set in Vercel

## Out of Scope (Deferred to Later Slices)

Explicit, so no later phase re-litigates Phase 1's minimalism:

- **Roles, permissions, `has_role()`, area/project scoping** — Phase 2. `public.profiles` deliberately has only `id`, `email`, `created_at`.
- **A coordinator-facing "invite volunteer" UI** — Phase 2. Phase 1 onboards through `npm run seed:coordinator`, because Phase 1 has no role model to gate such a screen (01-CONTEXT.md, Claude's Discretion).
- **The accessible design system** — Phase 3. Phase 1 ships an accessibility *floor* (large type, AA contrast, big touch targets, `aria-live` status, `jsx-a11y` linting), not a design language.
- **shadcn/ui, Radix, any component library** — Phase 3 decides. Phase 1 uses plain elements with Tailwind utilities.
- **Demandas, projetos, áreas, prazos, and every table but `profiles`** — Phase 4 onwards.
- **Any password capability**: sign-up with credentials, credential reset, credential update, credential-setting after invite — permanently out of scope, per D-01.
- **OAuth/social providers, phone OTP, MFA, anonymous sign-in** — see `01-COVERAGE.md`; all opted out with reasons.
- **6-digit code entry as an alternative to clicking the link** — link-only in v1 (D-01).
- **Idle timeouts, maximum session age, forced re-authentication** — forbidden by D-03, not merely deferred.
- **Supabase free-tier keep-alive heartbeat** — deferred to Phase 7, where the first Vercel Cron job ships and can carry the trivial keep-alive write. RESEARCH.md Open Question 1 explicitly permits this deferral; tracked in STATE.md blockers.
- **Custom SMTP** — Supabase's built-in sender is adequate at Phase-1 invite volume; revisit if free-tier e-mail limits bite.
- **A first-party authentication audit log** — Supabase Auth's built-in log suffices for v1.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2** — a volunteer's account carries one of four institutional roles, and a user without the Financeiro or Coordenador role cannot retrieve financial data even by calling the database directly. Extends `public.profiles`; adds the `has_role()` SECURITY DEFINER helper and RLS policies built on it.
- **Phase 3** — the same screens become legible and touch-friendly for an elderly-inclusive audience on both phone and desktop. Replaces Phase 1's accessibility floor with a real design system.
- **Phase 4** — a volunteer creates, edits, and concludes a demanda, and an overdue one flags itself.
- **Phase 5** — a volunteer filters demandas and sees only what their role permits.
- **Phase 6** — the coordenador sees every demanda, project, and volunteer on one dashboard.
- **Phase 7** — approaching and overdue demandas trigger deduplicated reminder e-mails with a visible run log. **Carries the deferred Supabase keep-alive write on its cron job.**
- **Phase 8** — a pasted meeting summary produces AI-suggested demandas that a human confirms before they become real.
- **Phase 9** — cash-flow data syncs from Google Sheets with a visible last-synced status.
- **Phase 10** — coordenador and financeiro see a role-restricted visual financial dashboard.

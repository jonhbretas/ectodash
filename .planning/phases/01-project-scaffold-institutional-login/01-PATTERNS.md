# Phase 1: Project Scaffold & Institutional Login - Pattern Map

**Mapped:** 2026-08-03
**Files analyzed:** 11
**Analogs found:** 0 / 11 (greenfield repo — confirmed no source code exists; only `.planning/` and `.claude/` directories present)

## Greenfield Notice

This repository has no existing source code. `ls` of the repo root shows only `.claude/`, `.git/`, `.planning/`. There is no `src/`, no `package.json`, no prior Next.js/Supabase code to pattern-match against. Every file below therefore has **no in-repo analog**. Per RESEARCH.md's own guidance, this phase's job is to *establish* the patterns future phases will copy from — so the planner should treat **RESEARCH.md's Architecture Patterns 1-5 (lines 199-307 of 01-RESEARCH.md) as the canonical source-of-truth excerpts**, not a fallback. I've copied the load-bearing excerpts below so the planner doesn't need to re-open RESEARCH.md.

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|-----------------|---------------|
| `package.json` / scaffold (via `create-next-app`) | config | batch (one-time generation) | none | no analog |
| `src/lib/supabase/server.ts` | service (client factory) | request-response | none | no analog |
| `src/lib/supabase/client.ts` | service (client factory) | request-response | none | no analog |
| `src/lib/supabase/middleware.ts` | middleware helper | request-response | none | no analog |
| `middleware.ts` (root) | middleware | request-response | none | no analog |
| `src/app/(auth)/login/page.tsx` | component (Server Component) | request-response | none | no analog |
| `src/app/(auth)/login/actions.ts` | service (Server Action) | request-response | none | no analog |
| `src/app/auth/callback/route.ts` | route (Route Handler) | request-response | none | no analog |
| `src/app/(dashboard)/page.tsx` | component | request-response | none | no analog |
| `src/app/layout.tsx` | component | request-response | none | no analog |
| `scripts/seed-coordinator.ts` | utility (one-off admin script) | batch/event-driven | none | no analog |
| `supabase/migrations/0001_profiles.sql` | migration | CRUD (DDL + trigger) | none | no analog |

## Pattern Assignments

Since there are no in-repo analogs, each file's "pattern to copy from" is the corresponding Architecture Pattern in `01-RESEARCH.md`. Excerpts reproduced below verbatim from that file (already verified against official Supabase/Next.js docs).

### `src/lib/supabase/server.ts` (service, request-response)

**Source:** RESEARCH.md Pattern 1 (lines 204-226)

```typescript
// lib/supabase/server.ts
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

Note: `src/lib/supabase/client.ts` needs a sibling `createBrowserClient` version (RESEARCH.md doesn't give this verbatim — it's a standard, well-documented Supabase `@supabase/ssr` variant: same two env vars, `createBrowserClient` instead of `createServerClient`, no cookie-store plumbing needed since the browser handles cookies natively).

---

### `middleware.ts` + `src/lib/supabase/middleware.ts` (middleware, request-response)

**Source:** RESEARCH.md Pattern 2 (lines 234-242)

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const { supabase, response } = createMiddlewareClient(request)
  await supabase.auth.getUser() // triggers refresh + cookie rewrite as a side effect
  return response
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
```

**Critical constraint (Pitfall 3, RESEARCH.md lines 342-347):** must call `getUser()`, never `getSession()` — `getSession()` doesn't validate/refresh and will silently break D-03 (indefinite session persistence).

---

### `src/app/(auth)/login/actions.ts` (service/Server Action, request-response)

**Source:** RESEARCH.md Pattern 3 (lines 249-261)

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
  // enumeration risk (RESEARCH.md Security Domain, line 481).
}
```

**Critical constraint (Pitfall 1, RESEARCH.md lines 328-333):** `shouldCreateUser: false` is mandatory on every call — this is the single most important line in this phase, enforcing D-02 (no self-signup). Missing it silently reopens self-signup.

---

### `src/app/auth/callback/route.ts` (route/Route Handler, request-response)

**Source:** RESEARCH.md Architecture Diagram (lines 145-152) + Pitfall 2/4 guidance (no verbatim code block given in RESEARCH.md for this file — standard Supabase pattern: read `code` query param, call `supabase.auth.exchangeCodeForSession(code)`, redirect to dashboard on success or to login with an error on failure).

**Critical constraints:**
- Must treat invite-acceptance links identically to magic-link links — establish a session and redirect straight into the app; **never** render a "set your password" screen (Pitfall 2, lines 335-340; also explicit D-01 requirement).
- Relies on PKCE/code-exchange flow (`?code=`), not URL-fragment tokens (Pitfall 4, lines 349-354) — this is the default for `@supabase/ssr`, so no special config needed, just don't try to read `#access_token` fragments server-side.

---

### `scripts/seed-coordinator.ts` (utility, batch/event-driven — one-off, not deployed)

**Source:** RESEARCH.md Pattern 4 (lines 269-276)

```typescript
// scripts/seed-coordinator.ts — run with `npx tsx scripts/seed-coordinator.ts`, never deployed
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
await supabase.auth.admin.inviteUserByEmail('coordenador@instituicao.org', {
  redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
})
```

**Critical constraint:** uses the **service-role key** — must never be imported into any route/page/component that ships to the browser or runs on Vercel as a deployed endpoint. Local-only, run-once script.

---

### `supabase/migrations/0001_profiles.sql` (migration, CRUD/DDL)

**Source:** RESEARCH.md Pattern 5 (lines 284-307)

```sql
-- supabase/migrations/0001_profiles.sql
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

**Downstream note:** This table/trigger is the foundation Phase 2's `has_role()` RLS helper builds on (per CONTEXT.md Integration Points) — do not add role columns here; keep this migration minimal (id, email, created_at only).

---

### `src/app/(auth)/login/page.tsx`, `src/app/(dashboard)/page.tsx`, `src/app/layout.tsx` (components, request-response)

**No RESEARCH.md code excerpt given** — these are standard Next.js App Router Server Components with no project-specific precedent yet. Planner/implementer should:
- `login/page.tsx`: a Server Component rendering a single email `<input type="email">` + submit button bound to the `requestMagicLink` Server Action (Pattern 3 above), with legible font size/contrast per CONTEXT.md's elderly-accessibility constraint (no jargon, no password field).
- `(dashboard)/page.tsx`: minimal placeholder proving a logged-in session renders (reads user via `createClient()` from `src/lib/supabase/server.ts`).
- `layout.tsx`: standard Next.js root layout (`create-next-app` default, unmodified apart from metadata/title).

---

### `package.json` / project scaffold (config)

**No analog** — generated by `create-next-app`, not hand-written. Exact invocation given in RESEARCH.md Installation section (lines 96-102):

```bash
npx create-next-app@latest ectodash --typescript --tailwind --eslint --app --src-dir
cd ectodash
npm install @supabase/supabase-js @supabase/ssr
npm install zod          # optional, discretionary
npm install -D eslint-plugin-jsx-a11y
```

## Shared Patterns

### Env vars (cross-cutting)
Every server-side file (`server.ts`, `middleware.ts`, `actions.ts`, `route.ts`, `seed-coordinator.ts`) depends on these three env vars — establish `.env.local` (gitignored) once, consistently named:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only scripts, never `NEXT_PUBLIC_*`)
- `NEXT_PUBLIC_SITE_URL` (used to build redirect URLs)

### Error/enumeration handling (cross-cutting)
Apply the same generic-message pattern (RESEARCH.md Security Domain, line 481) in both `actions.ts` (magic link request) and any future invite-related UI: never reveal whether an email exists in the system via differing success/error messages.

### `getUser()` not `getSession()` (cross-cutting)
Any place session state is checked server-side (middleware, dashboard page, callback route) must use `supabase.auth.getUser()` for validation, consistent with Pitfall 3.

## No Analog Found

All 11 files above have no analog — this is expected and correct for a greenfield first phase. Planner should cite RESEARCH.md Architecture Patterns 1-5 (excerpted above) as the pattern source for every plan action in this phase, rather than searching for in-repo analogs that don't exist.

## Metadata

**Analog search scope:** entire repo root (`ls -la` at `C:/Users/HP/Desktop/projetos/EctoDash`) — confirmed only `.claude/`, `.git/`, `.planning/` exist, no source tree.
**Files scanned:** 0 source files (none exist)
**Pattern extraction date:** 2026-08-03
</content>

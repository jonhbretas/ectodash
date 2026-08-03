# Phase 2: Role-Based Access Control - Research

**Researched:** 2026-08-03
**Domain:** Postgres enum-typed RBAC column + Supabase RLS `SECURITY DEFINER` helper function, extending an existing live table that already has a production row
**Confidence:** MEDIUM-HIGH (official Supabase RBAC docs fetched directly and cross-checked via WebSearch against independent Supabase Discussion threads on the recursion pitfall; enum/NOT NULL migration mechanics are well-established Postgres behavior, cross-checked across multiple independent sources; no Context7 MCP available in this environment, so all lookups went through WebSearch/WebFetch)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Role Storage Model**
- Add a `role` column (Postgres enum type) directly to the existing `public.profiles` table from Phase 1 — no separate `user_roles` table.
- Enum values: `coordenador_geral`, `lider_area`, `voluntario_comum`, `financeiro` (exactly 4, fixed, one per user).
- Rationale: the project requires exactly one fixed role per person (not multi-role), so a join table would add complexity with no real benefit; a column keeps `has_role()` a simple, fast lookup.

**Role Assignment**
- Role is assigned as a parameter at invite/seed time (extending `scripts/seed-coordinator.ts` or its successor to accept a role argument), not through a UI — Phase 2 has no admin screen.
- New accounts default to `voluntario_comum` unless a role is explicitly specified at invite time.
- Changing an existing user's role, until an admin UI exists in a later phase, is a direct database update (documented, not built as a feature here).

**Enforcement Scope for This Phase**
- Build a reusable `public.has_role(role)` SQL helper function (SECURITY DEFINER pattern, following the same pinned-`search_path` discipline as Phase 1's `handle_new_user`).
- Apply RLS using `has_role()` to the `profiles.role` column itself: only `coordenador_geral` can update another user's role; every user can read their own row (already true from Phase 1); prove this pattern works end-to-end with a real integration test against the live hosted project (same style as Phase 1's `profiles-trigger.test.ts`).
- Do NOT create a financial data table now — Success Criterion 2 ("cannot retrieve financial data") is proven at the level of the reusable `has_role()` pattern and RLS policy shape in this phase; the actual financial table in Phase 10 applies the same proven pattern, it does not re-invent it.

### Claude's Discretion

- Exact enum value spelling/casing, migration file naming, and the seed-script CLI argument shape (e.g. `--role=financeiro` vs positional) are left to the planner/executor to decide following Phase 1's established conventions.

### Deferred Ideas (OUT OF SCOPE)

- Role-management UI (assign/change a volunteer's role visually) — deferred to whichever future phase adds an admin/coordinator management surface; not in scope for Phase 2 or the current roadmap.
- Real financial data table and its RLS policy — deferred to Phase 10, once the Google Sheets schema is known (Phase 9 discovery).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| AUTH-02 | Sistema define 4 papéis fixos: Coordenador geral, Líder de área/projeto, Voluntário comum, Financeiro | Architecture Pattern 1 (enum type + column migration) + Code Example 1 — the fixed 4-value `app_role` enum, backfilled onto the existing coordinator row |
| AUTH-03 | Acesso a dados sensíveis (financeiro) é restrito por papel via RLS no banco, não só ocultado na tela | Architecture Pattern 2 (`has_role()` SECURITY DEFINER helper) + Pattern 3 (RLS policy using it) + Common Pitfall 1 (recursion) — proves the reusable enforcement contract that Phase 10's financial table will apply directly |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Vercel + Supabase free tier only — this phase is pure schema/SQL + a CLI script change, no new paid services introduced.
- **RLS as the only real authorization boundary** (explicit "What NOT to Use" entry: "Relying solely on client-side role checks... is a real security hole") — reinforces CONTEXT.md's decision to enforce via `has_role()` + RLS, not UI hiding.
- **No separate `user_roles` table / no granular per-field permission builder** — matches CONTEXT.md's locked single-enum-column decision; a join table or granular-permission system would contradict both CLAUDE.md's "4 fixed roles" framing and REQUIREMENTS.md's explicit Out-of-Scope entry ("Builder de permissões granulares por campo").
- **Migrations only as versioned SQL files under `supabase/migrations/`, pushed via `npx supabase@latest db push`** — never hand-edited via Dashboard SQL editor (established Phase 1 convention, reaffirmed by the `supabase` project skill).
- **Docker is unavailable in this environment** (confirmed again this session: `docker` command not found) — this rules out `supabase test db` (pgTAP), which always shells out to a container regardless of `--local`/`--linked`/`--db-url`. Continue Phase 1's pattern: hand-written Vitest integration tests against the live hosted project.

## Summary

This phase extends the existing, already-populated `public.profiles` table with a `role` enum column and a reusable `public.has_role()` `SECURITY DEFINER` helper function that RLS policies (here and in every future phase) will call to make role-based decisions. The mechanics are individually well-documented, but three interacting details make this phase easy to get subtly wrong:

1. **The `NOT NULL` + `DEFAULT` backfill is a bigger deal than it looks.** Postgres 11+ can add a `NOT NULL` column with a non-volatile `DEFAULT` in a single fast metadata-only `ALTER TABLE` (no full-table rewrite, no long lock) — good news, since this table already has at least one live row (the seeded coordinator). But that same default silently backfills the *existing* coordinator row to `voluntario_comum` too, unless a follow-up `UPDATE` explicitly sets it to `coordenador_geral`. The migration must include that one-time backfill statement, scoped by the coordinator's known email, or the very first account in the system ends up under-privileged the moment the migration lands.

2. **`has_role()` must be `SECURITY DEFINER`, or it will recurse.** Because `has_role()` needs to read `profiles.role` for the *calling user*, and it's meant to be called from an RLS policy defined *on `profiles` itself*, a naive `SECURITY INVOKER` implementation reopens the exact "policy queries the same RLS-protected table" cycle that produces Postgres's "infinite recursion detected in policy" error. `SECURITY DEFINER` breaks the cycle by having the helper function's internal lookup bypass RLS — this is the documented, Supabase-recommended fix, not a workaround. It does mean the function itself becomes the single trusted gate: it must never accept or return more than "does the calling user (`auth.uid()`) hold this specific role," never an arbitrary user ID this app passes in.
3. **A `SECURITY DEFINER` function living in `public` is technically a public API endpoint.** Postgres grants `EXECUTE` on every new function to `PUBLIC` by default, so `has_role()` is callable by `anon` and `authenticated` unless explicitly revoked/re-granted. This is safe *only* because the function's own body always keys off `auth.uid()` (the caller's own identity) — it never takes an arbitrary target user as an argument. Revoke from `PUBLIC`/`anon` and grant only to `authenticated` as defense-in-depth anyway.

**Primary recommendation:** One migration — `CREATE TYPE public.app_role AS ENUM (...)` → `ALTER TABLE public.profiles ADD COLUMN role public.app_role NOT NULL DEFAULT 'voluntario_comum'` → explicit `UPDATE` backfilling the seeded coordinator's row to `'coordenador_geral'` → `CREATE FUNCTION public.has_role(...) SECURITY DEFINER SET search_path = ''` (fully-qualified refs inside) → `REVOKE`/`GRANT EXECUTE` lockdown → one new `UPDATE` RLS policy on `profiles` gated by `has_role('coordenador_geral')`. Prove all of it — including the "cannot retrieve financial data" contract, since no financial table exists yet — via a Vitest integration suite against the live hosted project (pgTAP is unavailable: it requires Docker, which this environment doesn't have).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fixed 4-role definition (enum type) | Database/Storage | — | The enum type is the single source of truth for valid role values; enforced at the type-system level, not by application-side validation lists that could drift |
| Role assignment at invite/seed time | API/Backend | Database/Storage | `scripts/seed-coordinator.ts`'s successor runs server-side with the service-role key (bypasses RLS by design) to invite + set the role in one operation; the actual persisted value lives in Postgres |
| Role-based read/write authorization (`has_role()` + RLS) | Database/Storage | — | This is the entire point of AUTH-03 — enforcement must live where a direct API/DB query can't bypass it, i.e., inside Postgres RLS, not in any Next.js middleware or component |
| Future role-scoped UI (hiding buttons/menus by role) | Browser/Client | Frontend Server (SSR) | Explicitly UX polish only, not in this phase's scope — CLAUDE.md and CONTEXT.md both flag that hiding UI must never be the actual security boundary |
| Financial data access (future, Phase 10) | Database/Storage | — | Not built this phase, but the RLS policy shape (`using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')))`) is fully validated now so Phase 10 applies it directly to a real table |

## Standard Stack

No new libraries are introduced in this phase — it is pure Postgres DDL/SQL plus a small extension to the existing `scripts/seed-coordinator.ts` script, using packages already installed from Phase 1 (`@supabase/supabase-js`, `zod`).

### Core (existing, reused)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.112.0 (already installed) | Service-role admin client for the seed script and test suite | Same client Phase 1 already uses for `admin.inviteUserByEmail`/`admin.createUser`/`admin.deleteUser` |
| `zod` | ^4.4.3 (already installed) | Validate the new `--role` CLI argument against the fixed 4-value enum before it ever reaches SQL | Already the project's standard validation library per STACK.md; a `z.enum([...])` check is the simplest way to fail fast on a typo'd role name in the seed script rather than surfacing a Postgres enum-cast error |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `profiles.role` column read via `has_role()` SQL function | JWT custom claims via a Custom Access Token Auth Hook (Supabase's documented RBAC pattern for larger-scale apps) | Rejected for this phase by CONTEXT.md's explicit choice — the JWT-claims pattern avoids a DB roundtrip per RLS check but requires configuring an Auth Hook and accepting that role changes only take effect after the user's token next refreshes (stale-claim window). For an institution-sized volunteer base this trade isn't worth the added infrastructure; a direct column lookup is simpler to reason about and to test. Revisit only if role checks become a measured performance bottleneck. |
| Single `role` enum column on `profiles` | Separate `user_roles` join table (supports multi-role) | Rejected by locked decision — the institution's roles are exactly one-per-person; a join table adds join complexity to every future RLS policy for zero behavioral benefit here. |
| Hand-written Vitest integration tests against the live hosted project | pgTAP via `supabase test db --linked` | Not usable in this environment — `supabase test db` always executes `pg_prove` inside a Docker container per the Supabase CLI reference, regardless of `--local`/`--linked`/`--db-url`, and Docker is confirmed unavailable here (same conclusion as Phase 1 RESEARCH.md). |

**Installation:** None — no `npm install` needed this phase.

## Package Legitimacy Audit

Not applicable — this phase installs zero new npm packages. All code (`@supabase/supabase-js`, `zod`) is already installed and was legitimacy-audited in Phase 1's RESEARCH.md (both `[OK]`, previously flagged `[SUS]` only on the "too-new patch" false-positive heuristic).

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** none new this phase.

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│ One-off / admin path (unchanged tier from Phase 1)                     │
│  scripts/seed-coordinator.ts --role=coordenador_geral <email>          │
│    1. admin.inviteUserByEmail(email)  ──▶ auth.users row created       │
│       (Phase 1 trigger auto-inserts a profiles row, role defaults      │
│        to 'voluntario_comum' per column DEFAULT)                      │
│    2. service-role UPDATE profiles SET role = <arg> WHERE id = ...    │
│       (bypasses RLS entirely — service role key — this is intended,   │
│        this is the only role-assignment path until an admin UI exists)│
└──────────────────────────────┼──────────────────────────────────────────┘
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Supabase (Postgres)                                                     │
│                                                                          │
│  public.app_role  (enum: coordenador_geral | lider_area |               │
│                           voluntario_comum | financeiro)                │
│         │                                                               │
│         ▼                                                               │
│  public.profiles (id, email, created_at, role) ◀── RLS enabled         │
│         │            ▲                                                 │
│         │            │ SELECT policy (Phase 1, unchanged):             │
│         │            │   auth.uid() = id                               │
│         │            │                                                 │
│         │            │ UPDATE policy (new, this phase):                │
│         │            │   using/with check ((select has_role(          │
│         │            │     'coordenador_geral')))                      │
│         │            │                                                 │
│         ▼            │                                                 │
│  public.has_role(required_role app_role) SECURITY DEFINER              │
│    returns exists(select 1 from profiles                               │
│                    where id = auth.uid() and role = required_role)     │
│    — bypasses RLS internally, so it can safely be CALLED FROM an       │
│      RLS policy ON profiles without recursing                          │
│                                                                          │
│  (Future, Phase 10) public.financial_data ◀── RLS using                │
│    ((select has_role('financeiro')) or (select has_role('coordenador_geral')))│
│    — same has_role() contract, no new pattern needed                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
supabase/
└── migrations/
    ├── 0001_profiles.sql              # Phase 1 — unchanged
    └── 0002_profiles_role.sql         # Phase 2 — app_role enum, column, backfill, has_role(), UPDATE policy
scripts/
└── seed-coordinator.ts                # extended to accept a --role argument (default voluntario_comum)
tests/
└── db/
    ├── profiles-trigger.test.ts       # Phase 1 — unchanged
    └── role-rls.test.ts               # Phase 2 — new: default role, has_role() correctness, update-policy enforcement
```

### Pattern 1: Fixed enum type + fast `NOT NULL DEFAULT` column add on a populated table

**What:** A dedicated enum type (not a `text` + `CHECK` constraint) gives Postgres-level guarantee that only the 4 fixed values can ever be stored, and lets `has_role()`'s parameter be strongly typed. Adding it as `NOT NULL DEFAULT '...'` in one statement is safe and fast on modern Postgres because the default is a constant (non-volatile), so PG11+ can satisfy the constraint via a catalog-only change instead of rewriting every row.
**When to use:** Whenever adding a required column to a table that may already have rows (true here: the seeded coordinator).
**Example:**
```sql
-- supabase/migrations/0002_profiles_role.sql
-- Source: Postgres ALTER TABLE docs (ADD COLUMN ... DEFAULT const, PG11+ fast-path) [CITED: postgresql.org/docs — cross-checked via WebSearch, multiple independent migration-tool guides confirm the same PG11+ behavior]

create type public.app_role as enum (
  'coordenador_geral',
  'lider_area',
  'voluntario_comum',
  'financeiro'
);

alter table public.profiles
  add column role public.app_role not null default 'voluntario_comum';

-- Backfill: the DEFAULT above satisfies NOT NULL for every existing row,
-- including the already-seeded coordinator — but it backfills them ALL to
-- 'voluntario_comum'. This explicit UPDATE corrects the one account that
-- actually needs elevated privilege. Match by the coordinator's known
-- institutional email (the same address originally passed to
-- scripts/seed-coordinator.ts in Phase 1).
update public.profiles
  set role = 'coordenador_geral'
  where email = '<coordenador institutional email>';
```

### Pattern 2: `has_role()` as a `SECURITY DEFINER` helper to avoid RLS self-recursion

**What:** A single-purpose function that answers "does the *currently authenticated* user hold this role?" — never "does user X hold this role," which would make it a privilege-check oracle callable against arbitrary targets.
**When to use:** Every RLS policy in this project (and, per CONTEXT.md, every future phase's role-scoped table) that needs a role check.
**Example:**
```sql
-- Source: Supabase's official Custom Claims & RBAC guide's authorize()-function pattern,
-- adapted to this project's plain-column (not JWT-claims) storage model
-- [CITED: supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac]
create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = required_role
  );
$$;

-- Lock down who may call it directly (defense-in-depth; every new function
-- in `public` is EXECUTE-granted to PUBLIC by default in Postgres).
revoke execute on function public.has_role(public.app_role) from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;
```
**Why `search_path = ''` (empty) rather than `set search_path = public` like Phase 1's `handle_new_user`:** Supabase's current official RBAC example pins to an *empty* search path and fully-qualifies every reference (`public.profiles`, `public.app_role`) inside the function body — a stricter variant of the same "pin the search path" discipline Phase 1 used, closing the door on any possibility of a search-path-based schema-shadowing attack. Recommend adopting the empty-string variant here since it's the pattern in Supabase's own current docs; Phase 1's `set search_path = public` remains fine for `handle_new_user` (already shipped, don't churn it), but the stricter form is worth using for anything new — a small, low-risk `Claude's Discretion` item since CONTEXT.md said "follow Phase 1's discipline" without specifying which exact search_path value.

### Pattern 3: RLS policy calling `has_role()`, wrapped in a `SELECT`

**What:** Reference the helper function inside a `(select ...)` subquery in the policy expression, not bare — this is both a Postgres RLS performance best practice (the planner can cache/inline the scalar subquery result instead of re-evaluating per row) and the exact form used in Supabase's own RBAC examples.
**When to use:** The one new `UPDATE` policy this phase adds to `profiles`, and every future role-gated policy.
**Example:**
```sql
-- New policy this phase: only a coordenador_geral may update ANY profile row
-- (including another user's role). Regular users get no UPDATE policy at all
-- this phase — Postgres RLS defaults to deny, so with zero matching UPDATE
-- policy, self-updates (including self-role-escalation) are impossible.
create policy "coordenador geral can update any profile"
  on public.profiles
  for update
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));
```
**Forward-looking note (not built this phase):** When a later phase lets ordinary users edit their *own* non-role profile fields (e.g. a display name), do not simply add a broad `auth.uid() = id` UPDATE policy — Postgres RLS is row-level, not column-level, so that policy would also let a user overwrite their own `role` column. The correct future extension is either (a) a Postgres column-level `GRANT UPDATE (name, ...)` restricting which columns the `authenticated` role may touch at all, independent of RLS, or (b) a `BEFORE UPDATE` trigger that raises if `NEW.role IS DISTINCT FROM OLD.role` and the caller isn't `coordenador_geral`. Flagging this now so Phase 4/5 (which touch `profiles`-adjacent access patterns) don't accidentally reopen a self-escalation path.

### Anti-Patterns to Avoid

- **A `SECURITY INVOKER` (or unmarked, which defaults to `SECURITY INVOKER`) `has_role()`:** Immediately reproduces the "infinite recursion detected in policy for relation 'profiles'" error the moment it's called from a policy defined on `profiles` itself.
- **Passing an arbitrary target user ID into `has_role()`:** Turns the function into a privilege-check oracle any authenticated user could call against any other user ID. Keep it strictly self-referential (`auth.uid()`), matching CONTEXT.md's framing of the function's single argument as just the role to check.
- **A broad "users can update their own profile" policy added carelessly once other profile fields become user-editable:** See the forward-looking note in Pattern 3 — this is the most likely place a future phase silently reopens self-role-escalation.
- **Assuming `ADD COLUMN ... NOT NULL DEFAULT` alone is sufficient for this specific migration:** It satisfies the constraint, but silently mis-assigns the existing coordinator account unless the explicit backfill `UPDATE` also runs in the same migration.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Role storage validation ("is this a real role name?") | An application-level array/whitelist check duplicated across every insert/update path | Postgres `enum` type (`public.app_role`) | The type system rejects invalid values at the database boundary regardless of which code path (seed script, future admin UI, direct SQL) writes the row — a single source of truth instead of N duplicated whitelists |
| Role-based authorization decision logic | Custom `if (user.role === 'coordenador' \|\| user.role === 'financeiro')` checks scattered across Server Actions/Route Handlers | `public.has_role()` RLS policies | Any custom application-layer check can be bypassed by hitting the Supabase REST/DB API directly (exactly the attack AUTH-03 exists to prevent) — RLS is the only enforcement point that can't be routed around |
| Recursive self-referential role checks | A hand-tuned `EXISTS` subquery repeated inline in every policy that needs a role check | The single `has_role()` function | Centralizes the one place that needs `SECURITY DEFINER` privilege-bypass reasoning; every future policy (Phase 4, 6, 10) just calls it, rather than each author re-deriving the recursion-safe pattern from scratch |

**Key insight:** The entire engineering surface of this phase is "get one `SECURITY DEFINER` function's contract exactly right" — every other phase that needs role-based access (demandas ownership in Phase 5, the financial dashboard in Phase 10) is then a one-line `using ((select public.has_role('...')))` policy, not a new pattern.

## Common Pitfalls

### Pitfall 1: RLS recursion when a `profiles` policy queries `profiles`

**What goes wrong:** Postgres raises "infinite recursion detected in policy for relation 'profiles'" (or the query simply hangs/errors) if an RLS policy defined on `profiles` runs a plain, RLS-subject query against `profiles` to check the caller's role.
**Why it happens:** RLS applies to every query against the table, including queries issued from inside another policy's expression on that same table — a `SECURITY INVOKER` lookup re-triggers policy evaluation on itself.
**How to avoid:** `has_role()` must be `SECURITY DEFINER` (Pattern 2) — this is not optional, it's the documented fix Supabase's own community and support threads converge on.
**Warning signs:** Any query against `profiles` from an `authenticated` session errors with "infinite recursion detected in policy," or a role-gated policy silently blocks everyone including the coordinator.

### Pitfall 2: The enum-column backfill silently mis-assigns the existing coordinator row

**What goes wrong:** After the migration runs, the coordinator's account (created in Phase 1, before roles existed) has `role = 'voluntario_comum'` — the column `DEFAULT` value — instead of `'coordenador_geral'`, because a `DEFAULT` clause backfills *every* pre-existing row identically.
**Why it happens:** `ADD COLUMN ... NOT NULL DEFAULT X` is specifically designed to make *all* existing rows valid under the new constraint by giving them all the same value — there's no way to express "except this one row" in the `DEFAULT` clause itself.
**How to avoid:** Include the explicit backfill `UPDATE ... WHERE email = '<coordinator email>'` in the same migration, immediately after the `ADD COLUMN` (Pattern 1's example).
**Warning signs:** After migrating, the coordinator can no longer perform an action gated by `has_role('coordenador_geral')` (including, ironically, updating anyone's role — including their own, to fix the mistake, since the new UPDATE policy itself requires that same role).

### Pitfall 3: `has_role()` is publicly callable by default — safe here only because it's self-referential

**What goes wrong:** Postgres grants `EXECUTE` on new functions to `PUBLIC` automatically; a `SECURITY DEFINER` function that isn't carefully scoped can become an unintended internal API any authenticated (or even anonymous) client can call.
**Why it happens:** This is standard Postgres function-privilege behavior, not a Supabase quirk — easy to overlook when focused on the RLS policy itself rather than the function's own grants.
**How to avoid:** `has_role()`'s only parameter is the role to check, and its body only ever inspects `auth.uid()` (the caller's own identity) — so even fully public callability only ever discloses "do I hold role X," never another user's data. Still, explicitly `REVOKE ... FROM PUBLIC, anon` and `GRANT ... TO authenticated` as defense-in-depth (Pattern 2).
**Warning signs:** `supabase db advisors` (or the MCP `get_advisors` equivalent) flagging an overly-permissive function grant — run this check after the migration per the `supabase` skill's "Making and Committing Schema Changes" checklist.

### Pitfall 4: pgTAP looks like the "official" RLS test tool but is not usable in this environment

**What goes wrong:** Supabase's docs prominently feature pgTAP for RLS testing; reaching for `supabase test db --linked` to test the new policy against the hosted project fails or is impossible to run.
**Why it happens:** `supabase test db` always executes `pg_prove` inside a Docker container, regardless of whether the target is `--local`, `--linked`, or a raw `--db-url` — and Docker is confirmed absent from this environment (same finding as Phase 1's Environment Availability audit).
**How to avoid:** Continue Phase 1's established pattern instead: a Vitest integration suite (`tests/db/role-rls.test.ts`) using the service-role admin client to set up fixture users with different roles, and both admin and per-user (anon-key, signed-in) clients to exercise the actual RLS-gated `UPDATE`/`has_role()` behavior.
**Warning signs:** `supabase test db --linked` hangs or errors with a Docker-connection failure.

### Pitfall 5: PostgREST's schema cache can lag one migration behind

**What goes wrong:** Immediately after `db push` applies the new enum type/column, a REST (Data API) request referencing the new `role` field intermittently 400s or omits the column, even though `psql`/the admin client sees it fine.
**Why it happens:** PostgREST caches the database schema and only reloads on a `NOTIFY pgrst, 'reload schema'` signal; Supabase-hosted projects wire this up automatically via an event trigger on DDL, but rapid successive DDL statements in one migration can have their notifications coalesced/dropped.
**How to avoid:** This is generally self-healing on Supabase-hosted projects (the auto event trigger fires on `CREATE TYPE`/`ALTER TABLE`), but if a schema-cache-stale symptom appears right after `db push`, manually run `NOTIFY pgrst, 'reload schema';` via the SQL editor/CLI, or use the Dashboard's "Restart project" as a guaranteed fallback.
**Warning signs:** The admin/service-role client sees the new `role` column fine, but a fresh REST call via the anon/authenticated key doesn't, immediately after a migration.

## Code Examples

### Full Phase 2 migration

```sql
-- supabase/migrations/0002_profiles_role.sql
-- Adds the 4 fixed institutional roles, backfills the existing coordinator
-- account, and ships the has_role() RLS helper this and all future phases use.
-- Sources: Postgres ALTER TABLE docs (fast NOT NULL DEFAULT path, PG11+) [CITED];
-- Supabase Custom Claims & RBAC guide (has_role/authorize pattern) [CITED: supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac]

create type public.app_role as enum (
  'coordenador_geral',
  'lider_area',
  'voluntario_comum',
  'financeiro'
);

alter table public.profiles
  add column role public.app_role not null default 'voluntario_comum';

update public.profiles
  set role = 'coordenador_geral'
  where email = '<coordenador institutional email — same address seeded in Phase 1>';

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = required_role
  );
$$;

revoke execute on function public.has_role(public.app_role) from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;

create policy "coordenador geral can update any profile"
  on public.profiles
  for update
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));
```

### Extending the seed script with a `--role` argument

```typescript
// scripts/seed-coordinator.ts (extended) — indicative shape, exact CLI arg
// parsing left to planner/executor discretion per CONTEXT.md.
import { z } from "zod";

const roleSchema = z.enum([
  "coordenador_geral",
  "lider_area",
  "voluntario_comum",
  "financeiro",
]);

// ... after admin.inviteUserByEmail(email) succeeds and returns data.user.id,
// the Phase 1 trigger has already inserted a profiles row defaulted to
// 'voluntario_comum'. If a role other than the default was requested,
// explicitly set it with the service-role client (bypasses RLS by design —
// this script IS the trusted admin path until a future UI exists):
const role = roleSchema.parse(process.argv[3] ?? "voluntario_comum");
if (role !== "voluntario_comum") {
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", data.user.id);
  if (error) {
    console.error(`Falha ao definir papel ${role}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `role` as `text` + `CHECK (role IN (...))` | `role` as a dedicated Postgres `enum` type | Enum types have always been the stricter option; increasingly the documented default in current Supabase/Postgres schema-design guidance for small, fixed value sets | Enum gives type-level rejection of invalid values and a typed `has_role()` parameter; tradeoff is that adding a 5th role later requires `ALTER TYPE ... ADD VALUE`, which (unlike this phase's brand-new-type creation) cannot run inside the same transaction as a statement that uses the new value — a future-phase gotcha, not this phase's |
| JWT `app_metadata` custom claims + Auth Hook for role checks | Direct `has_role()` query against `profiles.role` | Both patterns are current and Supabase-documented; JWT claims are recommended specifically for performance at scale (avoiding a DB roundtrip per RLS check) | This project's institution-sized user base doesn't need the JWT-claims performance optimization yet; CONTEXT.md's locked decision already chose the simpler column+function approach — revisit only if role-check latency becomes measured, not assumed |

**Deprecated/outdated:**
- `auth.role() = 'authenticated'` in policies — deprecated by Supabase in favor of the `TO authenticated` clause (also breaks silently once anonymous sign-ins are enabled, since anonymous users still carry Postgres role `authenticated`). Not directly relevant to this phase's new policy (already written with `to authenticated`), but worth reaffirming since it's an easy copy-paste trap from older tutorials.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The coordinator's institutional email used in Phase 1's `seed-coordinator.ts` invocation is known/recorded and can be hardcoded into the Phase 2 migration's backfill `UPDATE` | Pattern 1, Code Examples | Medium — if the exact email isn't available to the planner/executor, the backfill `UPDATE` needs a different targeting strategy (e.g., `ORDER BY created_at ASC LIMIT 1`, since the coordinator was necessarily the first account created) — flag this as a planning-time detail to confirm, not an unsolvable blocker |
| A2 | Postgres 11+ fast-path for `ADD COLUMN ... NOT NULL DEFAULT <constant>` applies to the hosted Supabase project's Postgres version | Pattern 1 | Low — Supabase's hosted Postgres versions have been 14+ for years; this is effectively certain but not independently version-checked against this specific project this session |
| A3 | Supabase's hosted-project DDL event trigger (auto `NOTIFY pgrst, 'reload schema'`) reliably fires for `CREATE TYPE` + `ALTER TABLE ADD COLUMN` in the same migration transaction | Pitfall 5 | Low — self-healing even if wrong (manual `NOTIFY`/project restart is a documented fallback); worst case is a few minutes of stale schema cache immediately post-migration, not a lasting break |

**If this table is empty:** N/A — see rows above. None block planning; A1 is the one item execution should confirm early (the coordinator's exact seeded email) before finalizing the migration's backfill `WHERE` clause.

## Open Questions

1. **Exact backfill targeting strategy for the existing coordinator row.**
   - What we know: Exactly one account exists pre-migration (the seeded coordinator from Phase 1), and it must end up `coordenador_geral`.
   - What's unclear: Whether the planner/executor has the literal email string available to hardcode into the migration's `UPDATE ... WHERE email = ...`, or whether a structural target (`ORDER BY created_at ASC LIMIT 1`, since it's necessarily the only/first row) is more appropriate.
   - Recommendation: Planner's call — either is valid; the structural approach avoids hardcoding a real email into a versioned SQL file, which may be preferable for a personal-institution-nonprofit repo that could eventually go public.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | seed script, Vitest tests | ✓ | v24.17.0 | — |
| Supabase CLI | `db push` for the new migration | ✗ (not on PATH, confirmed again this session — same as Phase 1) | — | `npx supabase@latest` — established working pattern from Phase 1 |
| Docker | `supabase test db` (pgTAP) | ✗ (confirmed: `docker` command not found) | — | Continue Phase 1's Vitest-against-hosted-project integration test pattern; pgTAP is not usable in this environment |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:**
- Docker — blocks pgTAP entirely (not just "local dev mode"); this phase's RLS/role proof relies exclusively on the established Vitest + live hosted project pattern from `tests/db/profiles-trigger.test.ts`.
- Supabase CLI (global) — use `npx supabase@latest db push` as in Phase 1.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (already installed and configured, Phase 1) |
| Config file | `vitest.config.ts` (testTimeout already raised to 30000ms for network-crossing assertions) |
| Quick run command | `npx vitest run tests/db/role-rls.test.ts` |
| Full suite command | `npm test` (== `vitest run`, covers `tests/db/profiles-trigger.test.ts` + the new `role-rls.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-02 | A newly created account defaults to `voluntario_comum` | integration | `npx vitest run tests/db/role-rls.test.ts -t "defaults to voluntario_comum"` | ❌ Wave 0 |
| AUTH-02 | The seeded coordinator account's row is `coordenador_geral` after migration (backfill correctness) | integration | `npx vitest run tests/db/role-rls.test.ts -t "coordinator backfill"` | ❌ Wave 0 |
| AUTH-03 | `has_role()` returns true only for the role the calling session actually holds, for each of the 4 roles | integration | `npx vitest run tests/db/role-rls.test.ts -t "has_role correctness"` | ❌ Wave 0 |
| AUTH-03 | A non-`coordenador_geral` signed-in user cannot update another user's `role` via a direct DB update (RLS denies — 0 rows affected, not a granted write) | integration | `npx vitest run tests/db/role-rls.test.ts -t "non-coordinator cannot update role"` | ❌ Wave 0 |
| AUTH-03 | A `coordenador_geral` signed-in user CAN update another user's `role` | integration | `npx vitest run tests/db/role-rls.test.ts -t "coordinator can update role"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/db/role-rls.test.ts`
- **Per wave merge:** full `npm test` (both `profiles-trigger.test.ts` and `role-rls.test.ts` against the live hosted project)
- **Phase gate:** Full suite green + a manual confirmation that the seeded coordinator account can still log in and act as coordinator post-migration, before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/db/role-rls.test.ts` — covers AUTH-02 (default role, backfill correctness) and AUTH-03 (`has_role()` correctness, update-policy enforcement in both directions)
- No new framework/fixture install needed — reuses Phase 1's `describe.skipIf(!canRun)` live-credential pattern and admin/anon client setup verbatim

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | no (unchanged from Phase 1) | Not touched this phase |
| V3 Session Management | no (unchanged from Phase 1) | Not touched this phase |
| V4 Access Control | yes — this is the core of the phase | `public.has_role()` `SECURITY DEFINER` helper + RLS `UPDATE` policy on `profiles`; never a client-side role check |
| V5 Input Validation | yes | `zod` `z.enum([...])` validation of the seed script's `--role` argument before it reaches SQL; the Postgres `enum` type itself is a second, database-level validation layer |
| V6 Cryptography | no (unchanged from Phase 1) | Not touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Self-role-escalation (a user updates their own `role` to `coordenador_geral`) | Elevation of Privilege | No self-update RLS policy exists this phase (default-deny); the only `UPDATE` policy requires `has_role('coordenador_geral')` already, closing the loop entirely for now — see Pattern 3's forward-looking note for when self-editable fields are added later |
| RLS bypass via direct REST/DB API call (the exact threat AUTH-03 names explicitly) | Elevation of Privilege / Information Disclosure | RLS policy gated by `has_role()`, enforced at the Postgres layer — unreachable from any client regardless of which API surface (REST, direct Postgres connection, a future Server Action) is used |
| `SECURITY DEFINER` privilege leakage via an overly-broad or badly-scoped helper function | Elevation of Privilege | `has_role()` is strictly self-referential (`auth.uid()` only, never an arbitrary target), `search_path` pinned to `''` with fully-qualified references, `EXECUTE` revoked from `PUBLIC`/`anon` |
| RLS self-recursion producing either a hard error or (worse) a policy that silently evaluates to a permissive default | Denial of Service / Elevation of Privilege | `SECURITY DEFINER` on `has_role()` (Pattern 2) — the documented fix, not a workaround |

## Sources

### Primary (MEDIUM-HIGH confidence — official Supabase docs, fetched directly)
- https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac — canonical `authorize()`/`has_role()`-style `SECURITY DEFINER` helper pattern, `search_path = ''`, grant/revoke scoping, policy-call-wrapped-in-SELECT form
- https://supabase.com/docs/reference/cli/supabase-test-db — confirms `pg_prove` always runs inside a Docker container regardless of `--local`/`--linked`/`--db-url`

### Secondary (MEDIUM confidence — WebSearch cross-referencing official/community sources)
- https://github.com/orgs/supabase/discussions/32579, https://github.com/orgs/supabase/discussions/47525, https://github.com/orgs/supabase/discussions/1138 — independent, consistent confirmations of the "infinite recursion detected in policy" failure mode and the `SECURITY DEFINER` fix
- https://dev.to/kanta13jp1/supabase-rls-security-definer-preventing-infinite-recursion-in-admin-policies-4go2 — worked example of the same recursion-avoidance pattern
- Multiple independent migration-tooling sources (Rails/Alembic/TypeORM ecosystem articles) — cross-confirm Postgres 11+'s fast-path for `ADD COLUMN ... NOT NULL DEFAULT <constant>` and the older two-step nullable-then-backfill pattern's continued relevance only for volatile defaults or pre-PG11
- https://github.com/PostgREST/postgrest/issues/2319, https://github.com/PostgREST/postgrest/issues/2620, https://postgrest.org/en/stable/references/schema_cache.html — PostgREST schema cache reload mechanics and known coalescing edge cases

### Tertiary (LOW confidence — not independently re-verified this session)
- Exact behavior of Supabase's hosted-project auto-`NOTIFY` event trigger under this specific project's migration shape (Assumption A3) — inferred from general PostgREST/Supabase documentation, not tested against this project's live instance this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing Phase 1 audit stands
- Architecture (`has_role()` + RLS pattern): HIGH — directly sourced from Supabase's own current official RBAC documentation, and the recursion-avoidance rationale is corroborated by multiple independent Supabase Discussion threads
- Enum/migration mechanics: MEDIUM-HIGH — well-established Postgres behavior, cross-checked across several independent sources, but not tested against this project's actual hosted Postgres version this session
- Pitfalls: HIGH for Pitfalls 1-4 (each backed by a specific, corroborated mechanism); MEDIUM for Pitfall 5 (schema cache — self-healing, documented fallback exists, but the exact auto-reload trigger behavior on this project wasn't tested live)

**Research date:** 2026-08-03
**Valid until:** 2026-08-17 (14 days — matches Phase 1's window; Supabase Auth/RLS/CLI guidance ships frequently)

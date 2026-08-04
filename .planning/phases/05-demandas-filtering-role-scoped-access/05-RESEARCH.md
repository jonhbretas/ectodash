# Phase 5: Demandas Filtering & Role-Scoped Access - Research

**Researched:** 2026-08-04
**Domain:** Postgres RLS role/ownership-scoping on an existing permissive table (re-applying Phase 2's SELECT-gates-UPDATE lesson under a join-table topology), a new área-to-líder data-model gap, and Next.js 16 URL-driven server-side filtering
**Confidence:** HIGH — RLS mechanics are direct extensions of Phase 2/4's live-verified patterns and the project's own installed Postgres/Supabase skills; Next.js 16 `searchParams` guidance read directly from `node_modules/next/dist/docs/` per AGENTS.md; the área-normalization and líder-assignment decisions are reasoned recommendations (MEDIUM) since no CONTEXT.md/discuss-phase has locked them yet

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists yet for this phase — research runs before `/gsd-discuss-phase`, same ordering Phase 4 used. No locked decisions, discretion areas, or deferred ideas to carry forward yet. Every design choice below is a research recommendation for discuss-phase/the planner to confirm or override, especially the área-to-líder data-model gap (Item 2) and the área-normalization call (Item 3), which are genuinely new decisions this phase must make that Phase 4 explicitly deferred.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEM-04 | Usuário filtra/agrupa demandas por área, projeto ou responsável | Architecture Pattern 4 (URL search-params filtering) + Item 3 (no área normalization needed at this scale) |
| DEM-05 | Voluntário comum vê e edita só suas próprias demandas; líder de área vê as da sua área; coordenador vê tudo | Architecture Pattern 1-3 (RLS SELECT/UPDATE narrowing) + Item 2 (área-to-líder data-model gap) + Common Pitfalls 1-3 |
| UX-02 | Formulários são curtos, com poucos campos por tela e confirmação clara em ações importantes | Architecture Pattern 5 (confirm-before-conclude/delete pattern using existing shadcn primitives) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Vercel + Supabase free tier only — this phase adds no paid services and, per the Package Legitimacy Audit below, **no new npm packages at all**. It is a schema-migration + Server Component/RLS phase reusing every library already installed in Phases 1-4.
- **RLS as the only real authorization boundary** — reinforced directly by this phase's core job (DEM-05): role/ownership-scoped visibility and editability must be enforced in Postgres, never only hidden in the UI. Any UI-only "hide the edit button for a voluntário viewing someone else's demanda" is explicitly UX polish, not the authorization boundary.
- **Migrations only as versioned SQL files under `supabase/migrations/`**, pushed via `npx supabase@latest db push` — next file is `0004_demandas_role_scope.sql` (this phase adds the `area_liderada` column to `profiles` AND narrows `demandas`/`demanda_responsaveis` RLS — see Item 2/Architecture Pattern 1-3 for why both belong in one migration, not two).
- **Accessible UX for elderly users** (large text/touch targets, high contrast, pt-BR copy) — Phase 3's polish pass already retrofitted the demandas UI onto shadcn/ui (`Input`, `Label`, `Table`, `Badge`); this phase's filter controls and confirmation dialogs must match that established baseline (`min-h-14`, `text-xl`, `focus-visible` rings) rather than introducing a new visual language.
- **`zod` for all boundary validation** — the filter query-string itself (área/projeto/responsável values arriving via `searchParams`) is untrusted input from the URL and should be parsed/validated the same way `formData` is, per Next.js's own Server Actions security guidance already cited in 04-RESEARCH.md.
- **date-fns** — no new date logic this phase; the existing `demandas_com_status.atrasada` boolean and `date-fns` display formatting from Phase 4 are reused as-is.
- **shadcn/ui** — no new components strictly required; `Select`/`ToggleGroup`/`Dialog`/`AlertDialog` are available via `npx shadcn@latest add <component>` if the planner wants a native select-based filter UI or a confirmation dialog for "concluir"/"excluir" (see Architecture Pattern 5), but plain `<select>` + native `<a>`/`<Link>`-driven `searchParams` (as already used for `responsavelIds` in `demanda-form.tsx`) is also sufficient and lower-risk to introduce.

## Summary

This phase does three structurally distinct things, and conflating them is the main risk: (1) it narrows `demandas`/`demanda_responsaveis` SELECT and UPDATE/DELETE policies by role for the first time since Phase 4 deliberately shipped them permissive; (2) it closes a real data-model gap — there is currently **no mechanism anywhere in the schema** for knowing which área a líder leads, so "líder de área vê as demandas da sua área" (DEM-05) cannot be implemented today without first adding that link; and (3) it adds filter/group UI (DEM-04) and short-confirm-before-action UI (UX-02) that are lower-risk, mostly UI-layer work reusing Phase 3/4's established components.

**The single highest-risk item is #1, per the explicit carry-forward instruction from Phase 4's own migration comments and CONTEXT.md.** Phase 2 discovered — the hard way, in live verification — that Postgres resolves an UPDATE/DELETE's target rows through the table's **SELECT** policies before evaluating the UPDATE/DELETE policy itself. A denied write is indistinguishable from a successful no-op via the acting client's own response (`error: null`, zero rows changed) — the only sound proof is a service-role re-read, which is exactly the pattern `tests/db/role-rls.test.ts` and `tests/db/demandas-rls.test.ts` already establish. Phase 4 sidestepped this entirely by using `using (true)` for SELECT — every UPDATE was therefore always reachable. **The moment this phase narrows SELECT to be role/ownership-scoped, the previously-invisible SELECT-gates-UPDATE trap becomes live risk again**, and it must be re-verified for every role, not assumed correct because the SQL "looks right." A líder de área who can no longer SELECT a colleague's demanda outside their área will also silently lose the ability to UPDATE it, even if the UPDATE policy's own `USING`/`WITH CHECK` clause is written correctly — because Postgres never reaches that clause if the row isn't visible first.

**Recommendation for the gap (#2):** add a single nullable `area_liderada text` column to `profiles` (not a new `lider_areas` join table) — this project's áreas are free text, not a normalized entity, and a líder leads exactly one área per the roadmap's own phrasing ("líder de área... vê as da sua área," singular). A join table would imply multi-área leadership, which nothing in PROJECT.md/ROADMAP.md/REQUIREMENTS.md asks for, and would be over-engineering relative to the "dozens of demandas" institutional scale documented in this project's own CLAUDE.md. This is flagged as an `[ASSUMED]` design call for discuss-phase to confirm — the "one área per líder" reading is a reasonable inference from the roadmap's grammar, not an explicit locked decision.

**Recommendation for área normalization (#3):** no normalization is needed this phase. At "dozens of demandas, not thousands" scale (this project's own documented ceiling), a case-insensitive `ilike`/`lower() =` filter over free text is sufficient, and Phase 4's `.trim()`-on-write mitigation (already shipped in `demanda-schema.ts`) already reduces the main fragmentation risk (leading/trailing whitespace). A `DISTINCT lower(area)` query is enough to build a filter dropdown of "actual áreas in use" without introducing a new table or a normalization trigger.

**Primary recommendation:** One migration (`0004_demandas_role_scope.sql`) adding `profiles.area_liderada` (nullable text) and replacing `demandas`'/`demanda_responsaveis`' permissive SELECT/UPDATE/DELETE policies with role-aware ones built on `has_role()` plus two new `SECURITY DEFINER` helper predicates (`is_responsavel_for(demanda_id)`, `is_lider_of_area(area)`) — paired with a re-verification test suite (extending `tests/db/demandas-rls.test.ts`) that asserts, for every role, both that visibility narrows correctly AND that UPDATE/DELETE still succeeds wherever the role is supposed to have write access. UI work (DEM-04, UX-02) uses the `searchParams` Server Component page prop for filter state (not client-side `useSearchParams` state) to keep filtering consistent with this project's established "Server Component fetches from Supabase directly" pattern, plus a `shadcn` `AlertDialog` (newly added, zero new npm dependency — it's a Radix primitive already available via the CLI) for the "confirm before concluding/excluding" UX-02 requirement.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Role/ownership-scoped demanda visibility (who can SELECT which rows) | Database/Storage | — | RLS is the project's only real authorization boundary (CLAUDE.md); must be correct independent of which UI queries it |
| Role/ownership-scoped demanda editability (who can UPDATE/DELETE which rows) | Database/Storage | API/Backend | The RLS UPDATE/DELETE policy is authoritative; the Server Action layer adds no additional authorization logic, only input validation (matches Phase 4's existing division) |
| área-to-líder assignment (who leads which área) | Database/Storage | — | A new `profiles.area_liderada` column, read by the RLS helper function `is_lider_of_area()` — this is data the database must know to enforce DEM-05, not something the UI can safely gate |
| Filter/group-by-área/projeto/responsável (DEM-04) | Frontend Server (SSR) | Database/Storage | Filter criteria arrive via URL `searchParams` (client-visible, bookmarkable, back-button-friendly) and are applied as a Supabase query `.eq()`/`.ilike()`/`.in()` filter server-side — consistent with the existing Server Component data-fetch pattern in `page.tsx`; the database still enforces RLS underneath regardless of what filter the UI requests |
| Confirm-before-action UI (UX-02: conclude/edit/delete confirmation) | Browser/Client | — | A client-side confirmation step (native `confirm()`, or a shadcn `AlertDialog` for a nicer accessible modal) before submitting the existing Server Action — purely a UX safeguard, not a security boundary; the actual permission check still happens in RLS regardless of whether the user confirmed |

## Standard Stack

### Core

No new libraries. This phase is 100% composed of packages already installed and verified in Phases 1-4:

| Library | Version (as installed) | Purpose this phase | Why no new install |
|---------|------------------------|---------------------|---------------------|
| `@supabase/supabase-js` / `@supabase/ssr` | already installed (Phase 1) | RLS-scoped queries with filter params applied via `.eq()`/`.ilike()`/`.in()` | Filtering is expressed as ordinary PostgREST query modifiers — no new client capability needed |
| `zod` | already installed (Phase 4) | Validating the `searchParams` object (an untrusted, URL-controlled input) before using its values to build a Supabase query | Same "never trust an external input, even from your own app's URL bar" principle Phase 4 applied to `formData` |
| shadcn/ui CLI | already initialized (Phase 3/4) | Optional: `npx shadcn@latest add select alert-dialog` for a nicer accessible filter/confirm UI | The CLI copies component *source* into the repo — not a new runtime dependency, same model as Phase 4's `form`/`table`/`badge` additions |
| `date-fns` | already installed (Phase 4) | No new usage — filter UI does not add new date logic | — |

### Supporting (only if the planner opts into new shadcn components)

| Component | Underlying Radix primitive | Purpose | When to Use |
|-----------|----------------------------|---------|-------------|
| `alert-dialog` | `@radix-ui/react-alert-dialog` | "Tem certeza que deseja concluir/excluir esta demanda?" confirmation (UX-02) | If the planner wants a modal confirmation instead of a plain `window.confirm()`; `AlertDialog` traps focus and is screen-reader-announced correctly out of the box, matching this project's accessibility floor |
| `select` | `@radix-ui/react-select` | A styled área/projeto/responsável filter dropdown | Optional — a plain native `<select>` (as already used for `status` in `demanda-form.tsx`) works identically for filtering and needs zero new dependency; only add `shadcn select` if visual consistency with other shadcn-styled inputs matters more than avoiding a new component |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `profiles.area_liderada` (nullable text column) | A new `lider_areas` join table (líder_id, area) | Rejected for this phase — the roadmap's own phrasing ("líder de área... vê as da sua área," singular "sua área") implies one área per líder; a join table would model multi-área leadership nothing in the requirements asks for. **Flag as `[ASSUMED]` for discuss-phase** — if the institution's real org chart has líderes leading 2+ áreas, this needs to become a join table instead, and that's a materially different migration, better decided before writing it than discovered after |
| Free-text área filter (`ilike`/`lower() =`) | A normalized `areas` lookup table with FK from `demandas` | Rejected — no phase in the roadmap builds área CRUD/management UI (same reasoning 04-RESEARCH.md already used to defer this); at "dozens of demandas" scale, typo-fragmentation risk is low and `.trim()` is already applied on write (Phase 4) |
| `searchParams` Server Component page prop for filter state | Client-side `useSearchParams()` + client-side array filtering of an already-fetched full list | Rejected as the primary pattern — Next.js's own docs (`use-search-params.md`) explicitly recommend the `searchParams` prop "when you need search parameters to load data for the page (e.g. pagination, filtering from a database)" and reserve `useSearchParams` for "filtering a list already loaded via props." Fetching the *entire* unfiltered demandas table client-side to filter it in the browser also risks exposing rows a role-scoped RLS SELECT already filters out being over-fetched needlessly (though RLS still protects the actual data — this is a data-minimization/performance concern, not a security one) |
| A new `SECURITY DEFINER` helper (`is_lider_of_area`) | Inlining the área-comparison subquery directly into each policy | Rejected — this project's own pattern (Phase 2's `has_role()`) already established that a small `SECURITY DEFINER`, `STABLE`, indexed-lookup helper function is the correct shape for a per-row RLS predicate; inlining would duplicate the same subquery across 4+ policies (demandas SELECT/UPDATE/DELETE, demanda_responsaveis SELECT) and risk them drifting out of sync |
| `AlertDialog` (shadcn) for confirmation | Native `window.confirm()` | Native `confirm()` is a valid, zero-dependency option for UX-02 and was NOT rejected — it's blocking, ugly, and not stylable, but it is keyboard-accessible and screen-reader-announced by the browser natively. Recommend `AlertDialog` only if the planner wants visual consistency with the rest of the shadcn-styled UI; otherwise `confirm()` is an acceptable, simpler default for a small volunteer-maintained codebase |

**Installation:**
```bash
# No required installs — this phase adds zero new npm dependencies.
# Optional, if the planner wants a styled confirm dialog / select:
npx shadcn@latest add alert-dialog select
```

**Version verification:** No new packages to verify against the registry. If `npx shadcn@latest add alert-dialog select` is used, it pulls `@radix-ui/react-alert-dialog` and `@radix-ui/react-select` transitively — both already audited as `[OK]` (false-positive `SUS`-too-new heuristic only, per 04-RESEARCH.md's Package Legitimacy Audit) when the `select` primitive was first introduced in Phase 4; `alert-dialog` is the same Radix/shadcn publishing cadence and trust profile.

## Package Legitimacy Audit

**This phase introduces no new required npm packages.** The only possible additions (`@radix-ui/react-alert-dialog` via `shadcn add alert-dialog`) are optional, planner's-discretion UI polish, not required to satisfy DEM-04/DEM-05/UX-02 (a native `<select>` and native `confirm()` fully satisfy the requirements without them).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@radix-ui/react-alert-dialog` (optional) | npm | Same release cadence as `@radix-ui/react-dialog`, `-select` (already audited Phase 4) | 40-70M/wk range (same family) | github.com/radix-ui/primitives | OK (by family precedent) | Approved if planner opts in |

**Packages removed due to `[SLOP]` verdict:** none — no new packages proposed.
**Packages flagged as suspicious `[SUS]`:** none.

*No packages in this research were discovered via WebSearch/training data without registry-family precedent already established in this project's own Phase 4 audit; the one optional addition inherits that precedent rather than being independently `[ASSUMED]`.*

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Browser                                                                    │
│  DemandaList filter controls (native <select>/<a> driven by <Link>)       │
│    área=Pesquisa&responsavel=<uuid>&groupBy=area  ──────┐                 │
│                                                            │ navigates via  │
│                                                            │ <Link href>    │
│                                                            ▼ (GET, no JS   │
│                                                              required)     │
└────────────────────────────────────────────────────────────┬──────────────┘
                                                               │
┌──────────────────────────────────────────────────────────────────────────┐
│ Next.js 16 Server Component — app/(dashboard)/page.tsx                    │
│  export default async function Page({ searchParams }) {                  │
│    const { area, responsavel, groupBy } = filterSchema.parse(             │
│      await searchParams                                                   │
│    );                                                                     │
│    // zod-validated — searchParams is untrusted URL input, same           │
│    // "never trust an external boundary" principle as formData            │
│  }                                                                        │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ supabase.from("demandas_com_status")
                                 │   .select(...)
                                 │   .ilike("area", `%${area}%`)   // if set
                                 │   .in("id", responsavelDemandaIds) // if set
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Supabase (Postgres) — RLS is the ACTUAL access boundary, independent      │
│ of what filter the query above requests                                  │
│                                                                            │
│  public.profiles                                                         │
│    id, email, role, area_liderada (NEW nullable text — only meaningful   │
│                                     when role = 'lider_area')             │
│         │                                                                 │
│         ▼ read by                                                        │
│  public.is_lider_of_area(area text) → boolean  (NEW, SECURITY DEFINER,   │
│    STABLE — mirrors has_role()'s shape; checks                           │
│    profiles.area_liderada = area for auth.uid())                        │
│         │                                                                 │
│         ▼ used inside                                                    │
│  public.demandas ◀── RLS narrowed this phase                             │
│    SELECT: coordenador sees all; lider_area sees own área's rows;        │
│            voluntario_comum sees only rows where they are criado_por     │
│            OR linked via demanda_responsaveis (is_responsavel_for)       │
│    UPDATE/DELETE: same visibility grant, re-verified row-by-row          │
│         │            ▲                                                   │
│         │            │ is_responsavel_for(demanda_id) → boolean (NEW,    │
│         │            │   SECURITY DEFINER, STABLE — checks               │
│         │            │   demanda_responsaveis for auth.uid())            │
│         ▼            │                                                   │
│  public.demanda_responsaveis ◀── RLS ALSO narrowed this phase            │
│    (a bare-table SELECT on demanda_responsaveis, queried without going   │
│     through demandas, is NOT automatically gated by demandas' own RLS —  │
│     see Common Pitfall 3 — its own SELECT policy must mirror the same    │
│     visibility rule independently)                                      │
│         │                                                                 │
│         ▼                                                                 │
│  public.demandas_com_status (view, security_invoker = true — inherits    │
│    whatever demandas' SELECT policy allows the querying user to see,     │
│    automatically, with NO changes needed to the view's own definition)   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
supabase/
└── migrations/
    ├── 0001_profiles.sql
    ├── 0002_profiles_role.sql
    ├── 0003_demandas.sql
    └── 0004_demandas_role_scope.sql   # Phase 5 — area_liderada column, helper
                                         # functions, narrowed SELECT/UPDATE/DELETE
                                         # policies on demandas + demanda_responsaveis
src/
└── app/
    └── (dashboard)/
        ├── page.tsx                    # extended: reads searchParams prop,
                                         # builds filter query, passes filter
                                         # state down to DemandaList for the
                                         # filter-control UI
        └── demandas/
            ├── demanda-filters.tsx     # NEW — filter controls (área/projeto/
                                         # responsável selects + groupBy toggle),
                                         # renders <Link>s that set searchParams
            ├── demanda-filter-schema.ts # NEW — zod schema validating the
                                         # searchParams object before it's used
                                         # to build a Supabase query
            ├── demanda-list.tsx        # extended: accepts a groupBy prop,
                                         # optionally renders grouped sections
                                         # instead of one flat sorted list
            └── actions.ts               # unchanged shape; concludeDemanda/
                                         # deleteDemanda now rely on the
                                         # narrowed RLS UPDATE/DELETE policy for
                                         # the actual authorization decision
tests/
└── db/
    └── demandas-rls.test.ts            # EXTENDED (not a new file) — adds the
                                         # role-scoped SELECT/UPDATE/DELETE
                                         # re-verification matrix (see
                                         # Validation Architecture)
```

### Pattern 1: `area_liderada` column + `is_lider_of_area()` helper (closing the líder-assignment gap)

**What:** A single nullable `text` column on `profiles`, only meaningful when `role = 'lider_area'`, read by a `SECURITY DEFINER` helper function mirroring `has_role()`'s exact shape.
**When to use:** Any RLS policy that needs to answer "does the calling user lead this área?"
**Example:**
```sql
-- supabase/migrations/0004_demandas_role_scope.sql (part 1)
-- Source: mirrors 0002_profiles_role.sql's has_role() pattern exactly —
-- SECURITY DEFINER + STABLE + set search_path = '' + revoke from
-- public/anon + grant to authenticated only.
-- [CITED: .agents/skills/supabase-postgres-best-practices/references/
-- security-rls-performance.md — "Use security definer functions for
-- complex checks... always include an explicit auth.uid() check inside
-- the function body"]

alter table public.profiles
  add column area_liderada text;

-- No CHECK constraint tying this to role = 'lider_area' — a coordenador
-- who is later reassigned to lider_area should be able to have this set
-- without a migration; the column's *meaning* (whether it's consulted at
-- all) is entirely governed by is_lider_of_area() checking role first,
-- not by a database-level constraint coupling the two columns together.

create or replace function public.is_lider_of_area(target_area text)
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
      and role = 'lider_area'
      and area_liderada is not null
      and lower(trim(area_liderada)) = lower(trim(target_area))
  );
$$;

revoke execute on function public.is_lider_of_area(text) from public, anon;
grant execute on function public.is_lider_of_area(text) to authenticated;
```
**Why `lower(trim(...))` comparison, not exact match:** Área is free text (Item 3) — a líder's `area_liderada` value and a demanda's `area` value must compare case/whitespace-insensitively, or a líder assigned `"Pesquisa"` silently can't see demandas tagged `"pesquisa"`. This is the one place área-normalization risk (Pitfall 2 in 04-RESEARCH.md) becomes a correctness bug, not just a cosmetic filter-fragmentation issue — treat it accordingly.
**Why not a CHECK constraint linking `area_liderada` to `role`:** A `CHECK (role != 'lider_area' OR area_liderada IS NOT NULL)` sounds appealing but breaks the "coordenador demotes someone to líder, then assigns their área in a second step" workflow (the two can't always happen atomically); enforcing it in the RLS helper (which requires *both* `role = 'lider_area'` AND a non-null `area_liderada`) is safer and doesn't block a two-step assignment UI.

### Pattern 2: `is_responsavel_for()` helper for the many-to-many join

**What:** A second `SECURITY DEFINER` helper checking `demanda_responsaveis` for the calling user, mirroring Pattern 1's shape.
**When to use:** The `demandas` SELECT/UPDATE/DELETE policies for `voluntario_comum`, and the `demanda_responsaveis` table's own SELECT policy.
**Example:**
```sql
create or replace function public.is_responsavel_for(target_demanda_id bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.demanda_responsaveis
    where demanda_id = target_demanda_id
      and profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_responsavel_for(bigint) from public, anon;
grant execute on function public.is_responsavel_for(bigint) to authenticated;
```
**Why a function, not an inline subquery in every policy:** `demandas` needs this check in its SELECT, UPDATE, and DELETE policies, and `demanda_responsaveis` needs a compatible check in its own SELECT policy (see Pitfall 3) — four call sites. A helper function keeps them from drifting, exactly the reasoning `has_role()` already established project-wide.
**Performance note:** Per the project's own RLS-performance skill, wrap `auth.uid()` calls in `(select ...)` inside the function body (already done above) so Postgres caches the value once per statement rather than re-evaluating per row; add an index on `demanda_responsaveis (profile_id)` if not already present (Phase 4's `0003_demandas.sql` already created `demanda_responsaveis_profile_id_idx` for exactly this future need).

### Pattern 3: Role-scoped SELECT/UPDATE/DELETE policies — the actual DEM-05 narrowing, with SELECT-gates-UPDATE re-verification built in from the start

**What:** Replace Phase 4's `using (true)` policies with a three-way `OR` predicate: coordenador (sees/edits all) `OR` líder-of-this-área `OR` responsável-or-criador. Applied identically to SELECT and UPDATE/DELETE so the SELECT-gates-write trap cannot reappear — this is the single most important structural decision in this migration.
**When to use:** `demandas` table policies this phase.
**Example:**
```sql
-- supabase/migrations/0004_demandas_role_scope.sql (part 2)
-- Drop Phase 4's permissive policies before creating the narrowed ones —
-- do NOT leave both in place (Postgres RLS policies are OR'd together
-- within the same command type, so a stale using(true) policy would
-- silently defeat this entire migration).

drop policy "authenticated users can view all demandas" on public.demandas;
drop policy "authenticated users can update demandas" on public.demandas;

-- SELECT and UPDATE use the IDENTICAL predicate — this is deliberate and
-- is the direct fix for Phase 2's SELECT-gates-UPDATE lesson: whatever a
-- role can see, that same role can also edit, by construction. There is
-- no scenario where a role passes this SELECT check but fails the
-- corresponding UPDATE check, because it is the same expression.
create policy "role-scoped demandas visibility"
  on public.demandas
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  );

create policy "role-scoped demandas edit"
  on public.demandas
  for update
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  );

-- DEM-05 says "vê e edita" (sees and edits) — it does not mention delete.
-- No DELETE policy is added to demandas this phase; if the planner adds a
-- "delete demanda" feature, it should use this exact same predicate for
-- the same SELECT-gates-DELETE reason.
```
**Why include `criado_por = auth.uid()` even for `voluntario_comum`:** DEM-05 says "vê e edita só suas próprias demandas" — a volunteer's "own" demandas naturally includes ones they created (even if not formally a responsável yet, e.g. before assigning anyone). Excluding this would let a volunteer create a demanda they can no longer see moments later, which is a confusing, broken UX, not a security feature.
**Why `area is not null and ...`:** `is_lider_of_area(null)` would compare `lower(trim(area_liderada)) = lower(trim(null))`, which is never true in SQL (any comparison with `NULL` is `NULL`, not `true`) — the `area is not null` guard is technically redundant for correctness but makes the policy's intent explicit and avoids relying on SQL's NULL-comparison semantics being understood correctly by a future reader.

### Pattern 4: `demanda_responsaveis` policies — mirrored, independently (Common Pitfall 3's fix)

**What:** The join table needs its own SELECT/INSERT/DELETE policies expressing the *same* visibility rule as `demandas`, because a bare `select * from demanda_responsaveis` (not joined through `demandas`) is evaluated only against `demanda_responsaveis`'s own RLS policies.
**When to use:** This migration, applied alongside Pattern 3.
**Example:**
```sql
drop policy "authenticated users can view all demanda_responsaveis" on public.demanda_responsaveis;
drop policy "authenticated users can create demanda_responsaveis" on public.demanda_responsaveis;
drop policy "authenticated users can delete demanda_responsaveis" on public.demanda_responsaveis;

-- Visibility of a responsável-link row follows the SAME rule as the
-- parent demanda: if you couldn't see the demanda, you can't see who's
-- assigned to it either. Written independently (not "join against
-- demandas and reuse its policy") because RLS policies cannot reference
-- another table's policy directly — the predicate must be restated here,
-- against demandas' columns via a subquery.
create policy "role-scoped demanda_responsaveis visibility"
  on public.demanda_responsaveis
  for select
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or profile_id = (select auth.uid())  -- you can always see your own assignment
        )
    )
  );

-- INSERT/DELETE (attaching/detaching a responsável) follow demandas'
-- EDIT predicate — if you can edit the demanda, you can manage its
-- responsável list.
create policy "role-scoped demanda_responsaveis manage"
  on public.demanda_responsaveis
  for all
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );
```
**Why `for all` here but split SELECT/UPDATE on `demandas`:** `demanda_responsaveis` has no independent UPDATE use case (Phase 4 already established swaps happen via delete-then-insert, per `0003_demandas.sql`'s own comment) — `for all` covers INSERT/UPDATE/DELETE identically, which is correct since there's no scenario where this table's insert/delete permissions should differ from each other.
**This IS the answer to Item 6 (does narrowing `demandas` SELECT also require a matching narrowed SELECT on `demanda_responsaveis`):** Yes — explicitly, unconditionally yes. The parent table's RLS does not cascade to a child/join table automatically. A direct query against `demanda_responsaveis` (e.g. "which demandas is user X responsável for," needed by Phase 7's reminder targeting) is checked only against `demanda_responsaveis`'s own policies.

### Pattern 5: `searchParams`-driven server-side filtering (DEM-04)

**What:** Filter state lives in the URL query string, read via the Server Component page's `searchParams` prop (a `Promise` in Next.js 16, per the official docs already read for this phase), validated with `zod`, and applied as Supabase query modifiers before the data ever reaches the client.
**When to use:** The `/` (dashboard) page's demandas list.
**Example:**
```typescript
// src/app/(dashboard)/demandas/demanda-filter-schema.ts
import { z } from "zod";

// searchParams is untrusted URL input — same boundary-validation principle
// Phase 4 already applied to formData (RESEARCH.md Pattern 5).
export const demandaFilterSchema = z.object({
  area: z.string().trim().min(1).optional(),
  responsavel: z.string().uuid().optional(),
  groupBy: z.enum(["area", "responsavel"]).optional(),
});

export type DemandaFilters = z.infer<typeof demandaFilterSchema>;
```
```typescript
// src/app/(dashboard)/page.tsx (extended)
// Source: node_modules/next/dist/docs/01-app/01-getting-started/
// 03-layouts-and-pages.md — "In a Server Component page, you can access
// search parameters using the searchParams prop... opts your page into
// dynamic rendering" [CITED: official docs, read directly per AGENTS.md]
import { demandaFilterSchema } from "./demandas/demanda-filter-schema";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const filters = demandaFilterSchema.parse({
    area: typeof raw.area === "string" ? raw.area : undefined,
    responsavel: typeof raw.responsavel === "string" ? raw.responsavel : undefined,
    groupBy: typeof raw.groupBy === "string" ? raw.groupBy : undefined,
  });

  const supabase = await createClient();
  let query = supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, atrasada")
    .order("prazo", { ascending: true });

  // RLS still governs which rows are visible underneath this filter —
  // a voluntário comum applying area=Pesquisa never sees a row RLS
  // already hides, regardless of what the filter requests.
  if (filters.area) {
    query = query.ilike("area", filters.area); // case-insensitive, no normalization needed at this scale (Item 3)
  }

  const { data: demandas } = await query;
  // ... responsavel filter applied via a second query against
  // demanda_responsaveis (mirrors the existing N+1-adjacent pattern
  // page.tsx already uses for responsavelEmails — see 04-RESEARCH.md's
  // accepted tradeoff note).
}
```
```tsx
// src/app/(dashboard)/demandas/demanda-filters.tsx — filter controls as
// plain <Link>s, NOT a client-side useSearchParams() + router.push()
// pattern — this keeps the filter bar working even with JS disabled/slow,
// and every filter state is a real, bookmarkable, back-button-friendly URL.
import Link from "next/link";

export function AreaFilterLink({ area, active }: { area: string; active: boolean }) {
  return (
    <Link
      href={`/?area=${encodeURIComponent(area)}`}
      className={`min-h-14 rounded-lg px-4 py-2 text-xl ${active ? "bg-blue-700 text-white" : "bg-zinc-100 text-zinc-900"}`}
      aria-current={active ? "true" : undefined}
    >
      {area}
    </Link>
  );
}
```
**Why `searchParams` prop, not `useSearchParams()` client hook:** Next.js's own docs are explicit: use the `searchParams` prop "when you need search parameters to load data for the page (e.g. pagination, filtering from a database)"; reserve `useSearchParams` for "filtering a list already loaded via props" client-side. This project already fetches server-side (Phase 4's `page.tsx`) — filtering should extend that same fetch, not fork into a second client-side data flow.
**Why plain `<Link>`, not a `<select onChange>` + `router.push()`:** A native `<select>` still works well as the *visual* filter control (wrap it in a small client component that calls `router.push` on change, if a dropdown is preferred over a row of filter chips) — either is valid; the important architectural point is that whichever control is used, it changes the URL, and the Server Component re-fetches from that URL. Do not filter an already-fetched full list client-side in JavaScript state.

### Pattern 6: Confirm-before-action UI (UX-02)

**What:** A lightweight confirmation step before "concluir"/"excluir" actions, using either native `confirm()` or a shadcn `AlertDialog`.
**When to use:** Any destructive or hard-to-reverse action — concluding a demanda (reversible, lower stakes) is a good candidate for a lighter confirm; deleting one (if the planner adds delete — not required by DEM-02/DEM-05, not currently built) would warrant `AlertDialog`'s stronger modal treatment.
**Example:**
```tsx
// A minimal, zero-new-dependency version — acceptable for "concluir":
"use client";
export function ConcludeButton({ demandaId, onConclude }: { demandaId: number; onConclude: (id: number) => void }) {
  return (
    <button
      type="button"
      className="min-h-14 rounded-lg bg-green-700 px-4 py-3 text-xl text-white"
      onClick={() => {
        if (window.confirm("Marcar esta demanda como concluída?")) {
          onConclude(demandaId);
        }
      }}
    >
      Concluir
    </button>
  );
}
```
**Why this satisfies UX-02 without new UI complexity:** "Confirmação clara em ações importantes" doesn't require a styled modal — a native `confirm()` dialog IS a clear confirmation, is keyboard-navigable and screen-reader-announced by every browser natively, and needs no new Radix dependency. If the planner or discuss-phase prefers visual consistency with the rest of the shadcn-styled app, swap in `AlertDialog` — functionally equivalent, more setup.
**Short forms (the other half of UX-02):** No new form is needed this phase — the existing 5-field `demanda-form.tsx` (Phase 4) already satisfies "poucos campos por tela." The filter controls added this phase (Pattern 5) are not a form in the mutation sense and don't need `react-hook-form`; they're `<Link>`-driven navigation, which has no submit/validate lifecycle to confirm.

### Anti-Patterns to Avoid

- **Narrowing `demandas` SELECT without narrowing `demanda_responsaveis` SELECT in the same migration:** Reproduces Common Pitfall 3 exactly — a voluntário comum who can no longer SELECT a colleague's demanda directly could still, if `demanda_responsaveis` keeps its old `using (true)` policy, read who's assigned to demandas they can't otherwise see (a real, if minor, information-disclosure gap), and — more importantly for correctness — this project's Phase 7 (reminder targeting) and Phase 6 (coordinator overview) queries will assume `demanda_responsaveis` respects the same visibility boundary `demandas` does.
- **Testing only the "denied" direction of role-scoping:** It's easy to write a test proving "voluntário comum cannot see another área's demanda" and stop there. Per Phase 2's own lesson, the SELECT-gates-UPDATE trap manifests as a false *positive* for correctness in the *allowed* direction — a role that SHOULD be able to edit a row it can see might silently fail to, if the UPDATE policy's predicate doesn't exactly match the SELECT policy's. Every role-scoping test in this phase must assert **both** "correctly denied where expected" and "correctly succeeds where expected, verified via a service-role re-read" — mirroring exactly the structure `demandas-rls.test.ts` already uses for DEM-02.
- **Comparing `area_liderada` to `demandas.area` with exact `=` instead of case/whitespace-insensitive comparison:** Given área is free text (no normalization table), an exact-match comparison would silently exclude a líder from seeing demandas that are, to a human, obviously in "their" área but differ by casing/whitespace — a correctness bug disguised as an access-control feature.
- **Building a `lider_areas` many-to-many join table speculatively "in case a líder leads multiple áreas someday":** Nothing in PROJECT.md/ROADMAP.md/REQUIREMENTS.md asks for multi-área leadership; the roadmap's own phrasing is singular. Building the more complex structure without a concrete requirement is the same "premature structure" mistake 04-RESEARCH.md already flagged for a hypothetical `areas` table. If discuss-phase reveals a real need, it's a bigger, separate migration decision — not something to hedge on speculatively now.
- **Filtering the demandas list client-side after fetching the unfiltered set:** Defeats the purpose of `searchParams`-driven server fetching (Pattern 5), risks fetching rows in JS memory the UI then has to correctly re-hide, and diverges from this project's established "Server Component fetches from Supabase directly" pattern (Phase 4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Does the calling user lead this área?" check, repeated across policies | An inline subquery copy-pasted into 4+ RLS policies | A single `is_lider_of_area()` `SECURITY DEFINER` helper (Pattern 1) | Mirrors `has_role()`'s already-proven shape; a single function is one place to fix if the área-comparison logic (e.g. normalization) ever needs to change, instead of four |
| "Is this user responsável for this demanda?" check | An inline `exists(select 1 from demanda_responsaveis where ...)` repeated in `demandas`' SELECT/UPDATE and `demanda_responsaveis`' own SELECT | `is_responsavel_for()` helper (Pattern 2) | Same reasoning — one definition, multiple call sites, no drift risk |
| URL-driven filter state management | A client-side global filter store (Context/Zustand) synced awkwardly with the URL | The `searchParams` Server Component prop + `<Link>`-based navigation (Pattern 5) | The URL IS the state — Next.js's own router already handles this correctly; introducing a parallel client store to "also" track filter state is a common source of the URL and the UI silently disagreeing after a back-button press |
| Confirmation-before-destructive-action UX | A hand-rolled modal with manual focus-trap/ESC-to-close/backdrop-click logic | `window.confirm()` (zero-dependency) or shadcn's `AlertDialog` (Radix-backed, if styling matters) | Exactly the same reasoning 04-RESEARCH.md already applied to shadcn's `dialog`/`select` — focus management and keyboard/screen-reader behavior for modals is a well-known hand-rolling trap, especially relevant given this audience's accessibility requirements |

**Key insight:** This phase's hardest problem isn't writing new SQL predicates — it's making sure the SELECT predicate and the UPDATE/DELETE predicate for the same table are provably identical (or at least that UPDATE/DELETE's predicate visibility is a subset of SELECT's, never a superset), because Postgres's RLS execution model makes divergence between them invisible at write time. Pattern 3's design (literally copy-pasting the same `using` expression into both the SELECT and UPDATE policy bodies) is the simplest possible way to guarantee this by construction, and is preferred here over any abstraction that might let the two drift apart later.

## Runtime State Inventory

**Trigger check: this phase is not a rename/refactor/migration of an existing string or identifier** — it is a new-column-plus-narrowed-RLS phase on top of existing tables, not a rename. However, since it *does* change existing runtime behavior (previously-permissive RLS becomes restrictive), the "what breaks after this ships" question deserves the same explicit accounting a rename phase would get:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `demandas`/`demanda_responsaveis` rows created under Phase 4's permissive RLS are unaffected in content — no data migration needed. However, **existing `profiles` rows for any líder-role accounts have `area_liderada = NULL`** by definition (the column is new) — any account already assigned `role = 'lider_area'` before this migration runs will see **zero** demandas under the new área-scoped SELECT policy (only their own criado_por/responsável rows) until a coordenador manually sets their `area_liderada`. | Data migration/manual step: after `db push`, a coordenador must UPDATE each existing `lider_area` profile's `area_liderada` — this is not automatable from the migration itself (the database has no way to infer which área an existing líder leads); document this as a required manual post-migration step, similar in spirit to Phase 2's coordinator backfill note. |
| Live service config | None — no external service (Vercel Cron, Resend, etc.) references RLS policies or área assignments. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — no new env vars. | None. |
| Build artifacts | None — no renamed packages/paths. | None. |

**Nothing found requiring code-only vs. data-migration disambiguation beyond the `area_liderada` backfill above** — verified by reading `0001`-`0003` migrations and the current `profiles`/`demandas` schema directly; no other runtime state references role/área outside these tables.

## Common Pitfalls

### Pitfall 1: Assuming the SELECT-gates-UPDATE fix from Phase 2/4 "already happened" and doesn't need re-checking

**What goes wrong:** A líder de área's UPDATE on a colleague's demanda in their área reports success (`error: null`) but the row is silently unchanged, because the SELECT policy's `is_lider_of_area()` predicate has a subtle bug (e.g. exact-match instead of case-insensitive comparison) that the UPDATE policy inherited identically — so both silently fail together, masking the bug as "it's just not visible, so of course it can't be edited," when actually a *correct* implementation would make it visible AND editable.
**Why it happens:** This is the exact mechanism documented in `0002_profiles_role.sql`'s own migration comment and reproduced deliberately in `0003_demandas.sql` — an UPDATE's target row lookup is itself gated by SELECT policies, evaluated first, silently.
**How to avoid:** Test both directions explicitly for every role (see Anti-Patterns), and specifically test the líder-of-área case with a deliberately messy real-world área string (mixed case, trailing space) to catch the exact-match version of this bug before it ships.
**Warning signs:** A live-integration test that only asserts "denied" cases pass, with no matching "this role CAN still edit rows it should be able to see" assertions for the líder-of-área and responsável-of-demanda paths specifically (not just the already-covered coordenador path from Phase 4).

### Pitfall 2: `demanda_responsaveis` keeping its Phase 4 permissive policies after `demandas` narrows

**What goes wrong:** A direct query against `demanda_responsaveis` (not joined through `demandas`) — which Phase 7's reminder-targeting logic and Phase 6's dashboard aggregation will both plausibly want to do ("which demandas is this user responsável for, across the whole system") — returns rows for demandas the querying user's own RLS on `demandas` would never let them see directly. This isn't a full security hole (the demanda's own content is still protected), but it is a real, avoidable data leak of *who is assigned to what*, and it's inconsistent with the narrowing this phase's whole point is to introduce.
**Why it happens:** RLS policies on one table are never automatically inherited by a related table, even a tightly-coupled join table — this is documented in this project's own supabase skill (Pattern 4 above) and was flagged explicitly as an open research question for this phase (Item 6).
**How to avoid:** Ship Pattern 4's mirrored `demanda_responsaveis` policies in the SAME migration as `demandas`' narrowing — never as a follow-up "we'll get to it" fix, exactly the discipline `0003_demandas.sql`'s own comments already modeled ("deliberately reproduces the... fix by shipping both policies together, never as a follow-up").
**Warning signs:** A test that queries `demanda_responsaveis` directly (not via a join) as a non-privileged role and gets back rows for a demanda that same role's `demandas` SELECT policy would deny.

### Pitfall 3: `demandas_com_status` view silently exposing rows the narrowed base-table policy would deny

**What goes wrong:** If the view's `security_invoker = true` setting were ever accidentally dropped or overridden in a future migration, it would revert to running with the view owner's (likely elevated) privileges, bypassing every role-scoping decision this phase makes — every reader would see every row regardless of role, the exact opposite of DEM-05.
**Why it happens:** `security_invoker` is a per-view setting, not something automatically re-verified when the underlying table's RLS changes; Postgres won't warn you if it silently stops matching the base table's intent.
**How to avoid:** This phase's migration does not need to re-create the view (it already has `security_invoker = true` from Phase 4, per `0003_demandas.sql`) — but the phase's test suite SHOULD add an explicit assertion that `demandas_com_status` still respects the new narrowed policy (query it as a `voluntario_comum` fixture and confirm only their own rows come back), not just assume the Phase 4-era setting is untouched.
**Warning signs:** A test that queries `demandas_com_status` as a role-scoped user and gets back MORE rows than an equivalent direct `demandas` query returns for that same user — any discrepancy means the view and the base table have diverged.

### Pitfall 4: The área-to-líder gap being "solved" only in the UI (an admin screen to assign líderes) without the RLS-facing column existing

**What goes wrong:** A tempting shortcut is to build a coordenador-only "assign líder to área" screen this phase without adding the actual `area_liderada` column/helper function — deferring the real RLS enforcement to "later." This would ship DEM-05's UI appearance without its substance: a líder would still see all demandas (or none), because no database-level mechanism exists to scope them.
**Why it happens:** UI work is often more visible/satisfying to demo than a schema migration, and CLAUDE.md's own "What NOT to Use" table already warns about exactly this class of mistake ("relying solely on client-side role checks... for authorization").
**How to avoid:** The `area_liderada` column and `is_lider_of_area()` helper (Pattern 1) are prerequisites for the RLS policies (Pattern 3), which are the actual DEM-05 mechanism — build them first, in the same migration, before any assignment UI. A coordenador-facing "assign área to líder" UI (editing `profiles.area_liderada`) is a reasonable, small addition this phase, but it's UX sugar around a column that must exist and be enforced regardless of whether that UI ships in this phase or a later one.
**Warning signs:** A plan that has a UI task for líder-área assignment but no corresponding RLS-policy task, or vice versa.

### Pitfall 5: Área filter (`ilike`) accidentally becoming a substring match that returns unrelated áreas

**What goes wrong:** Using `.ilike("area", filters.area)` without wildcards performs an exact case-insensitive match (fine) — but a naive `.ilike("area", `%${filters.area}%`)` (substring match) used for a *filter dropdown value* (rather than free-text search) could match "Pesquisa" against a user-typed "esquis" fragment unexpectedly, or worse, if the filter value itself isn't escaped, `%`/`_` characters inside an área name (unlikely but not impossible in free text) could produce surprising matches.
**Why it happens:** `ilike` wildcard semantics are easy to reach for by habit ("filters usually want partial match") without considering that a filter *dropdown* (populated from `DISTINCT area`, per Item 3) should almost always use an exact (case-insensitive) match against a known value, not a substring search.
**How to avoid:** For the filter-by-selecting-a-known-área use case (DEM-04's primary UI), use exact case-insensitive comparison (`lower(area) = lower(filters.area)` or `.ilike("area", filters.area)` with no wildcards) — reserve substring `%...%` matching only if the planner adds a free-text área search box as a *separate*, explicitly-labeled feature.
**Warning signs:** Selecting "Pesquisa" in the área filter dropdown also returns demandas tagged "Pesquisa de Campo" unexpectedly.

## Code Examples

### Full role-scoping migration (schema + helpers + policies)

```sql
-- supabase/migrations/0004_demandas_role_scope.sql
-- Closes the área-to-líder data-model gap (area_liderada column + helper)
-- and narrows demandas/demanda_responsaveis RLS from Phase 4's permissive
-- baseline to DEM-05's role/ownership scoping. SELECT and UPDATE/DELETE
-- predicates are IDENTICAL by construction on demandas, and
-- demanda_responsaveis' own policies are rewritten in the same migration
-- (never deferred) — both are the direct, deliberate carry-forward of
-- Phase 2's SELECT-gates-UPDATE lesson, flagged explicitly in
-- 04-CONTEXT.md and 0003_demandas.sql's own comments as this phase's job.
-- Sources: .agents/skills/supabase/SKILL.md ("UPDATE requires a SELECT
-- policy... views bypass RLS by default") [CITED: project-installed
-- skill]; .agents/skills/supabase-postgres-best-practices/references/
-- security-rls-performance.md (SECURITY DEFINER helper pattern, wrap
-- auth.uid() in select for caching) [CITED: project-installed skill];
-- 0002_profiles_role.sql's has_role() precedent [CITED: this repo].

alter table public.profiles
  add column area_liderada text;

create or replace function public.is_lider_of_area(target_area text)
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
      and role = 'lider_area'
      and area_liderada is not null
      and lower(trim(area_liderada)) = lower(trim(target_area))
  );
$$;

revoke execute on function public.is_lider_of_area(text) from public, anon;
grant execute on function public.is_lider_of_area(text) to authenticated;

create or replace function public.is_responsavel_for(target_demanda_id bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.demanda_responsaveis
    where demanda_id = target_demanda_id
      and profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_responsavel_for(bigint) from public, anon;
grant execute on function public.is_responsavel_for(bigint) to authenticated;

drop policy "authenticated users can view all demandas" on public.demandas;
drop policy "authenticated users can update demandas" on public.demandas;

create policy "role-scoped demandas visibility"
  on public.demandas
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  );

create policy "role-scoped demandas edit"
  on public.demandas
  for update
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  );

drop policy "authenticated users can view all demanda_responsaveis" on public.demanda_responsaveis;
drop policy "authenticated users can create demanda_responsaveis" on public.demanda_responsaveis;
drop policy "authenticated users can delete demanda_responsaveis" on public.demanda_responsaveis;

create policy "role-scoped demanda_responsaveis visibility"
  on public.demanda_responsaveis
  for select
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or profile_id = (select auth.uid())
        )
    )
  );

create policy "role-scoped demanda_responsaveis manage"
  on public.demanda_responsaveis
  for all
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

-- demandas_com_status already has security_invoker = true from
-- 0003_demandas.sql — no change needed; it automatically inherits this
-- migration's narrowed policies (Pitfall 3's re-verification is a TEST
-- concern, not a migration-code concern, precisely because the view
-- requires no changes here).
```

### Filter query (Server Component, extended `page.tsx`)

```typescript
// src/app/(dashboard)/page.tsx (extended — area + responsavel filters)
import { demandaFilterSchema } from "./demandas/demanda-filter-schema";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const filters = demandaFilterSchema.parse({
    area: typeof raw.area === "string" ? raw.area : undefined,
    responsavel: typeof raw.responsavel === "string" ? raw.responsavel : undefined,
    groupBy: typeof raw.groupBy === "string" ? raw.groupBy : undefined,
  });

  const supabase = await createClient();

  let demandaIdsForResponsavel: number[] | null = null;
  if (filters.responsavel) {
    const { data: links } = await supabase
      .from("demanda_responsaveis")
      .select("demanda_id")
      .eq("profile_id", filters.responsavel);
    demandaIdsForResponsavel = (links ?? []).map((l) => l.demanda_id);
  }

  let query = supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, atrasada")
    .order("prazo", { ascending: true });

  if (filters.area) {
    query = query.ilike("area", filters.area); // exact case-insensitive match, no wildcards (Pitfall 5)
  }
  if (demandaIdsForResponsavel) {
    query = query.in("id", demandaIdsForResponsavel);
  }

  const { data: demandas } = await query;
  // ...pass demandas + filters down to DemandaList/DemandaFilters as before
}
```

### Test extension pattern (role-scoping re-verification — extends `demandas-rls.test.ts`)

```typescript
// tests/db/demandas-rls.test.ts (Phase 5 additions — same file, same
// fixture/cleanup pattern already established; NOT a new test file)

it("DEM-05: lider_area can see and edit a demanda in their área, but not one outside it", async () => {
  const lider = await createFixtureUser();
  await admin.from("profiles").update({
    role: "lider_area",
    area_liderada: "Pesquisa",
  }).eq("id", lider.id);

  const outsider = await createFixtureUser(); // voluntario_comum, default role

  const outsiderClient = await signInAs(outsider);
  const { data: inRangeDemanda } = await outsiderClient
    .from("demandas")
    .insert({ titulo: "Dentro da área", prazo: "2027-05-01", area: "pesquisa" }) // deliberately mixed case vs "Pesquisa"
    .select("id").single();
  createdDemandaIds.push(inRangeDemanda!.id);

  const { data: outOfRangeDemanda } = await outsiderClient
    .from("demandas")
    .insert({ titulo: "Fora da área", prazo: "2027-05-01", area: "Financeiro" })
    .select("id").single();
  createdDemandaIds.push(outOfRangeDemanda!.id);

  const liderClient = await signInAs(lider);

  // Visibility: sees the in-área demanda (case-insensitive match proves
  // Pitfall 1's normalization concern is actually handled), not the other.
  const { data: visible } = await liderClient
    .from("demandas")
    .select("id")
    .in("id", [inRangeDemanda!.id, outOfRangeDemanda!.id]);
  expect((visible ?? []).map((d) => d.id)).toEqual([inRangeDemanda!.id]);

  // Edit: succeeds on the in-área row — re-verified via service-role
  // re-read, per this project's established observation contract.
  const { error: updateError } = await liderClient
    .from("demandas")
    .update({ titulo: "Editado pelo líder" })
    .eq("id", inRangeDemanda!.id);
  expect(updateError).toBeNull();

  const { data: reread } = await admin
    .from("demandas")
    .select("titulo")
    .eq("id", inRangeDemanda!.id)
    .single();
  expect(reread?.titulo).toBe("Editado pelo líder");

  // Edit denial on the out-of-range row: success-with-zero-rows, verified
  // via service-role re-read showing the title UNCHANGED (Phase 2's exact
  // "success-with-zero-rows is not proof of a correct deny" lesson).
  const { error: deniedUpdateError } = await liderClient
    .from("demandas")
    .update({ titulo: "Não deveria mudar" })
    .eq("id", outOfRangeDemanda!.id);
  expect(deniedUpdateError).toBeNull();

  const { data: unchanged } = await admin
    .from("demandas")
    .select("titulo")
    .eq("id", outOfRangeDemanda!.id)
    .single();
  expect(unchanged?.titulo).toBe("Fora da área");
});

it("DEM-05: demanda_responsaveis SELECT is independently scoped, not just via a demandas join (Pitfall 2/Common Pitfall 3)", async () => {
  const criador = await createFixtureUser();
  const outsider = await createFixtureUser();

  const criadorClient = await signInAs(criador);
  const { data: demanda } = await criadorClient
    .from("demandas")
    .insert({ titulo: "Privada", prazo: "2027-06-01", area: "Restrita" })
    .select("id").single();
  createdDemandaIds.push(demanda!.id);

  await criadorClient.from("demanda_responsaveis").insert({
    demanda_id: demanda!.id,
    profile_id: criador.id,
  });

  const outsiderClient = await signInAs(outsider);
  // Direct query against the join table, NOT joined through demandas —
  // this is exactly the query shape Pitfall 2 warns about.
  const { data: leaked } = await outsiderClient
    .from("demanda_responsaveis")
    .select("demanda_id, profile_id")
    .eq("demanda_id", demanda!.id);

  expect(leaked ?? []).toHaveLength(0);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Phase 4's permissive `using (true)` RLS on `demandas`/`demanda_responsaveis` | Role/ownership-scoped RLS via `has_role()` + two new helper functions (`is_lider_of_area`, `is_responsavel_for`) | This phase — was always the documented plan (04-RESEARCH.md's own forward-looking notes named this exact moment) | Any code or test written against Phase 4's "every authenticated user sees/edits everything" assumption must be revisited; `demandas-rls.test.ts`'s Phase 4 tests (e.g. "a different authenticated user can edit an existing demanda's fields") will need re-scoping — a truly unrelated user (not criado_por, not responsável, not líder of that área, not coordenador) can no longer edit an arbitrary demanda after this migration, which is DEM-05's entire point |
| No área-to-líder relationship anywhere in the schema | `profiles.area_liderada` (nullable text) | This phase — closes a gap that existed since Phase 2 (role enum) without ever being addressed | Any future phase referencing "the líder of área X" (none currently planned beyond Phase 5/6) now has a concrete column to query |
| `useSearchParams()` client hook as the default filtering approach (a common general Next.js pattern from training data) | `searchParams` Server Component page prop for data-driven filters, per this project's own established Server Component fetch pattern | Not a Next.js version change — a project-specific pattern-consistency decision, reinforced by Next.js's own docs distinguishing the two hook's intended uses | Ensures filter changes don't fork into a second client-side data-fetching path alongside the existing server-side one |

**Deprecated/outdated:** Nothing in this phase's stack is deprecated — all patterns extend Phase 1-4's currently-active conventions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A líder de área leads exactly one área (`area_liderada` as a single nullable text column, not a join table) — inferred from ROADMAP.md's singular phrasing ("sua área") | Summary, Pattern 1, Alternatives Considered | Medium — if the real org structure has líderes leading multiple áreas, this column needs to become a `lider_areas` join table instead; the RLS helper function's signature (`is_lider_of_area(text)`) would change from a single-row lookup to an `exists(... where area = any(...))`-style check, a moderate but not drastic rework |
| A2 | No área normalization (lookup table or shadow column) is needed at this project's documented scale ("dozens of demandas, not thousands," per this project's own CLAUDE.md) | Summary, Item 3, Pattern 5 | Low-Medium — carries forward 04-RESEARCH.md's identical open question (Assumption/Open Question there); if discuss-phase or real usage reveals área-name fragmentation is already a practical problem, the case-insensitive `lower(trim(...))` comparisons in this phase's RLS helpers (Pattern 1) already mitigate the RLS-correctness risk, but the filter-dropdown UX (Pattern 5) would still benefit from a `DISTINCT lower(area)` grouping step the planner should consider |
| A3 | `criado_por = auth.uid()` should remain part of a `voluntario_comum`'s visibility/edit grant even though DEM-05's wording emphasizes "responsável," not "criador" | Pattern 3 | Low — if this is wrong (the institution wants ONLY responsável-assignment to grant access, never authorship alone), removing this clause from the policy is a one-line change; the risk of leaving it in is low since it only ever *expands* what a creator can see/edit to include their own creations, which matches ordinary user expectations |
| A4 | DEM-05 does not require a DELETE capability on `demandas` — only SELECT/UPDATE narrowing was in scope, since no delete feature exists in the current UI/requirements | Pattern 3 | Low — if a future phase adds "excluir demanda," it needs its own DELETE policy using this same predicate; flagged explicitly in Pattern 3's comment so it isn't missed |
| A5 | The `demanda_responsaveis` "manage" policy (INSERT/DELETE) should use `demandas`' EDIT predicate, not a separate, more permissive one (e.g. "any responsável can add another responsável even to a demanda outside their área") | Pattern 4 | Low-Medium — a stricter reading (only the líder/coordenador/criador can change WHO is responsible, but any current responsável can only view) is also defensible; this is a discuss-phase-worthy nuance if the institution has a strong opinion about who can reassign responsibility |

**If this table is empty:** N/A — see rows above. A1 and A2 are the two decisions this research explicitly flags as needing discuss-phase confirmation (per the phase's own task description); A3-A5 are lower-stakes implementation-detail assumptions embedded in the RLS predicate design.

## Open Questions

1. **Does any líder de área lead more than one área in real institutional practice?**
   - What we know: The roadmap's grammar implies one área per líder; the project has no área-management UI or roster to check against.
   - What's unclear: Whether this is a real organizational constraint or just how the requirement happened to be phrased.
   - Recommendation: Confirm explicitly in discuss-phase before implementing Pattern 1 as a single nullable column — this is the one design decision in this research most worth a direct question to the user, since retrofitting a join table after `area_liderada text` ships to production is more migration work than deciding correctly up front.

2. **Who is allowed to assign/change a líder's `area_liderada` value?**
   - What we know: This is new state the database needs; per CLAUDE.md's authorization principle, it must be RLS-gated on `profiles`, not just hidden in a UI.
   - What's unclear: Whether this phase should also ship a coordenador-only UI/Server Action to set it, or whether the coordinator sets it directly via the Supabase dashboard/SQL for now (matching how Phase 2's initial coordinator backfill was handled structurally, not via UI).
   - Recommendation: A minimal coordenador-only Server Action (extend `profiles` UPDATE policy, already coordenador-scoped per `0002_profiles_role.sql`) is low-effort to add in this phase since the RLS groundwork already exists; if the planner wants to descope UI for this, direct SQL/dashboard editing is an acceptable stopgap, flagged for discuss-phase.

3. **Should the área/responsável filter and the líder's área-scoping share the same "known áreas" source (e.g. both driven by a `DISTINCT area` query), or are they independent?**
   - What we know: Both need to compare against the same free-text área values.
   - What's unclear: Whether the filter dropdown should show ALL áreas system-wide (coordenador view) or only áreas the current role can see (a líder's filter dropdown showing only "their" área would be a redundant single-option control).
   - Recommendation: Derive the filter dropdown's options from `DISTINCT area` over whatever the RLS-scoped query already returns for that user (not a separate unscoped query) — this naturally makes a líder's filter dropdown show only their own área's values without extra logic, since RLS already narrowed the underlying rows.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server Components, Vitest tests | Yes (confirmed Phase 1-4) | v24.17.0 | — |
| Supabase CLI | `db push` for `0004_demandas_role_scope.sql` | No (not on PATH, consistent with Phase 1-4) | — | `npx supabase@latest db push` — established pattern |
| Docker | pgTAP (`supabase test db`) | No (confirmed again, consistent with Phase 1-4) | — | Continue the Vitest-against-live-hosted-project integration pattern (extend `tests/db/demandas-rls.test.ts`) |
| npm registry access | Optional `shadcn add alert-dialog select` | Yes | — | Native `<select>`/`confirm()` fallback requires no registry access at all |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:**
- Docker — blocks pgTAP entirely, same as Phase 1-4; this phase's RLS re-verification proof relies on the established Vitest + live hosted project pattern (extending, not replacing, `demandas-rls.test.ts`).
- Supabase CLI (global) — use `npx supabase@latest db push`, same as Phase 1-4.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (already installed and configured, Phase 1) |
| Config file | `vitest.config.ts` (testTimeout already raised to 30000ms for network-crossing assertions) |
| Quick run command | `npx vitest run tests/db/demandas-rls.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEM-05 | `coordenador_geral` sees and edits every demanda regardless of área/responsável (regression — must still hold after narrowing) | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "coordenador"` | ❌ Wave 0 (extend existing file) |
| DEM-05 | `lider_area` sees/edits only demandas in their `area_liderada` (case-insensitive match), denied outside it, with service-role re-read proof on both the allowed AND denied paths | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "lider_area"` | ❌ Wave 0 |
| DEM-05 | `voluntario_comum` sees/edits only demandas where they are `criado_por` OR linked via `demanda_responsaveis`, denied for all others | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "voluntario_comum"` | ❌ Wave 0 |
| DEM-05 | `demanda_responsaveis` SELECT is independently scoped (a direct, non-joined query against it does not leak rows for demandas the querying role can't see via `demandas`) | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "independently scoped"` | ❌ Wave 0 |
| DEM-05 | `demandas_com_status` view still respects the narrowed policy (no divergence from a direct `demandas` query for the same role) | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "view respects"` | ❌ Wave 0 |
| DEM-04 | Filtering by área (`.ilike`, exact case-insensitive match) returns only matching rows, still gated by RLS underneath | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "filter by area"` | ❌ Wave 0 |
| DEM-04 | Filtering by responsável returns only demandas linked to that profile via `demanda_responsaveis` | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "filter by responsavel"` | ❌ Wave 0 |
| DEM-04 | Grouping by área/responsável in the UI produces correct group membership (unit test on the grouping function, no live DB needed) | unit | `npx vitest run tests/actions/demanda-filter-schema.test.ts` | ❌ Wave 0 |
| UX-02 | Confirmation step blocks the conclude/delete action from firing until confirmed (component-level test if the planner adds `AlertDialog`; otherwise a manual UAT check for native `confirm()`, which cannot be reliably unit-tested via `window.confirm` mocking without extra tooling) | manual-only (native confirm) or unit (if AlertDialog) | manual UAT step | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/db/demandas-rls.test.ts` (extended file) and `tests/actions/demanda-filter-schema.test.ts` once it exists
- **Per wave merge:** full `npm test`
- **Phase gate:** Full suite green + a manual UAT pass signing in as each of the 4 roles (using real or fixture accounts) and confirming: (1) each role's demandas list shows exactly the expected subset, (2) each role can/cannot edit exactly as expected, (3) the área/responsável filter narrows the visible list correctly, (4) the "concluir" confirmation step appears before the action fires — before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Extend `tests/db/demandas-rls.test.ts` with the role-scoping re-verification matrix (coordenador/líder/voluntário × allowed/denied × SELECT/UPDATE, plus the `demanda_responsaveis` independent-scoping check and the `demandas_com_status` view-parity check) — see Code Examples for the concrete test shapes
- [ ] `tests/actions/demanda-filter-schema.test.ts` — unit tests for the new `zod` filter schema (no live DB needed, pure validation logic, mirrors `demanda-schema.test.ts`'s pattern from Phase 4)
- No new framework/fixture install needed — reuses Phase 1-4's `describe.skipIf(!canRun)` live-credential pattern and the "assert only via service-role re-reads" observation contract

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | no (unchanged from Phase 1/2) | Not touched this phase |
| V3 Session Management | no (unchanged from Phase 1/2) | Not touched this phase |
| V4 Access Control | **yes — this is this phase's core work** | Role/ownership-scoped RLS policies on `demandas`/`demanda_responsaveis` (Patterns 1-4); new `SECURITY DEFINER` helper functions with `revoke ... from public, anon` + `grant ... to authenticated` (mirrors Phase 2's `has_role()` lockdown exactly); explicit re-verification of SELECT-gates-write behavior for every role, not just the previously-tested coordenador path |
| V5 Input Validation | yes | `searchParams` (untrusted URL input) validated via `zod` before use in a Supabase query (Pattern 5) — same boundary-validation principle already applied to `formData` in Phase 4 |
| V6 Cryptography | no (unchanged from Phase 1/2) | Not touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Broken access control via SELECT-gates-write gap (a role that should have write access loses it silently because the SELECT and UPDATE/DELETE predicates diverge) | Elevation of Privilege (in the deny-when-should-allow direction, this is an availability/correctness bug, not a security hole — but the SAME mechanism, if predicates diverge the OTHER way, could permit a write on a row the role can't officially see, which IS an EoP risk) | Identical `using`/`with check` predicates on SELECT and UPDATE (Pattern 3) by construction, plus explicit dual-direction test coverage (Anti-Patterns, Validation Architecture) |
| Information disclosure via un-scoped join-table queries (`demanda_responsaveis` bypassing `demandas`' own RLS narrowing) | Information Disclosure | Independent, mirrored RLS policy on `demanda_responsaveis` in the same migration (Pattern 4, Common Pitfall 2) |
| Privilege escalation via líder self-assignment of `area_liderada` | Elevation of Privilege | `profiles` UPDATE remains coordenador-only per `0002_profiles_role.sql`'s existing policy — no change needed this phase, but worth explicitly confirming no new `profiles` UPDATE policy is accidentally introduced that would let a user set their own `area_liderada` |
| Untrusted `searchParams` used to build a query without validation (e.g. a malformed `responsavel` value causing an unexpected Supabase query error, or — worse — being interpolated unsafely into a raw query string) | Tampering | `zod`-validated `searchParams` (Pattern 5) before any value reaches a Supabase query builder call; Supabase's query builder (`.eq()`, `.ilike()`, `.in()`) parameterizes values itself, so this is defense-in-depth against malformed input, not a SQL-injection vector per se (the JS client library doesn't build raw SQL strings) |

## Sources

### Primary (HIGH confidence — official docs / project-installed skills / direct codebase reads, fetched/verified directly)
- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` — "Rendering with search params" section, `searchParams` Server Component page prop vs `useSearchParams` client hook, read directly per AGENTS.md's explicit instruction to consult local docs over training data for this pinned Next.js 16.x version
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` — full API reference confirming "Use the `searchParams` prop when you need search parameters to load data for the page... Use `useSearchParams` when search parameters are used only on the client"
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md` — `window.history.pushState`/`<Link>`-driven URL state pattern for filter/sort controls
- `.agents/skills/supabase/SKILL.md` — "Views bypass RLS by default... UPDATE requires a SELECT policy" [CITED: project-installed skill, directly corroborated by this project's own Phase 2 live-verified finding]
- `.agents/skills/supabase-postgres-best-practices/references/security-rls-basics.md`, `security-rls-performance.md` — RLS `to authenticated using(...)` shape, `SECURITY DEFINER` helper-function pattern with explicit `auth.uid()` check + `revoke`/`grant`, wrapping `auth.uid()` in `(select ...)` for per-statement caching
- `supabase/migrations/0001_profiles.sql`, `0002_profiles_role.sql`, `0003_demandas.sql` (this repo) — direct read of the exact existing schema, RLS policies, and the SELECT-gates-UPDATE lesson's own documentation trail, which this phase's design deliberately continues
- `tests/db/role-rls.test.ts`, `tests/db/demandas-rls.test.ts` (this repo) — the established live-integration test pattern (fixture creation, service-role re-read observation contract) this phase's new tests extend rather than reinvent
- `src/app/(dashboard)/page.tsx`, `demanda-list.tsx`, `demanda-table.tsx`, `demanda-card.tsx`, `demanda-form.tsx`, `demanda-schema.ts` (this repo) — direct read of the exact UI this phase's filter/confirm additions must integrate with, confirming the native multi-select for `responsavelIds` and the existing accessibility-floor classes (`min-h-14`, `text-xl`, `focus-visible`) to preserve

### Secondary (MEDIUM confidence)
- ROADMAP.md's Phase 5 section wording ("líder de área... vê as da sua área," singular) — the basis for Assumption A1's "one área per líder" reading; a textual inference, not an explicit confirmed decision

### Tertiary (LOW confidence — not independently re-verified this session)
- Whether `shadcn add alert-dialog` would surface any Next.js 16.2/Tailwind v4-specific caveats — not fetched this session since the component is optional/discretionary; if the planner opts in, run `npx shadcn@latest add alert-dialog` and read its own CLI output directly, same caveat 04-RESEARCH.md already flagged for `shadcn init`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — this phase adds zero new packages; every library in use was already version-verified in Phase 4's audit
- RLS architecture (role-scoping, helper functions, SELECT-gates-write re-verification): HIGH — directly extends Phase 2/4's own live-verified mechanisms and the project's installed Postgres/Supabase skills; the specific predicate shapes (Pattern 3/4) are new to this phase but follow an already-proven template exactly
- área-to-líder data-model gap resolution (single column vs. join table): MEDIUM — a reasoned recommendation based on the roadmap's own phrasing, explicitly flagged as needing discuss-phase confirmation (Open Question 1, Assumption A1)
- área normalization decision (no normalization needed at this scale): MEDIUM — carries forward 04-RESEARCH.md's identical open question with the same reasoning, still not empirically validated against real institutional data
- Next.js 16 `searchParams` filtering pattern: HIGH — read directly from `node_modules/next/dist/docs/` per AGENTS.md's explicit instruction, not from training data
- Pitfalls: HIGH for Pitfalls 1-4 (each backed by a specific, previously-documented mechanism in this project's own migration history); MEDIUM for Pitfall 5 (a reasoned prediction about `ilike` wildcard misuse, not yet observed in this project's actual usage)

**Research date:** 2026-08-04
**Valid until:** 2026-08-18 (14 days — matches Phase 1/2/4's window; Next.js/Supabase guidance ships frequently, and the área-to-líder decision should be confirmed well before this window closes)

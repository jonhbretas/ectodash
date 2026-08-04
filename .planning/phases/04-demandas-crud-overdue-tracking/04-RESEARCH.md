# Phase 4: Demandas CRUD & Overdue Tracking - Research

**Researched:** 2026-08-03
**Domain:** Postgres schema design for a task-tracking core entity + RLS ownership pattern reusing Phase 2's `has_role()` contract + Next.js 16 Server Actions/forms for create/edit, with a derived (not stored) overdue flag
**Confidence:** HIGH — schema/RLS mechanics directly extend Phase 1/2's proven, live-verified patterns; Next.js 16 Server Actions/forms guidance read directly from `node_modules/next/dist/docs/` per AGENTS.md; the one genuinely new library decision (shadcn/ui) is MEDIUM (official docs fetched, but no Context7 available this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase yet (research runs before `/gsd-discuss-phase` in this invocation). No locked decisions, discretion areas, or deferred ideas to carry forward. All schema/architecture choices below are research recommendations for the planner and discuss-phase to confirm or override.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| DEM-01 | Usuário cria demanda com título, responsável, prazo, status e área/projeto | Architecture Pattern 1 (`demandas` table schema) + Code Example 1 (create Server Action) |
| DEM-02 | Usuário edita e conclui demanda | Architecture Pattern 3 (RLS ownership + SELECT/UPDATE policy pairing) + Code Example 2 (edit/conclude Server Action) |
| DEM-03 | Demanda com prazo vencido é sinalizada visualmente como atrasada | Architecture Pattern 2 (derived-not-stored overdue) + Common Pitfall 1 |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Vercel + Supabase free tier only — this phase adds no paid services; shadcn/ui is a source-copy CLI (not a runtime npm dependency at the framework level), the only genuinely new *installed* packages are `react-hook-form`, `@hookform/resolvers`, `date-fns`, plus shadcn's own transitive deps (Radix primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`).
- **RLS as the only real authorization boundary** — reinforced: demandas visibility/editability must be enforced via Postgres RLS calling `has_role()` or an ownership predicate, never hidden only in the UI.
- **Migrations only as versioned SQL files under `supabase/migrations/`**, pushed via `npx supabase@latest db push` — continues Phase 1/2's established convention (next file: `0003_demandas.sql`).
- **Accessible UX for elderly users** (large text/touch targets, high contrast, pt-BR copy) — Phase 3 (accessible UI foundation) was deliberately deferred to run *after* this phase specifically so Phase 4 ships the first real screens; this phase must still meet Phase 1's already-established accessibility floor (see `login-form.tsx`: `text-xl`, `min-h-14` touch targets, `focus-visible` rings) since Phase 3 is a polish pass, not a rescue.
- **`zod` for all boundary validation, shared client/server** — per CLAUDE.md's stack table, applies directly to the demanda create/edit form.
- **`react-hook-form` for forms with >2-3 fields** — the demanda form (título, responsável, prazo, status, área/projeto = 5 fields) crosses CLAUDE.md's own stated threshold; per CLAUDE.md's Alternatives table, plain Server Actions + `useActionState` is reserved for 1-2 field forms only (login already uses that pattern correctly).
- **date-fns for date math and pt-BR formatting** — explicit in CLAUDE.md's supporting libraries table for "prazo próximo/atrasado" logic.
- **shadcn/ui recommended but not yet installed** — CLAUDE.md flags it as the standard choice for accessible interactive components (dialog, dropdown, table, form, alert) but Phase 1 shipped hand-written Tailwind only; this phase is the first to need form/table/select components at real complexity.

## Summary

This phase adds the system's core entity — `demandas` — as a straightforward CRUD table with role-aware RLS built directly on Phase 2's proven `has_role()` contract, plus a **derived, not stored**, overdue indicator. Three architectural decisions carry the most risk of getting subtly wrong, mirroring the pattern from Phase 2's own research-vs-reality gap:

1. **"Atrasada" must never be a column that needs a cron to flip.** Postgres `GENERATED ALWAYS AS (...) STORED` columns require an `IMMUTABLE` expression, and `now()`/`current_date` are `STABLE`, not `IMMUTABLE` — so a generated column literally cannot reference "today." The only two real options are: compute it in the read path (a plain boolean expression in the `SELECT`, e.g. `prazo < current_date and status <> 'concluida'`), or compute it client-side with `date-fns`'s `isPast()`. Recommendation: do both — expose it as a computed value from a Postgres view (cheap, consistent, filterable/sortable server-side, sets up Phase 5's filtering) *and* use `date-fns` purely for human-readable formatting ("atrasada há 3 dias") in the UI, never for the boolean decision itself, to avoid client/server clock skew disagreeing with what the database considers "today."

2. **`área/projeto` should be free text this phase, not a new table or enum — but only if Phase 5's filtering needs are respected in the column design.** A brand-new `areas` table this phase is premature (no CRUD for areas exists in scope, no phase creates/manages them yet), and a fixed enum is actively wrong (the institution's áreas/projetos are org-specific working nouns, not fixed system states like `status`). A plain `text` column keeps DEM-01 shippable now; Phase 5's `DEM-04` (filter/group by área) works fine against free text via `GROUP BY`/`DISTINCT`, and the data-quality risk (typos causing `"Pesquisa"` and `"pesquisa"` to be different groups) is real but bounded — add a `citext`-style lowercase-normalize-on-write step (a `BEFORE INSERT/UPDATE` trigger or app-level `.trim().toLowerCase()` display key) as a lightweight mitigation now, deferring "should área become a managed table with autocomplete" as an explicit Phase 5 open question rather than solving it speculatively here.

3. **The Phase 2 "UPDATE needs a matching SELECT policy" lesson applies again, with a twist.** Demandas need broader read access than `profiles` ever did (every authenticated user should see all demandas this phase — full role-scoping is explicitly Phase 5's job, not this phase's), which actually makes the SELECT-gates-UPDATE trap easier to avoid: a single `using (true)` SELECT policy for all authenticated users covers every UPDATE policy's row-visibility prerequisite automatically. The twist is the *write* side: "usuário edita e conclui demanda" (DEM-02) doesn't specify who may edit *which* demanda this phase, and over-scoping now (e.g., building a narrow "only the responsável can edit" policy) directly contradicts Phase 5's stated job of adding role-scoped write restrictions. Recommendation: this phase's RLS should allow any authenticated user to INSERT and UPDATE any demanda (matching the "simple but not wrong" instruction pattern Phase 2 set for itself) — Phase 5 tightens this, it does not invent the mechanism.

**Primary recommendation:** One migration (`0003_demandas.sql`) creating `public.demanda_status` enum, `public.demandas` table (with `criado_por` and `responsavel_id` both FKs to `profiles`, free-text `area`, `prazo date`), a `public.demandas_atrasadas` view (or inline computed boolean) for the overdue predicate, permissive-but-authenticated RLS (SELECT: all; INSERT/UPDATE: all authenticated, ownership/role narrowing deferred to Phase 5), and a `set_updated_at()` trigger. Pair with `shadcn/ui` init (form, input, select, textarea, button, table/card, badge components) since this is the first phase needing real form/table UI, `react-hook-form` + `@hookform/resolvers/zod` for the 5-field create/edit form, and `date-fns` (`isPast`, `format`, `ptBR` locale) for display-only date logic.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Demanda schema + constraints (título, responsável, prazo, status, área) | Database/Storage | — | Postgres is the single source of truth for valid demanda shape; `status` as an enum type mirrors Phase 2's `app_role` pattern |
| Overdue ("atrasada") derivation | Database/Storage | Browser/Client | The authoritative boolean must be computed against the database's clock (`current_date`) so filtering/sorting (Phase 5, Phase 6) is consistent across every reader; client-side `date-fns` is used only for human-readable relative-time display, never as the source of truth for the flag itself |
| Create/edit/conclude demanda (mutation) | API/Backend | Database/Storage | Next.js Server Actions validate shape (zod) and call Supabase; RLS is the actual authorization boundary underneath, per CLAUDE.md's explicit "What NOT to Use" entry on client-side-only checks |
| Demanda list rendering + form UI | Frontend Server (SSR) | Browser/Client | Server Component fetches the list (RSC data fetch, no client-side waterfall); the create/edit form is a Client Component (`react-hook-form` needs client state), matching the existing `login-form.tsx` split |
| Role/ownership-scoped visibility (who sees which demandas) | Database/Storage | — | Explicitly **out of scope this phase** (Phase 5's job per roadmap) — this phase's RLS is intentionally permissive-but-authenticated, not yet role-scoped |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-hook-form` | ^7.84.0 [VERIFIED: npm registry] | Client-side form state for the 5-field demanda create/edit form | CLAUDE.md's explicit threshold ("more than 2-3 fields") is crossed by this form; gives inline per-field validation messages needed for the elderly-user UX requirement |
| `@hookform/resolvers` | ^5.7.1 [VERIFIED: npm registry] | Wires `zod` schemas into `react-hook-form`'s validation | Official bridge package; confirmed peer-compatible with the project's installed `zod@^4.4.3` (`resolvers` v5.x declares `zod: '^3.25.0 \|\| ^4.0.0'` as a valid peer) |
| `date-fns` | ^4.4.0 [VERIFIED: npm registry] | `isPast()`, `format()`, pt-BR relative-time display for prazo/atrasada UI copy | Already named in CLAUDE.md's supporting-libraries table; confirmed via direct package tarball inspection that `isPast(date): boolean` and `ptBR` (importable from both `date-fns/locale` and `date-fns/locale/pt-BR`) exist in the current published version |
| `shadcn/ui` CLI (`shadcn@latest`) | latest (CLI, not a runtime dependency) | Scaffolds accessible form/input/select/table/badge components as owned source files | First phase needing form+table+badge UI at this complexity; per CLAUDE.md, using it now (rather than hand-rolling) avoids re-solving focus states/contrast/keyboard nav that Phase 3's later accessibility pass would otherwise have to retrofit onto ad-hoc components |

### Supporting (installed transitively by shadcn/ui's component copies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-dialog` (as needed per component) | latest, pulled per-component by the `shadcn add` CLI | Unstyled, accessible primitives underneath shadcn's copied component source | Only the primitives for components actually added (`form`, `input`, `select`, `label`, `button`, `badge`, `table` or `card`) — do not pre-install primitives for unused components |
| `class-variance-authority` | ^0.7.x [VERIFIED: npm registry] | Variant-based className composition inside shadcn component source | Ships automatically with any shadcn component that has visual variants (e.g. `badge`, `button`) |
| `clsx` + `tailwind-merge` | latest [VERIFIED: npm registry] | className merging utility (`cn()` helper) that shadcn's `init` step scaffolds into `src/lib/utils.ts` | Used by every shadcn component; scaffolded once at `init` time |
| `lucide-react` | latest [VERIFIED: npm registry] | Icon set shadcn components reference by default (e.g. a chevron in `select`) | Only if a chosen component's default source imports an icon — check each component's copied source before assuming this is needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A Postgres view/computed boolean for "atrasada" | A stored `atrasada boolean` column flipped by a daily cron/Edge Function | Rejected — adds a scheduling dependency (and a staleness window between cron runs) for a value that's a trivial, cheap comparison at read time; the project's own Phase 7 research will need a *separate* overdue check for email reminders anyway, so a single computed predicate reused by both is simpler than two divergent sources of truth |
| Free-text `area` column | Dedicated `areas` table with FK from `demandas` | Rejected for *this* phase — no phase in the current roadmap builds área CRUD/management UI; a table with no admin surface to populate it is premature structure. Revisit if Phase 5's filtering reveals real data-quality pain (typo'd área names splitting groups) |
| Free-text `area` column | Postgres enum for `area` | Rejected — áreas/projetos are institution-specific, likely to grow/change over time (unlike the fixed 4 roles), and enums require `ALTER TYPE ... ADD VALUE` (can't run in the same transaction as a statement using the new value) for every new área — too rigid for an org-specific working list |
| Permissive "all authenticated can edit any demanda" RLS this phase | Ownership-scoped RLS (only creator/responsável can edit) built now | Rejected for *this* phase by roadmap sequencing — Phase 5's explicit goal is "líder de área sees their área's demandas; coordenador sees all"; building partial ownership scoping now risks producing a policy shape Phase 5 has to unwind rather than extend. Simple-but-not-wrong (Phase 2's own framing) means: correct RLS shape (all authenticated, matching SELECT+UPDATE pair), not yet role-narrowed |
| shadcn/ui | Hand-rolled Tailwind components (Phase 1's approach) | Considered — Phase 1 hand-rolled because it only needed a text input + button; a 5-field form + status badges + a table/list view is a different complexity tier where re-deriving focus/contrast/keyboard-nav behavior by hand starts to cost more than the shadcn CLI's one-time setup cost |
| shadcn/ui | Tremor / a full component library as an npm dependency | Rejected — CLAUDE.md already frames Tremor as a *charting* alternative (Phase 6/10 concern), not a general form/table library; shadcn's copy-not-install model also fits this project's "keep it small, maintainable by volunteers" constraint better than an opaque npm dependency |

**Installation:**
```bash
npm install react-hook-form @hookform/resolvers date-fns
npx shadcn@latest init
npx shadcn@latest add form input select label button badge table
```

**Version verification:** All versions above confirmed via `npm view <pkg> version` against the live registry on 2026-08-03; `date-fns`'s `isPast`/`ptBR` API surface confirmed by downloading and extracting the actual `date-fns@4.4.0` tarball and reading its `.d.ts` declarations directly (not just docs/training data).

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|-------------|---------|-------------|
| `date-fns` | npm | 2026-05-29 | 96.2M | github.com/date-fns/date-fns | OK | Approved |
| `react-hook-form` | npm | 2026-08-01 | 57.7M | github.com/react-hook-form/react-hook-form | SUS (too-new heuristic only) | Approved — see note |
| `@hookform/resolvers` | npm | 2026-08-02 | 48.8M | github.com/react-hook-form/resolvers | SUS (too-new heuristic only) | Approved — see note |
| `shadcn` | npm | 2026-07-31 | 7.4M | github.com/shadcn-ui/ui | SUS (too-new heuristic only) | Approved — see note |
| `class-variance-authority` | npm | 2024-11-26 | 60.5M | github.com/joe-bell/cva | OK | Approved |
| `clsx` | npm | 2024-04-23 | 116.1M | github.com/lukeed/clsx | OK | Approved |
| `tailwind-merge` | npm | 2026-05-10 | 78.0M | github.com/dcastil/tailwind-merge | OK | Approved |
| `lucide-react` | npm | 2026-07-30 | 91.7M | github.com/lucide-icons/lucide | SUS (too-new heuristic only) | Approved — see note |
| `@radix-ui/react-dialog`, `-select`, `-label` | npm | 2026-07-24 | 56-69M | github.com/radix-ui/primitives | SUS (too-new heuristic only) | Approved — see note |

**Note on "SUS (too-new heuristic only)" packages:** Every package flagged `SUS` here was flagged solely for the `too-new` signal (a recent patch/minor release), the same false-positive pattern Phase 1's and Phase 2's audits already documented for this fast-moving ecosystem. Each has 7M-116M weekly downloads and a long-standing, well-known GitHub repository — the opposite profile of a slopsquatted package (near-zero downloads, no repo, days-old first publish). No package here shows `exists: false`, a missing repo, or a suspicious `postinstall` script. Treat as `[OK]` in practice; the planner does not need a `checkpoint:human-verify` gate for these installs, consistent with Phase 1/2's handling of the identical heuristic.

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]` requiring a checkpoint:** none — all SUS verdicts resolved to false positives per the note above.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Browser (Client Component)                                               │
│  DemandaForm (react-hook-form + zod resolver)                            │
│    - título, responsável (select of profiles), prazo (date input),       │
│      status (select), área (text input with datalist suggestions)        │
│    - client-side validation mirrors server zod schema                    │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ <form action={createDemanda}> / bind(id)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Next.js 16 Server Action ("use server")                                  │
│  createDemanda(prevState, formData) / updateDemanda(id, prevState, fd)   │
│    1. auth check: supabase.auth.getUser() — reject if no session         │
│    2. zod .safeParse(Object.fromEntries(formData)) — reject if invalid   │
│    3. supabase.from("demandas").insert/update(...)                       │
│       (RLS is the real authorization boundary underneath — the action    │
│        does not re-implement "can this user edit this row")              │
│    4. revalidatePath("/") (or the demandas list route)                   │
│    5. return { ok, message } for useActionState to render                │
└───────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Supabase (Postgres)                                                       │
│                                                                            │
│  public.demanda_status (enum: pendente | em_andamento | concluida)        │
│         │                                                                 │
│         ▼                                                                 │
│  public.demandas ◀── RLS enabled                                          │
│    id, titulo, descricao, area (text), responsavel_id (FK→profiles),      │
│    criado_por (FK→profiles), prazo (date), status, created_at, updated_at │
│         │            ▲                                                   │
│         │            │ SELECT policy: using (true) — any authenticated   │
│         │            │   user sees all demandas (Phase 5 narrows this)   │
│         │            │ INSERT policy: with check (auth.uid() = criado_por│
│         │            │   or has_role(...)) — creator is always the actor │
│         │            │ UPDATE policy: using (true) with check (true) —   │
│         │            │   any authenticated user may edit (Phase 5 job    │
│         │            │   to scope by role/ownership)                    │
│         ▼            │                                                   │
│  public.demandas_atrasadas (view, or computed column in SELECT)          │
│    select *, (prazo < current_date and status <> 'concluida') as atrasada│
│    from public.demandas                                                  │
│    — computed at READ time against the DB's own clock; never a stored,   │
│      cron-flipped boolean                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
supabase/
└── migrations/
    ├── 0001_profiles.sql
    ├── 0002_profiles_role.sql
    └── 0003_demandas.sql            # Phase 4 — enum, table, FKs, view, RLS, updated_at trigger
src/
├── components/
│   └── ui/                          # shadcn CLI output (form, input, select, button, badge, table)
├── lib/
│   └── utils.ts                     # cn() helper, scaffolded by `shadcn init`
└── app/
    └── (dashboard)/
        ├── page.tsx                 # demandas list (Server Component, reads demandas_atrasadas view)
        └── demandas/
            ├── actions.ts           # createDemanda, updateDemanda, concludeDemanda Server Actions
            ├── demanda-form.tsx     # Client Component: react-hook-form + zod resolver
            ├── demanda-schema.ts    # shared zod schema (imported by both form and actions)
            └── new/page.tsx         # "nova demanda" route (or a modal/dialog — planner's call)
tests/
└── db/
    └── demandas-rls.test.ts        # Phase 4 — live integration proof (mirrors role-rls.test.ts pattern)
```

### Pattern 1: `demandas` table — enum status, two FK roles to `profiles`, free-text área

**What:** A single table with a Postgres enum for `status` (mirroring Phase 2's `app_role` pattern for the same type-safety reason), two separate foreign keys into `profiles` — `criado_por` (who created it, for future audit/ownership) and `responsavel_id` (who's accountable for it, the DEM-01 "responsável" field) — and `area` as plain `text`, not a new table or enum.
**When to use:** This is the phase's one and only new table.
**Example:**
```sql
-- supabase/migrations/0003_demandas.sql
-- Source: Postgres identity-column and FK-indexing guidance from
-- .agents/skills/supabase-postgres-best-practices [CITED: project-installed skill];
-- enum pattern mirrors 0002_profiles_role.sql's own app_role precedent

create type public.demanda_status as enum (
  'pendente',
  'em_andamento',
  'concluida'
);

create table public.demandas (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) > 0),
  descricao text,
  area text,
  responsavel_id uuid not null references public.profiles(id),
  criado_por uuid not null references public.profiles(id) default (select auth.uid()),
  prazo date not null,
  status public.demanda_status not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Foreign keys are not auto-indexed by Postgres — index both FK columns
-- per the project's own supabase-postgres-best-practices skill.
create index demandas_responsavel_id_idx on public.demandas (responsavel_id);
create index demandas_criado_por_idx on public.demandas (criado_por);

-- Supports Phase 5's filter/group-by-área (DEM-04) without a full scan.
create index demandas_area_idx on public.demandas (area);

-- Supports "list demandas ordered/filtered by prazo, excluding concluded"
-- (this phase's own list view, and Phase 6's coordinator overview).
create index demandas_prazo_idx on public.demandas (prazo) where status <> 'concluida';
```
**Why `bigint identity` for the PK, not `uuid`:** Matches the project's own supabase-postgres-best-practices skill guidance ("Single database: bigint identity... avoid random UUIDs (v4) as primary keys"); `profiles.id` is `uuid` only because it must match `auth.users.id` (an external constraint from Supabase Auth) — `demandas` has no such constraint, so the sequential-insert-friendly `bigint identity` is the better default here.
**Why `criado_por` defaults to `(select auth.uid())`:** Removes the possibility of a client spoofing who "created" a row while still letting the column be explicit and queryable; the value is set server-side by Postgres itself from the authenticated session, not trusted from `formData`.

### Pattern 2: Overdue derivation as a read-time computed value, never a stored+cron-flipped column

**What:** "Atrasada" is `prazo < current_date and status <> 'concluida'` — a plain boolean expression evaluated fresh on every read, exposed either as a Postgres view or inlined into application queries.
**When to use:** Every place that needs to know if a demanda is overdue: this phase's list view, Phase 6's coordinator dashboard, Phase 7's reminder-job query.
**Example:**
```sql
-- Option A (recommended): a view, so every consumer (this phase, Phase 6,
-- Phase 7) queries the same predicate instead of re-deriving it.
-- Source: Postgres generated-column immutability constraint
-- [CITED: postgresql.org/docs/current/ddl-generated-columns.html — now()/
-- current_date are STABLE, not IMMUTABLE, so this CANNOT be a
-- `generated always as (...) stored` column; confirmed via WebSearch
-- cross-referencing official docs + community bug reports]
create view public.demandas_com_status as
select
  d.*,
  (d.prazo < current_date and d.status <> 'concluida') as atrasada
from public.demandas d;

-- RLS note: views do NOT automatically inherit the base table's RLS
-- enforcement point-for-point in all Postgres versions — on Postgres 15+,
-- Supabase's default is security_invoker behavior for views is NOT
-- automatic; explicitly mark it, per the project's own supabase skill
-- ("Views bypass RLS by default... use
-- CREATE VIEW ... WITH (security_invoker = true)").
alter view public.demandas_com_status set (security_invoker = true);
```
```typescript
// Option B, used ALONGSIDE Option A for human-readable copy only —
// never as the source of truth for the boolean itself, to avoid client
// clock skew disagreeing with what the database considers "overdue."
import { isPast, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// demanda.atrasada comes from the view/query above (server-computed).
// This is purely for the "atrasada há 3 dias" display string:
const prazoDate = new Date(demanda.prazo);
const relativeLabel = isPast(prazoDate)
  ? `atrasada ${formatDistanceToNow(prazoDate, { locale: ptBR, addSuffix: false })}`
  : `prazo em ${formatDistanceToNow(prazoDate, { locale: ptBR, addSuffix: false })}`;
```
**Forward-looking note (not built this phase):** Phase 7 (email reminders) will need "prazo próximo" (approaching, not yet overdue) as a second derived predicate — e.g. `prazo between current_date and current_date + interval '3 days'`. Extending `demandas_com_status` with an `aproximando` column at that time is the natural continuation of this pattern; flagging now so Phase 7's research doesn't have to rediscover "don't store this either."

### Pattern 3: Permissive-but-authenticated RLS, matched SELECT+UPDATE pair (Phase 2's lesson, applied forward)

**What:** Following Phase 2's hard-won discovery (an UPDATE policy is unreachable without an accompanying SELECT policy that grants visibility of the target row), this phase's RLS gives every authenticated user broad SELECT and UPDATE/INSERT access — deliberately not yet role-scoped, since role-scoping is explicitly Phase 5's job.
**When to use:** This phase's `demandas` table policies.
**Example:**
```sql
alter table public.demandas enable row level security;

-- Every authenticated user can see every demanda this phase.
-- (Phase 5's DEM-05 narrows this: voluntário comum sees only their own,
-- líder de área sees their área's, coordenador sees all.)
create policy "authenticated users can view all demandas"
  on public.demandas
  for select
  to authenticated
  using (true);

-- Any authenticated user can create a demanda; criado_por is forced to
-- their own auth.uid() (column default handles this, but WITH CHECK
-- makes the invariant explicit and rejects any client attempt to spoof it).
create policy "authenticated users can create demandas"
  on public.demandas
  for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

-- Any authenticated user can edit/conclude any demanda this phase.
-- (Phase 5 narrows this to ownership/role — see forward-looking note.)
create policy "authenticated users can update demandas"
  on public.demandas
  for update
  to authenticated
  using (true)
  with check (true);
```
**Forward-looking note (not built this phase):** When Phase 5 narrows write access, do not simply swap `using (true)` for `using (auth.uid() = responsavel_id)` in isolation — re-verify the SELECT policy still grants visibility for every actor who needs UPDATE access (e.g. a líder de área editing a team member's demanda needs to *see* that row first, which a self-only SELECT policy would silently block, reproducing Phase 2's exact bug). This is the single highest-value carry-forward lesson from Phase 2 into Phase 5's planning.

### Pattern 4: `updated_at` auto-touch trigger

**What:** A small `BEFORE UPDATE` trigger that sets `updated_at = now()` on every row update, since Postgres has no built-in equivalent to MySQL's `ON UPDATE CURRENT_TIMESTAMP`.
**When to use:** Any table (like `demandas`) that needs to answer "when was this last edited," useful for Phase 6's dashboard and general auditability.
**Example:**
```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger demandas_set_updated_at
  before update on public.demandas
  for each row
  execute function public.set_updated_at();
```
**Why `SECURITY INVOKER` here, unlike `has_role()`'s `SECURITY DEFINER`:** This trigger only touches the row already being updated (no cross-table RLS-bypass need) — per the project's own supabase skill guidance ("Prefer `SECURITY INVOKER`... never add `SECURITY DEFINER` to resolve a permission error"), default to invoker unless there's a specific, documented recursion reason not to (as Phase 2's `has_role()` had).

### Pattern 5: `react-hook-form` + `zod` shared schema for the 5-field demanda form

**What:** A single `zod` schema imported by both the Client Component form (via `@hookform/resolvers/zod`) and the Server Action (re-validated server-side, per Next.js's own security guidance: "Schema validation only checks the shape... treat FormData as untrusted").
**When to use:** The create/edit demanda form.
**Example:**
```typescript
// src/app/(dashboard)/demandas/demanda-schema.ts
import { z } from "zod";

export const demandaSchema = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório"),
  descricao: z.string().trim().optional(),
  area: z.string().trim().optional(),
  responsavelId: z.string().uuid("Selecione um responsável"),
  prazo: z.string().date("Selecione uma data válida"), // yyyy-mm-dd from <input type="date">
  status: z.enum(["pendente", "em_andamento", "concluida"]),
});

export type DemandaFormValues = z.infer<typeof demandaSchema>;
```
```tsx
// src/app/(dashboard)/demandas/demanda-form.tsx — Client Component
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { demandaSchema, type DemandaFormValues } from "./demanda-schema";

export function DemandaForm({ onSubmitAction }: { onSubmitAction: (values: DemandaFormValues) => Promise<void> }) {
  const form = useForm<DemandaFormValues>({ resolver: zodResolver(demandaSchema) });
  // ... shadcn <Form> + <FormField> wiring per shadcn's own react-hook-form integration pattern
}
```
```typescript
// src/app/(dashboard)/demandas/actions.ts — Server Action
"use server";
import { demandaSchema } from "./demanda-schema";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createDemanda(prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

  const parsed = demandaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos destacados." };
  }

  const { error } = await supabase.from("demandas").insert({
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao,
    area: parsed.data.area,
    responsavel_id: parsed.data.responsavelId,
    prazo: parsed.data.prazo,
    status: parsed.data.status,
  });
  // criado_por is NOT sent from the client — the column default and the
  // INSERT policy's WITH CHECK both derive it from auth.uid() server-side.

  if (error) {
    console.error("createDemanda: insert failed", error);
    return { ok: false, message: "Não foi possível criar a demanda." };
  }

  revalidatePath("/"); // no cacheComponents in this project — plain revalidatePath is correct
  return { ok: true, message: "Demanda criada com sucesso." };
}
```
**Why `revalidatePath`, not `updateTag`/`revalidateTag`:** Confirmed via `next.config.ts` that this project does **not** set `cacheComponents: true` — it uses Next.js 16's "Previous Model" for caching (per `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md`, which explicitly flags itself as only applying "with Cache Components enabled"). `revalidatePath` is the correct, already-established API for this project (matches Phase 1's own pattern, though Phase 1 had no mutations needing it yet).

### Anti-Patterns to Avoid

- **A stored `atrasada boolean` column with a daily cron flipping it:** Directly contradicts the phase's own success criterion 3 ("flagged **automatically**") — introduces a staleness window (a demanda becomes overdue at midnight but isn't flagged until the next cron run) and a new operational dependency for a value that's a one-line comparison at read time.
- **Building área as a fixed enum:** Áreas/projetos are org-specific and will grow — an enum forces a schema migration (`ALTER TYPE ... ADD VALUE`, which cannot run in the same transaction as a statement using the new value) every time the institution adds a new área.
- **Trusting `responsavel_id`/`criado_por` from client `formData` without a server-side identity check:** Per Next.js's own Server Actions security guidance ("a client legitimately tells the server which item to act on... it should not supply the row's contents or ownership") — `criado_por` must be derived from the authenticated session, never accepted as a form field.
- **A narrow ownership-scoped RLS policy this phase ("only responsável can edit"):** Premature — this is explicitly Phase 5's stated job (`DEM-05`); building it now risks a policy shape that has to be unwound rather than extended, and risks reproducing Phase 2's SELECT-gates-UPDATE trap if the accompanying SELECT policy isn't updated in lockstep.
- **Using `date-fns`'s `isPast()` as the actual "is this demanda overdue" source of truth for filtering/sorting:** Client clocks can be skewed or wrong; use it for display copy only, per Pattern 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state + validation for a 5-field form | Manual `useState` per field + manual error-message wiring | `react-hook-form` + `@hookform/resolvers/zod` | CLAUDE.md's own stated threshold; hand-rolled multi-field form state is exactly the "deceptively complex" category this library exists for — uncontrolled-vs-controlled input bugs, re-render storms, and inconsistent client/server validation messages are the common failure modes |
| Accessible form/select/dialog/table components from scratch | Hand-written `<select>`/`<div role="dialog">` with manual focus-trap/keyboard-nav/ARIA wiring | `shadcn/ui` components (built on Radix primitives) | Radix primitives already solve focus management, ARIA roles, and keyboard navigation correctly — re-deriving this by hand is a well-known source of accessibility bugs, directly risking UX-01/UX-03 |
| "Is this date in the past" logic + pt-BR relative-time formatting | Manual `Date` arithmetic and hand-written Portuguese pluralization ("há 1 dia" vs "há 3 dias") | `date-fns`'s `isPast()`/`formatDistanceToNow()` + `ptBR` locale | Locale-aware pluralization and timezone-safe date comparison are exactly the kind of "looks simple, isn't" problem a maintained library solves once, correctly, for every locale edge case |
| Overdue status derivation | A generated column, a cron job, or a client-only computed flag with no server-side agreement | A Postgres view (or inline `SELECT` expression) computing the boolean fresh at read time | Postgres's own `IMMUTABLE`-only constraint on generated columns rules out the "obvious" approach entirely — a view keeps every future consumer (Phase 6, Phase 7) reading the same single derivation |

**Key insight:** This phase's two hardest-to-get-right problems (overdue derivation, and a form complex enough to need real state management) both have deceptively simple-looking hand-rolled paths that break in non-obvious ways — a `generated column` for atrasada fails at `CREATE TABLE` time with a Postgres error, and hand-rolled form state fails much later, in accessibility/UX review, when a screen reader user can't tell why their submission was rejected. Reach for the standard tool, not the "quick version," for both.

## Runtime State Inventory

Not applicable — this phase is greenfield (a brand-new table, no rename/refactor/migration of existing data or config).

## Common Pitfalls

### Pitfall 1: Attempting a `GENERATED ALWAYS AS (...) STORED` column for "atrasada"

**What goes wrong:** `CREATE TABLE` (or `ALTER TABLE ... ADD COLUMN`) fails outright with a Postgres error (`generation expression is not immutable`) the moment `now()` or `current_date` appears inside a `GENERATED ALWAYS AS` clause.
**Why it happens:** Generated columns require the expression to be `IMMUTABLE` — guaranteed to always return the same output for the same input, forever. `now()`/`current_date` change every day by definition, so they're `STABLE` (same value within one transaction) at best, never `IMMUTABLE`.
**How to avoid:** Compute the boolean at read time instead — a view (Pattern 2) or an inline `SELECT` expression. This isn't a workaround for a Postgres limitation; it's the documented, correct way to express "derived from the current moment."
**Warning signs:** A migration that fails to apply with `ERROR: generation expression is not immutable` the instant it's pushed.

### Pitfall 2: `área` as free text silently fragmenting Phase 5's filter/group-by view

**What goes wrong:** Two demandas meant to be in the same área end up in different filter groups because one was typed `"Pesquisa"` and another `"pesquisa "` (trailing space) or `"PESQUISA"`.
**Why it happens:** Free-text input has no canonicalization by default; users (especially the elderly-inclusive audience this project targets) will type inconsistently.
**How to avoid:** At minimum, `.trim()` the value client- and server-side before insert (already implicit in the zod schema's `.trim()` above); consider a `BEFORE INSERT/UPDATE` trigger that lowercases into a separate `area_normalized` column used only for grouping/filtering (display keeps the user's original casing) if Phase 5's research finds this is a real problem in practice. Flag this as an explicit Phase 5 open question rather than solving it speculatively now.
**Warning signs:** Phase 5's `GROUP BY area` produces more distinct groups than the institution actually has áreas.

### Pitfall 3: Reproducing Phase 2's SELECT-gates-UPDATE gap on `demandas`

**What goes wrong:** An UPDATE succeeds at the PostgREST/HTTP level (200/204) but zero rows actually change, because the acting user's session can't SELECT the target row in the first place.
**Why it happens:** Postgres RLS resolves an UPDATE's target rows through the table's SELECT policies before evaluating the UPDATE policy itself — this is the exact mechanism Phase 2's summary documented as an "undocumented in research, found during live verification" bug.
**How to avoid:** This phase sidesteps the risk by using `using (true)` for the SELECT policy (Pattern 3) — every authenticated user can see every demanda, so no UPDATE policy can ever be unreachable this phase. **This must be re-verified explicitly when Phase 5 narrows the SELECT policy** — that is the moment this pitfall can reappear.
**Warning signs:** An UPDATE call reports success but a subsequent re-read (via the service-role client, never the acting client's own response — see Phase 2's observation-contract lesson) shows the row unchanged.

### Pitfall 4: Trusting `criado_por`/`responsavel_id` from client-submitted `formData`

**What goes wrong:** A malicious or buggy client submits an INSERT with `criado_por` set to another user's ID, misattributing authorship.
**Why it happens:** `FormData` is fully client-controlled; Next.js's own Server Actions guide explicitly warns "a client legitimately tells the server which item to act on... it should not supply the row's contents or ownership."
**How to avoid:** Never read `criado_por` from `formData` in the Server Action — derive it from `supabase.auth.getUser()` server-side (Pattern 5's example), and additionally enforce it at the database layer via the INSERT policy's `WITH CHECK (criado_por = (select auth.uid()))` (Pattern 3) as defense-in-depth.
**Warning signs:** A code review or test that finds `criado_por` (or any ownership field) read directly from `Object.fromEntries(formData)` without a corresponding session-derived override.

### Pitfall 5: Next.js 16 — this version has documented breaking changes from training data (per AGENTS.md)

**What goes wrong:** Reaching for `unstable_cache`, assuming `revalidateTag`/`updateTag` behave identically without checking whether `cacheComponents` is enabled, or copying a Next.js 14/15-era Server Action pattern that doesn't account for Next.js 16's single-roundtrip response model.
**Why it happens:** Training data predates this project's pinned Next.js 16.2.12; the project's own AGENTS.md explicitly warns "APIs, conventions, and file structure may all differ from your training data."
**How to avoid:** This research read `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`, `.../09-revalidating.md`, `.../02-guides/forms.md`, and `.../02-guides/server-actions.md` directly rather than relying on training data; confirmed this project does **not** set `cacheComponents: true` in `next.config.ts`, so the "Previous Model" applies (`revalidatePath`, not `updateTag`/tag-based `use cache`). The planner/executor should do the same direct-docs-read for any Next.js API not already covered in this research or in Phase 1's established patterns.
**Warning signs:** Any code using `updateTag`, `cacheTag`, or `cacheLife` without `cacheComponents: true` set in `next.config.ts` — those APIs are scoped to the Cache Components model this project isn't using.

## Code Examples

### Full Phase 4 migration (schema + view + RLS + trigger)

```sql
-- supabase/migrations/0003_demandas.sql
-- Core demandas entity: enum status, FK-linked responsável/criador, free-text
-- área, read-time-derived overdue view, permissive-but-authenticated RLS
-- (Phase 5 narrows to role/ownership scoping — see forward-looking notes).
-- Sources: Postgres generated-column immutability constraint [CITED:
-- postgresql.org/docs/current/ddl-generated-columns.html]; project's own
-- supabase-postgres-best-practices skill (FK indexing, bigint identity PK,
-- partial/composite index patterns) [CITED: .agents/skills installed
-- locally]; project's own supabase skill (views bypass RLS by default;
-- UPDATE requires a matching SELECT policy) [CITED: .agents/skills/supabase
-- installed locally, corroborated by Phase 2's live-verified 02-01-SUMMARY.md]

create type public.demanda_status as enum (
  'pendente',
  'em_andamento',
  'concluida'
);

create table public.demandas (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) > 0),
  descricao text,
  area text,
  responsavel_id uuid not null references public.profiles(id),
  criado_por uuid not null references public.profiles(id) default (select auth.uid()),
  prazo date not null,
  status public.demanda_status not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index demandas_responsavel_id_idx on public.demandas (responsavel_id);
create index demandas_criado_por_idx on public.demandas (criado_por);
create index demandas_area_idx on public.demandas (area);
create index demandas_prazo_idx on public.demandas (prazo) where status <> 'concluida';

alter table public.demandas enable row level security;

create policy "authenticated users can view all demandas"
  on public.demandas
  for select
  to authenticated
  using (true);

create policy "authenticated users can create demandas"
  on public.demandas
  for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

create policy "authenticated users can update demandas"
  on public.demandas
  for update
  to authenticated
  using (true)
  with check (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger demandas_set_updated_at
  before update on public.demandas
  for each row
  execute function public.set_updated_at();

-- Read-time overdue derivation — NOT a stored/generated column (now()/
-- current_date are STABLE, not IMMUTABLE; a generated column would fail
-- to create). security_invoker ensures this view respects the querying
-- user's own RLS grants rather than the view owner's.
create view public.demandas_com_status
with (security_invoker = true) as
select
  d.*,
  (d.prazo < current_date and d.status <> 'concluida') as atrasada
from public.demandas d;
```

### Edit + conclude Server Action

```typescript
// src/app/(dashboard)/demandas/actions.ts (continued)
"use server";
import { demandaSchema } from "./demanda-schema";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateDemanda(
  id: number,
  prevState: unknown,
  formData: FormData
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Faça login novamente." };

  const parsed = demandaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos destacados." };
  }

  // id comes from a server-trusted route param/bind(), never from formData
  // itself — matches Next.js's own "send a reference, re-derive the rest"
  // guidance for Server Action security.
  const { error } = await supabase
    .from("demandas")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao,
      area: parsed.data.area,
      responsavel_id: parsed.data.responsavelId,
      prazo: parsed.data.prazo,
      status: parsed.data.status,
    })
    .eq("id", id);

  if (error) {
    console.error("updateDemanda: update failed", error);
    return { ok: false, message: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/");
  return { ok: true, message: "Demanda atualizada." };
}

// A dedicated "conclude" action (rather than reusing the generic edit form)
// keeps the one-click "marcar como concluída" UX interaction (DEM-02)
// separate from the full edit form — a smaller, more auditable mutation
// surface for a single-field status change.
export async function concludeDemanda(id: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const { error } = await supabase
    .from("demandas")
    .update({ status: "concluida" })
    .eq("id", id);

  if (error) {
    console.error("concludeDemanda: update failed", error);
    return { ok: false, message: "Não foi possível concluir a demanda." };
  }

  revalidatePath("/");
  return { ok: true, message: "Demanda concluída." };
}
```

### Reading the demandas list with the overdue flag (Server Component)

```typescript
// src/app/(dashboard)/page.tsx (extended)
const { data: demandas } = await supabase
  .from("demandas_com_status")
  .select("id, titulo, area, prazo, status, atrasada, responsavel_id")
  .order("prazo", { ascending: true });
// `atrasada` is already a plain boolean here — no client-side date math
// needed to decide WHETHER to show the "atrasada" badge, only to phrase
// the human-readable "há N dias" copy alongside it (Pattern 2).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Storing a boolean flag flipped by a scheduled job | Read-time derivation via a view or computed `SELECT` expression | Not a version-driven change — this is a longstanding Postgres constraint (`IMMUTABLE`-only generated columns), not a new best practice | Any plan proposing a stored `atrasada` column + cron should be flagged as a design smell, not implemented |
| `revalidatePath`/`revalidateTag` as the only revalidation APIs | `updateTag` (immediate, read-your-own-writes) added alongside `revalidateTag`/`revalidatePath`, but **only relevant under `cacheComponents: true`** | Next.js 15→16 introduced `cacheComponents` and the tag-based model as an evolution of the "Previous Model" | This project does not opt into `cacheComponents`; `revalidatePath` (the pattern already used implicitly by this phase's mutations) remains correct — do not introduce `updateTag`/`cacheLife`/`cacheTag` without first enabling `cacheComponents` in `next.config.ts`, which is a larger decision than this phase's scope |
| `date-fns` v1/v2-era removal of `isPast`/`isFuture` in some 2.0 alpha builds | `isPast`/`isFuture`/`isBefore`/`isAfter` all present and stable in the current v4.x line | date-fns v3/v4 stabilization | Training data referencing "isPast was removed" (a real v2.0-alpha-era discussion) is stale — confirmed via direct tarball inspection that v4.4.0 exports `isPast` normally |

**Deprecated/outdated:**
- `date-fns/locale/pt-BR` deep-import path still works but `date-fns/locale` (named export `ptBR`) is the more common current pattern across docs/examples — both are valid per the package's own `exports` map, planner's choice.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `status` enum's exact 3 values (`pendente`, `em_andamento`, `concluida`) match what the roadmap/success-criteria imply ("track the status," "mark as concluded") — no explicit 4th value (e.g. `cancelada`) was named anywhere in PROJECT.md/ROADMAP.md/REQUIREMENTS.md | Pattern 1, Code Examples | Low-Medium — if discuss-phase surfaces a need for a "cancelada"/"pausada" state, adding an enum value is a simple `ALTER TYPE ... ADD VALUE` (cannot run in the same transaction as a statement using the new value, but otherwise low-cost) |
| A2 | "Responsável" (DEM-01) means a single FK to `profiles`, not a many-to-many assignment (multiple responsáveis per demanda) — REQUIREMENTS.md phrasing ("responsável") is singular throughout | Pattern 1 | Medium — if the real institutional workflow allows co-responsibility, this would need a join table later; flagging as a discuss-phase question rather than assuming further |
| A3 | This phase's RLS should be permissive-but-authenticated (not role-scoped) because Phase 5 (`DEM-05`) is explicitly the role-scoping phase per ROADMAP.md — inferred from roadmap sequencing, not an explicit CONTEXT.md decision (none exists yet for this phase) | Pattern 3 | Medium — if discuss-phase/the user wants ownership scoping to start now, Pattern 3's policies need narrowing; the forward-looking note flags exactly what to re-check (SELECT/UPDATE pairing) if that happens |
| A4 | shadcn/ui should be introduced in this phase rather than deferred to Phase 3 (which now runs *after* this phase per the roadmap's own sequencing note) — inferred from CLAUDE.md's own reasoning ("Phase 3 becomes a polish pass... applies the accessible design system to more surfaces at once") | Standard Stack, Don't Hand-Roll | Low — even if the planner defers shadcn to Phase 3, the underlying `demandas` schema/RLS/Server Action research is unaffected; only the component-library choice for the form/table UI would change |

**If this table is empty:** N/A — see rows above; none block planning, but A1-A3 are worth a quick discuss-phase confirmation since no CONTEXT.md exists yet for this phase.

## Open Questions

1. **Should `area` get a lowercase-normalized shadow column now, or only if Phase 5 finds it's a real problem?**
   - What we know: Free text risks fragmenting `GROUP BY area` results (Pitfall 2); no área-management UI exists in the roadmap.
   - What's unclear: Whether the institution's actual área/projeto list is small and stable enough (per PROJECT.md's context) that typo-fragmentation is a non-issue in practice, vs. a real pain point Phase 5 will hit immediately.
   - Recommendation: Ship free text + `.trim()` this phase (Pattern 1); defer the normalization-column decision explicitly to Phase 5's own research, which will have real usage data to inform it.

2. **Should the create/edit form live on a dedicated route (`/demandas/new`) or in a shadcn `Dialog` overlay on the list page?**
   - What we know: CLAUDE.md's UX-02 requirement (short forms, few fields per screen, clear confirmation) applies either way; shadcn ships a `dialog` component that would support either pattern.
   - What's unclear: Whether the elderly-inclusive audience navigates more reliably via a full page transition (simpler mental model, back-button works predictably) or an in-place dialog (fewer navigation steps).
   - Recommendation: Planner's call — a dedicated route is the lower-risk default for this audience (predictable browser back-button behavior); a dialog can be revisited in Phase 3's UI polish pass if it's preferred later.

3. **Exact wording/labels for the 3 status values and the "área/projeto" field in the UI (pt-BR copy).**
   - What we know: The database enum values (`pendente`, `em_andamento`, `concluida`) are internal identifiers, not necessarily the exact user-facing Portuguese labels.
   - What's unclear: Preferred display copy (e.g. "Em andamento" vs "Em progresso"; "Área/Projeto" vs separate fields) — a discuss-phase question, not a research question.
   - Recommendation: Flag for `/gsd-discuss-phase` rather than guessing; the schema/enum values themselves are stable regardless of display copy chosen.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Server Actions, Vitest tests, shadcn CLI | Yes (confirmed Phase 1/2) | v24.17.0 | — |
| Supabase CLI | `db push` for `0003_demandas.sql` | No (not on PATH, consistent with Phase 1/2) | — | `npx supabase@latest db push` — established pattern |
| Docker | pgTAP (`supabase test db`) | No (confirmed again, consistent with Phase 1/2) | — | Continue the Vitest-against-live-hosted-project integration pattern (`tests/db/demandas-rls.test.ts`) |
| npm registry access | Installing `react-hook-form`, `@hookform/resolvers`, `date-fns`, `shadcn` CLI + component deps | Yes (all versions verified live this session) | — | — |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:**
- Docker — blocks pgTAP entirely, same as Phase 1/2; this phase's RLS proof relies on the established Vitest + live hosted project pattern.
- Supabase CLI (global) — use `npx supabase@latest db push`, same as Phase 1/2.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (already installed and configured, Phase 1) |
| Config file | `vitest.config.ts` (testTimeout already raised to 30000ms for network-crossing assertions) |
| Quick run command | `npx vitest run tests/db/demandas-rls.test.ts` |
| Full suite command | `npm test` (covers `profiles-trigger.test.ts`, `role-rls.test.ts`, plus the new `demandas-rls.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEM-01 | Authenticated user can create a demanda with all 5 required fields; row persists with correct `criado_por` (server-derived, not client-supplied) | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "creates a demanda"` | ❌ Wave 0 |
| DEM-01 | INSERT rejects `criado_por` spoofing (WITH CHECK enforces `auth.uid()`) | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "rejects spoofed criado_por"` | ❌ Wave 0 |
| DEM-02 | Authenticated user can update an existing demanda's fields | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "updates a demanda"` | ❌ Wave 0 |
| DEM-02 | Authenticated user can mark a demanda `concluida` | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "concludes a demanda"` | ❌ Wave 0 |
| DEM-03 | `demandas_com_status.atrasada` is `true` for a past-`prazo`, non-`concluida` row and `false` for a past-`prazo`, `concluida` row | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "atrasada derivation"` | ❌ Wave 0 |
| DEM-03 | `demandas_com_status.atrasada` is `false` for a future-`prazo` row | integration | `npx vitest run tests/db/demandas-rls.test.ts -t "not atrasada when prazo is future"` | ❌ Wave 0 |
| DEM-01/DEM-02 | Server Action rejects invalid form input (missing título, invalid prazo) before hitting the database — zod schema validation | unit | `npx vitest run tests/actions/demanda-schema.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/db/demandas-rls.test.ts` (and `tests/actions/demanda-schema.test.ts` once it exists)
- **Per wave merge:** full `npm test`
- **Phase gate:** Full suite green + a manual UAT pass creating/editing/concluding a real demanda through the UI and confirming the overdue badge appears/disappears correctly, before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/db/demandas-rls.test.ts` — covers DEM-01 (create + anti-spoofing), DEM-02 (edit + conclude), DEM-03 (atrasada derivation, both directions) against the live hosted project, following `role-rls.test.ts`'s established fixture/cleanup pattern
- [ ] `tests/actions/demanda-schema.test.ts` — unit tests for the shared zod schema (no live DB needed, pure validation logic)
- No new framework/fixture install needed — reuses Phase 1/2's `describe.skipIf(!canRun)` live-credential pattern, admin/anon client setup, and the "assert only via service-role re-reads" observation contract from Phase 2

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | no (unchanged from Phase 1/2) | Not touched this phase |
| V3 Session Management | no (unchanged from Phase 1/2) | Not touched this phase |
| V4 Access Control | yes | RLS policies on `demandas` (Pattern 3); `security_invoker = true` on the `demandas_com_status` view so it doesn't silently bypass RLS (per the project's own supabase skill: "views bypass RLS by default") |
| V5 Input Validation | yes | Shared `zod` schema (Pattern 5) validated both client- and server-side; Postgres `enum`/`not null`/`check` constraints as a second, database-level layer (mirrors Phase 2's defense-in-depth approach) |
| V6 Cryptography | no (unchanged from Phase 1/2) | Not touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Ownership/authorship spoofing (`criado_por` submitted by client) | Tampering / Repudiation | `criado_por` never read from `formData`; derived server-side from `auth.uid()`, enforced again by the INSERT policy's `WITH CHECK` (Pattern 3, Pitfall 4) |
| RLS bypass via direct REST/DB API call on `demandas` | Elevation of Privilege / Information Disclosure | RLS enabled on `demandas` with explicit SELECT/INSERT/UPDATE policies — unreachable from any client regardless of API surface, same enforcement model Phase 2 established |
| View silently bypassing RLS (`demandas_com_status`) | Information Disclosure | `security_invoker = true` explicitly set on the view (Pattern 2) — without it, a view defined by a privileged role could leak rows a querying user's own RLS grants wouldn't otherwise allow |
| Overdue status manipulation via client clock skew | Tampering | The authoritative `atrasada` boolean is computed server-side against Postgres's own `current_date`, never trusted from a client-computed value (Pattern 2, Anti-Patterns) |

## Sources

### Primary (HIGH confidence — official docs / direct package inspection, fetched/verified directly)
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`, `.../09-revalidating.md`, `.../02-guides/forms.md`, `.../02-guides/server-actions.md` — read directly per AGENTS.md's instruction, confirming Server Actions, `useActionState`, `revalidatePath` vs `updateTag`/`cacheComponents` scoping, and the "treat every action as untrusted, never trust ownership from formData" security guidance
- Direct `npm pack date-fns@4.4.0` tarball extraction and `.d.ts` inspection — confirmed `isPast(date): boolean` exists at package root and `ptBR: Locale` is exported from both `date-fns/locale` and `date-fns/locale/pt-BR`
- `npm view <pkg> version` (live registry) for `date-fns`, `react-hook-form`, `@hookform/resolvers`, `zod`, `@hookform/resolvers` peerDependencies — all versions in Standard Stack confirmed current as of 2026-08-03
- `.agents/skills/supabase-postgres-best-practices/references/` (installed project skill) — FK indexing, bigint-identity PK preference, partial/composite index patterns, constraint-migration idempotency
- `.agents/skills/supabase/SKILL.md` (installed project skill) — "views bypass RLS by default," "UPDATE requires a SELECT policy," `SECURITY DEFINER` scoping guidance — directly corroborated by Phase 2's own live-verified `02-01-SUMMARY.md` deviation report

### Secondary (MEDIUM confidence — WebSearch cross-referencing official sources)
- https://www.postgresql.org/docs/current/ddl-generated-columns.html (via WebSearch summary) — generated columns require `IMMUTABLE` expressions; `now()`/`current_date` are `STABLE`, ruling out a stored generated `atrasada` column
- https://ui.shadcn.com/docs/installation/next (via WebFetch) — `shadcn@latest init`/`add` CLI commands, confirmed React 19/Tailwind v4 support in current shadcn releases (exact Next.js 16-specific notes not present in fetched content, cross-checked against the project's own installed Next 16.2.12 + Tailwind v4 + React 19 stack for compatibility)

### Tertiary (LOW confidence — not independently re-verified this session)
- Exact current shadcn/ui `init` prompt flow/flags for this specific Next.js 16.2.12 + Tailwind v4 + TypeScript 7 combination — the fetched docs page didn't surface Next.js 16-specific caveats; the planner/executor should run `npx shadcn@latest init` interactively and read its own prompts rather than assuming a fully scripted non-interactive flow

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified live against npm registry; date-fns API surface verified via direct tarball inspection, not just docs
- Architecture (schema, RLS, overdue derivation): HIGH — schema/RLS mechanics directly extend Phase 1/2's proven, live-verified patterns and the project's own installed best-practices skills; overdue-derivation constraint (generated columns require IMMUTABLE) is a well-established, unambiguous Postgres limitation
- Next.js 16 Server Actions/forms guidance: HIGH — read directly from `node_modules/next/dist/docs/` per AGENTS.md's explicit instruction, not from training data
- shadcn/ui introduction decision: MEDIUM — official docs fetched and cross-checked, but no Context7 MCP available this session to verify the exact current CLI prompt flow for this project's specific Next.js 16/Tailwind v4/TypeScript 7 combination
- Pitfalls: HIGH for Pitfalls 1, 3, 4, 5 (each backed by a specific, verified mechanism or direct doc/skill citation); MEDIUM for Pitfall 2 (área normalization — a reasoned prediction, not yet observed in this project's actual data)

**Research date:** 2026-08-03
**Valid until:** 2026-08-17 (14 days — matches Phase 1/2's window; Next.js/Supabase/shadcn guidance all ship frequently)

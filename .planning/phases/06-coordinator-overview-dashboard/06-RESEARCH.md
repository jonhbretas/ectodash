# Phase 6: Coordinator Overview Dashboard - Research

**Researched:** 2026-08-04
**Domain:** Postgres read-side aggregation (`GROUP BY` counts across a many-to-many join table) on data already fully visible to the requesting role via existing RLS; Next.js 16 App Router route/page structure for a role-conditional surface; whether a chart library is warranted at this data volume
**Confidence:** HIGH — the RLS-visibility question (does coordenador's own scoped SELECT already return every row) is directly verifiable by reading migration `0004_demandas_role_scope.sql`'s own predicate, not an assumption; the Next.js 16 `proxy.ts` convention and route-group structure are read from this repo's own `src/proxy.ts` and `node_modules/next/dist/docs/`; the "no chart library needed yet" recommendation is a reasoned inference from COORD-01/02/03's actual wording (MEDIUM, since it's a UX judgment call, not a verified fact)

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists yet for this phase — research runs before `/gsd-discuss-phase`, the same ordering Phase 4 and Phase 5 used. No locked decisions, discretion areas, or deferred ideas to carry forward yet. Every design choice below is a research recommendation for discuss-phase/the planner to confirm or override.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COORD-01 | Coordenador vê painel único com status de projetos/pesquisas/tarefas por voluntário | Architecture Pattern 1 (per-responsável aggregation query) + Item 2 (new route recommendation) |
| COORD-02 | Painel destaca demandas atrasadas em toda a instituição | Architecture Pattern 2 (overdue highlight, reusing `demandas_com_status.atrasada` + existing `OverdueBadge`) + Item 1 (RLS-visibility verification — no bypass needed) |
| COORD-03 | Painel resume contagem de demandas por área e por voluntário | Architecture Pattern 1 (área count) + Pattern 1b (responsável count via `demanda_responsaveis` join, explicitly NOT a naive `GROUP BY` on `demandas` alone) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Vercel + Supabase free tier only — this phase should add no paid services and, per the Package Legitimacy Audit below, **no new required npm packages**. It is a read-only aggregation + Server Component phase reusing every library already installed in Phases 1-5.
- **RLS as the only real authorization boundary** — reinforced by this phase's specific question (Item 1 below): the coordinator-only dashboard's data safety comes from RLS already scoping what a `coordenador_geral` can SELECT, not from a new bypass mechanism. Any route-level "only render for coordenador" check is explicitly UX polish (avoiding a broken/empty page for the wrong role), never the authorization boundary itself — mirrors the exact same principle already stated for `demandas`' role-scoped RLS in Phase 5.
- **Migrations only as versioned SQL files under `supabase/migrations/`**, pushed via `npx supabase@latest db push` — next file would be `0005_*.sql` if the planner opts into a new view/RPC (see Item 4 below); not required if the planner chooses ad hoc Server Component queries instead.
- **Accessible UX for elderly users** (large text/touch targets, high contrast, pt-BR copy) — this phase's stat cards/highlighted overdue list must match the established baseline (`min-h-14`, `text-xl`/`text-2xl`/`text-3xl`, AA contrast, icon+label never color-alone per `StatusBadge`/`OverdueBadge`'s existing convention) rather than introducing a new visual language.
- **`zod`** — no new untrusted external input this phase (no `searchParams`-driven filtering is required by COORD-01/02/03 as stated, though the planner may choose to let the coordinator filter the aggregate view too — if so, reuse `demanda-filter-schema.ts`'s exact pattern).
- **date-fns** — no new date logic; `demandas_com_status.atrasada` (Phase 4's server-computed boolean) is the only overdue signal this phase needs, exactly as Phase 4/5 already established.
- **shadcn/ui** — no new components strictly required for stat cards (plain `div`s with the established Tailwind tokens suffice, matching `StatusBadge`/`OverdueBadge`'s `Badge` usage pattern); `Table` is already available if the planner wants a "por voluntário" breakdown table instead of/alongside stat cards.

## Summary

Phase 6's job is narrower and lower-risk than it might first appear, because Phase 5 already did the hard part. The coordinator's RLS SELECT predicate on `demandas` (migration `0004_demandas_role_scope.sql`, policy `"role-scoped demandas visibility"`) is `(select public.has_role('coordenador_geral')) or ...` — the very first disjunct is `true` for a coordenador with no further condition. This means **a coordenador's ordinary, role-scoped SELECT against `demandas_com_status` already returns every demanda in the institution, with no additional grant, view, or bypass needed.** Phase 6 is therefore not an authorization problem at all — it is a data-shaping problem: turning a flat row-per-demanda result set already fully visible to the coordenador into three aggregate views (by área, by responsável, overdue-highlighted) that Phase 5's list/filter UI does not currently compute.

The one genuine technical wrinkle is COORD-03's "contagem de demandas por... voluntário": `responsável` is many-to-many via `demanda_responsaveis`, not a column on `demandas` itself, so "how many demandas is each volunteer responsible for" cannot be a single `GROUP BY responsavel_id` on `demandas` — it requires aggregating across the join table, and a demanda with multiple responsáveis correctly counts once per responsável (mirroring the exact tiebreaker `demanda-list.tsx`'s `groupDemandas()` already established for `groupBy=responsavel` in Phase 5 — this phase should reuse that precedent, not invent a new one).

At this institution's documented scale ("dozens of demandas, not thousands" — the same ceiling 05-RESEARCH.md already used), the aggregation is cheap enough to compute either as a raw SQL `GROUP BY` query, a Postgres view, or in-memory in the Server Component after one flat fetch — all three are correctness-equivalent here. The research below recommends the middle path (ad hoc queries in the page's Server Component, no new view) as the simplest option that doesn't add a migration for a single-consumer aggregation, while flagging the view/RPC alternative as a reasonable discuss-phase override if the planner anticipates reusing these same counts elsewhere (e.g. a future export or Phase 7 reminder-run summary).

**Primary recommendation:** Build a new route `/coordenador` (NOT overloading `/`) — a Server Component that (1) reads the caller's `role` once (mirroring `page.tsx`'s existing pattern), (2) redirects non-coordenador visitors to `/` for UX reasons only (RLS remains the real boundary regardless), and (3) runs 2-3 small, already-role-scoped queries against `demandas_com_status` and `demanda_responsaveis` to compute área counts, responsável counts (via the join table, single batched query — never a per-volunteer loop), and an overdue list/count — rendered as large, accessible stat cards (`text-2xl`/`text-3xl` numbers, icon+label pairs matching `StatusBadge`'s convention) plus a reused `DemandaList`/`DemandaTable` for the overdue-highlighted section. No chart library (Recharts/Tremor) is needed this phase — COORD-01/02/03's own wording asks for "status," "destaque," and "contagem," which stat cards and a highlighted list satisfy completely; introducing a charting dependency here would be scope creep relative to Phase 10 (Financial Dashboard), which is this roadmap's actual "real charts" phase.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Institution-wide demanda visibility for coordenador (data safety) | Database/Storage | — | Already solved by Phase 5's RLS — `has_role('coordenador_geral')` is the first disjunct of the SELECT policy, so no new grant/bypass is needed; this phase reads through the existing `demandas_com_status` view exactly as Phase 4/5 already do |
| Aggregate counts by área / by responsável | Database/Storage | Frontend Server (SSR) | The `GROUP BY`/join aggregation is naturally a database-shaped computation (set-based counting); whether it's expressed as a raw query inside the Server Component or a dedicated view/RPC is a packaging choice (Item 4), not a tier choice — either way, Postgres does the counting, not client-side JS |
| Overdue highlighting institution-wide | Database/Storage | Frontend Server (SSR) | `atrasada` is already server-computed in `demandas_com_status` (Phase 4); this phase's only job is reading/sorting/rendering it at institution scope instead of the caller's own role-scoped subset — which, for a coordenador, are already the same set |
| Coordinator-only route access (UX gate, not security) | Frontend Server (SSR) | Browser/Client | A Server Component redirect based on the caller's `profiles.role` is UX polish preventing a non-coordenador from landing on a broken/empty aggregate page — RLS is still what actually prevents data leakage if this check were ever missing or buggy |
| Stat-card / highlighted-list rendering | Browser/Client | — | Pure presentation of already-aggregated, already-authorized server data; no client-side authorization logic, no client-side re-fetching |

## Standard Stack

### Core

No new required libraries. This phase is composed entirely of packages already installed and verified in Phases 1-5:

| Library | Version (as installed) | Purpose this phase | Why no new install |
|---------|------------------------|---------------------|---------------------|
| `@supabase/supabase-js` / `@supabase/ssr` | already installed (Phase 1) | Aggregate queries (`.select("area", { count: "exact" })`-style grouping, or a raw `GROUP BY` via `.rpc()` if the planner adds a function) against already role-scoped tables | Counting/grouping is expressible via PostgREST's own `count`/`group` support or a thin RPC wrapper — no new client capability needed |
| `date-fns` | already installed (Phase 4) | Reused only if the overdue section needs the same `dd/MM/yyyy` pt-BR formatting `OverdueBadge`/`DemandaCard` already use | No new usage pattern |
| shadcn/ui (`Table`, `Badge`) | already initialized (Phase 3/4) | Reused `StatusBadge`/`OverdueBadge`/`DemandaTable`/`DemandaCard` components for the overdue-highlighted list; plain `div`+Tailwind for stat cards | The CLI-copied component source from Phases 3/4 already covers every visual need this phase has |
| `zod` | already installed (Phase 4) | Only if the planner adds an optional área/responsável filter to the aggregate view — reuse `demanda-filter-schema.ts`'s exact pattern rather than a new schema | Not strictly required by COORD-01/02/03 as written |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | No supporting libraries needed this phase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| No chart library (stat cards + highlighted list) | Recharts (already recommended in this project's CLAUDE.md tech stack table) | Rejected for THIS phase — COORD-01/02/03 ask for "painel," "destaque," and "contagem," none of which require a bar/line chart to satisfy; a large `text-3xl` number in a card is more legible for the elderly-inclusive audience than a small chart's axis labels/legend, and Phase 10 (Financial Dashboard) is the roadmap's own designated "real charts" phase. If discuss-phase later wants a visual bar-per-área chart, Recharts direct (per CLAUDE.md, not Tremor) is the fallback — but nothing in this phase's stated success criteria requires it |
| Ad hoc aggregation queries in the Server Component (recommended, Item 4) | A new `demandas_by_area_summary` / `demandas_by_responsavel_summary` Postgres view | Reasonable alternative if the planner anticipates reusing these exact counts elsewhere (e.g. a future CSV export, or Phase 7's reminder-run summary wanting "how many overdue per área"); at this phase's single-consumer scale, a dedicated view adds a migration + a second thing to keep in sync with `demandas_com_status` for no proven reuse benefit yet — see Item 4 for the full tradeoff |
| Route-level redirect for non-coordenador (recommended) | Rely on RLS alone, let any role hit `/coordenador` and render whatever the (now-empty, for non-coordenador) aggregate queries return | Rejected — while RLS alone is *safe* (a non-coordenador's queries would correctly return only their own role-scoped rows, never leaking institution-wide data), it produces a confusing broken-looking page (e.g. "0 demandas" stat cards with no explanation) for a líder/voluntário who navigates or bookmarks the URL; a redirect is pure UX, matching the project's own established pattern of "RLS is the security boundary, UI guards are just better UX" (CLAUDE.md's own framing, already applied by `demandas-rls.test.ts`'s test-suite philosophy) |
| Single batched `demanda_responsaveis` query, grouped in application code | Per-volunteer loop (`for each responsável: count demandas`) | Rejected — this is exactly the N+1 pattern this project's own installed `data-n-plus-one.md` skill reference warns against; even at "dozens of volunteers" scale, the single-query shape costs nothing extra to write correctly from the start (Pattern 1b below) |

**Installation:**
```bash
# No installs required — this phase adds zero new npm dependencies.
```

**Version verification:** No new packages to verify. For completeness (in case the planner later opts into Recharts for a future iteration): `recharts` is currently `3.10.1` on the npm registry [VERIFIED: npm registry] and `@tremor/react` is `3.18.7` [VERIFIED: npm registry] — both current and unchanged from CLAUDE.md's own recommendation, but **not needed for this phase's stated requirements**.

## Package Legitimacy Audit

**This phase introduces no new npm packages.** No legitimacy check is required — every dependency used is already installed and was audited in a prior phase (Phase 1/3/4's own Package Legitimacy Audits cover `@supabase/*`, `date-fns`, `zod`, shadcn/Radix primitives).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | No new packages this phase |

**Packages removed due to `[SLOP]` verdict:** none — no new packages proposed.
**Packages flagged as suspicious `[SUS]`:** none.

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Browser                                                                    │
│  Coordenador navigates to /coordenador (new nav link, coordenador-only)   │
└────────────────────────────────────────────────────┬─────────────────────┘
                                                       │ GET /coordenador
┌──────────────────────────────────────────────────────────────────────────┐
│ Next.js 16 — src/proxy.ts (renamed from middleware.ts this Next version) │
│  Session-refresh + "signed in at all?" redirect ONLY — does NOT check    │
│  role today (role requires a DB read; proxy.ts only has the auth cookie) │
│  Unauthenticated → /login. Authenticated → passes through unchanged.     │
└──────────────────────────────────────────────────────────────┬───────────┘
                                                                 │
┌───────────────────────────────────────────────────────────────────────────┐
│ Next.js 16 Server Component — app/(dashboard)/coordenador/page.tsx (NEW) │
│  1. Read profile.role (same one-query pattern page.tsx already uses)     │
│  2. if role !== 'coordenador_geral': redirect('/')  ◄── UX GATE ONLY,    │
│     not the security boundary (RLS below is authoritative regardless)   │
│  3. Run 3 small role-scoped queries (Patterns 1/1b/2 below)              │
└───────────────────────────────────────┬───────────────────────────────────┘
                                         │ supabase.from("demandas_com_status")
                                         │   .select(...)   -- RLS already
                                         │                     returns ALL rows
                                         │                     for coordenador
                                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Supabase (Postgres)                                                      │
│                                                                            │
│  public.demandas_com_status (view, security_invoker=true, UNCHANGED)     │
│    RLS policy "role-scoped demandas visibility":                        │
│      (select has_role('coordenador_geral'))   ◄── first OR-branch,      │
│         or (is_lider_of_area(area))               true for coordenador, │
│         or criado_por = auth.uid()                no further condition  │
│         or is_responsavel_for(id)                 → coordenador's own   │
│                                                       SELECT already      │
│                                                       returns EVERY row   │
│         │                                                                 │
│         ▼ grouped in Postgres (COUNT...GROUP BY area) or in the          │
│           Server Component after one flat fetch — both correct at scale  │
│  ┌──────────────────┐         ┌───────────────────────────┐             │
│  │ by-área counts   │         │ demanda_responsaveis       │             │
│  │ (Pattern 1)      │         │  (Pattern 1b — join table,  │             │
│  └──────────────────┘         │   NOT groupable on          │             │
│                                 │   demandas alone)           │             │
│                                 └───────────────────────────┘             │
│         │                                    │                            │
│         ▼                                    ▼                            │
│  by-responsável counts (batched, single query — never one query/volunteer)│
│         │                                                                 │
│         ▼                                                                 │
│  overdue rows (atrasada = true, already server-computed by Phase 4)      │
└──────────────────────────────────────────────────────────────┬───────────┘
                                                                 │
┌───────────────────────────────────────────────────────────────────────────┐
│ Rendered UI (Server Component, no client JS needed for the data itself) │
│  Stat cards: "N demandas atrasadas", "N áreas", per-área/per-responsável │
│  count rows, reused DemandaTable/DemandaCard for the overdue list        │
└───────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
└── app/
    └── (dashboard)/
        ├── page.tsx                       # UNCHANGED — remains the personal/
        │                                    role-scoped demandas list (Phase 5);
        │                                    NOT overloaded with aggregate logic
        └── coordenador/                    # NEW route segment
            ├── page.tsx                    # NEW — Server Component: role read,
            │                                  redirect-if-not-coordenador, 3
            │                                  aggregate queries, render
            ├── area-summary.tsx             # NEW — stat cards / count rows by área
            ├── responsavel-summary.tsx      # NEW — stat cards / count rows by
            │                                  responsável (built from the joined,
            │                                  batched query — Pattern 1b)
            └── overdue-panel.tsx             # NEW — reuses DemandaTable/DemandaCard
                                                (imported from ../demandas/), NOT a
                                                new list-rendering implementation
```

Reusing `../demandas/demanda-table.tsx`, `demanda-card.tsx`, `status-badge.tsx`, `overdue-badge.tsx` directly (import across the route-group boundary — these are plain exported components, not colocated-and-private) avoids re-deriving the same status/overdue visual language `04-UI-SPEC.md` already locked, exactly as `05-02-SUMMARY.md`'s "Next Phase Readiness" note anticipated ("Phase 6's coordinator dashboard can reuse `DemandaList`'s `groupBy` prop if it needs similar área/responsável grouping").

### Pattern 1: Área count — a single `GROUP BY`-shaped query, no join needed

**What:** `demandas` has an `area` column directly, so "count of demandas per área" is the simplest of the three aggregates — no join, no responsável many-to-many wrinkle.
**When to use:** COORD-03's "por área" half.
**Example:**
```typescript
// src/app/(dashboard)/coordenador/page.tsx
// PostgREST doesn't expose a native GROUP BY over the JS client in a single
// call the way raw SQL does — the two correct options at this data volume
// (documented "dozens of demandas") are (a) fetch the already role-scoped
// rows once and group in-memory (simplest, no new SQL), or (b) a .rpc() call
// to a small SQL function if the planner wants the counting done in Postgres
// itself. Recommendation: (a), because this project has already shown a
// strong preference for grouping in the Server Component over adding new
// database objects for a single-consumer read (page.tsx's existing
// areaOptions derivation in Phase 5 does exactly this same in-memory
// group-by-uniqueness pattern).

const { data: rows } = await supabase
  .from("demandas_com_status")
  .select("id, area, atrasada, status");
  // RLS already returns every demanda for a coordenador — see the
  // Architectural Responsibility Map row above. No .eq()/.ilike() filter
  // is applied here; this IS the institution-wide read.

const countsByArea = new Map<string, number>();
for (const row of rows ?? []) {
  const key = row.area?.trim() || "Sem área definida"; // matches
    // demanda-list.tsx's SEM_AREA_DEFINIDA fallback bucket exactly — do not
    // invent a second "uncategorized" label
  countsByArea.set(key, (countsByArea.get(key) ?? 0) + 1);
}
```
**Why in-memory grouping over a SQL `GROUP BY` at this scale:** Per this project's own documented ceiling ("dozens of demandas, not thousands" — 05-RESEARCH.md's own phrasing, still accurate), one flat fetch plus a `Map` is a single round trip and trivially fast; a raw SQL aggregate would need either a Postgres function (`.rpc()`) or a second migration for a view — more moving parts than the data volume justifies. If a future phase's volume grows materially, revisit as a genuine SQL `GROUP BY`/view — this is a scale-appropriate choice, not a permanent architectural stance.

### Pattern 1b: Responsável count — MUST aggregate across `demanda_responsaveis`, never a naive `GROUP BY` on `demandas`

**What:** Because a demanda's responsável(s) live in the many-to-many `demanda_responsaveis` link table, not a column on `demandas`, "count of demandas per volunteer" requires reading that join table and counting per `profile_id` — a demanda with 2 responsáveis contributes to both volunteers' counts, mirroring `demanda-list.tsx`'s existing `groupBy=responsavel` tiebreaker exactly (Phase 5 already made this exact call and documented it in `05-02-SUMMARY.md`; this phase should cite and reuse that precedent, not re-derive it).
**When to use:** COORD-01 ("por voluntário") and COORD-03's "por voluntário" half.
**Example:**
```typescript
// A SINGLE batched query against demanda_responsaveis — never a
// per-volunteer loop (see Don't Hand-Roll and Common Pitfalls below).
// demanda_responsaveis has its own independently-scoped RLS (Phase 5,
// migration 0004) mirroring demandas' visibility rule — for a coordenador,
// this also already returns every link row institution-wide, same
// reasoning as Pattern 1.
const { data: responsaveisRows } = await supabase
  .from("demanda_responsaveis")
  .select("demanda_id, profile_id, profiles(email)");

const countsByResponsavel = new Map<string, { email: string; count: number }>();
for (const row of responsaveisRows ?? []) {
  const profileRow = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  // Defensive normalization — same nested-select shape quirk page.tsx
  // already documents for the exact same query pattern in Phase 5.
  const email = profileRow?.email;
  if (!email) continue;
  const existing = countsByResponsavel.get(row.profile_id) ?? { email, count: 0 };
  existing.count += 1;
  countsByResponsavel.set(row.profile_id, existing);
}
```
**Why this is NOT the same shape as Pattern 1:** `demandas.area` is a direct column, so grouping by it needs no join. `demanda_responsaveis` is a separate table by design (Phase 4's locked decision, overriding an earlier single-`responsavel_id`-column assumption) — any "count per volunteer" logic must query this table, and it is the one place in this phase where forgetting the join produces a subtly wrong number (e.g. counting only demandas with exactly one responsável, or crashing on `null`) rather than an obviously broken page.
**Cross-check against Pitfall 6 (N+1):** This single query, followed by one in-memory loop, is the entire responsável-counting logic — there is no scenario in this phase that requires a query inside a loop over volunteers.

### Pattern 2: Institution-wide overdue highlighting — reusing Phase 4's `atrasada`, no new computation

**What:** `demandas_com_status.atrasada` is already a server-computed boolean (Phase 4, `security_invoker=true`) — "highlight overdue demandas institution-wide" for a coordenador is simply: read the same view Pattern 1 already reads, filter/sort by `atrasada`, and render with the existing `OverdueBadge`/`DemandaCard`/`DemandaTable` components.
**When to use:** COORD-02.
**Example:**
```typescript
// Reuse the SAME rows fetched for Pattern 1 (no second query needed) —
// filter and sort in memory, exactly like demanda-list.tsx's existing
// compareDemandas() already sorts atrasada-first.
const overdue = (rows ?? [])
  .filter((row) => row.atrasada)
  .sort((a, b) => a.prazo.localeCompare(b.prazo));
```
```tsx
// overdue-panel.tsx — reuses DemandaTable/DemandaCard directly, not a new
// rendering implementation, per the Recommended Project Structure above.
import DemandaTable from "../demandas/demanda-table";
import DemandaCard from "../demandas/demanda-card";

export default function OverduePanel({ demandas }: { demandas: Demanda[] }) {
  return (
    <section aria-labelledby="overdue-heading">
      <h2 id="overdue-heading" className="text-2xl font-semibold text-zinc-900">
        Demandas atrasadas ({demandas.length})
      </h2>
      {/* same lg: breakpoint card/table switch demanda-list.tsx already uses */}
      <ul className="flex flex-col gap-4 lg:hidden">
        {demandas.map((d) => <DemandaCard key={d.id} {...d} />)}
      </ul>
      <div className="hidden lg:block">
        <DemandaTable demandas={demandas} />
      </div>
    </section>
  );
}
```
**Why no RLS bypass, service-role client, or `security_definer` RPC is needed here:** This is the direct answer to the phase brief's Item 1 verification question. `0004_demandas_role_scope.sql`'s SELECT policy on `demandas` is `(select has_role('coordenador_geral')) or (...)`  — an `OR` chain where the coordenador branch has no further row-level condition. A coordenador's ordinary authenticated client, using the anon key exactly as `page.tsx` already does, receives every row from `demandas_com_status` today, with zero code changes to RLS. Phase 6 needs no new migration for data access — only for the (optional, see Item 4) packaging of the aggregation itself.

### Pattern 3: Route guard — Server Component role read + redirect, not `proxy.ts`

**What:** `src/proxy.ts` (this Next.js version's renamed `middleware.ts`, per the file's own comment citing `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`) currently only checks "is there a signed-in user at all" — it has no role information, because role lives in `public.profiles`, a database read `proxy.ts`'s cookie-based session check does not perform. Adding a role check to `proxy.ts` would require either (a) stuffing role into a JWT custom claim (a real Supabase pattern, but a bigger, separate change not needed for a first cut) or (b) an extra Supabase query inside the proxy for every request to every route — disproportionate for a single coordenador-only page.
**When to use:** `/coordenador`'s access gate.
**Example:**
```tsx
// src/app/(dashboard)/coordenador/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CoordenadorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // proxy.ts already redirects unauthenticated
                            // visitors to /login before this ever renders;
                            // defensive null-check only, matching page.tsx's
                            // existing precedent.

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coordenador_geral") {
    // UX GATE ONLY — a non-coordenador's own RLS-scoped queries below
    // would return safe (correctly narrowed) data even without this
    // check; this redirect exists purely so a líder/voluntário who
    // navigates or bookmarks this URL lands somewhere coherent instead
    // of a confusing "0 demandas" aggregate page.
    redirect("/");
  }

  // ... Patterns 1/1b/2 queries follow, safe to run unconditionally here
  // because we've already established the caller IS coordenador_geral.
}
```
**Why a Server Component redirect, not a new `proxy.ts` role check:** Matches this project's own established division of labor — `proxy.ts` handles the cheap, cookie-only "signed in at all" gate for every route; a specific page's Server Component (already the pattern for reading `profile.role`, per `page.tsx`'s existing `scopedViewNotice` logic) handles anything that needs a database read. This also avoids adding a per-request DB query to `proxy.ts`'s matcher, which currently covers almost every route in the app.
**Why not rely on RLS alone with no redirect at all:** Valid from a pure security standpoint (see Alternatives Considered), but this phase's own success criteria describe a "painel" (dashboard) meant specifically for the coordenador — a non-coordenador landing on it and seeing an empty/nonsensical aggregate view is bad UX the redirect trivially prevents, and CLAUDE.md's own "client-side hiding is UX polish only" framing implies the inverse holds too: a UX-layer guard is fine and expected, as long as it's understood to be UX, not security.

### Anti-Patterns to Avoid

- **Adding a `demandas_com_status`-bypassing service-role client "to see everything for the coordinator":** Unnecessary and dangerous — per Pattern 2's verification, the coordenador's ordinary anon-key client already sees everything via RLS. Introducing a service-role key into a Next.js Server Component (even server-side) reopens exactly the kind of "hidden UI, but the underlying query has no real boundary" risk CLAUDE.md explicitly warns against, for zero benefit here.
- **Computing per-responsável counts with a query inside a `for` loop over volunteers:** The N+1 pattern this project's own installed `data-n-plus-one.md` skill reference names directly — Pattern 1b's single batched query is strictly simpler to write AND correct from the start; there is no version of this phase where the loop-based approach is easier.
- **Overloading `/` (the existing dashboard page) with a `role === 'coordenador_geral' ? <Aggregates/> : <PersonalList/>` branch:** Conflates two structurally different views (a filtered row-list vs. an aggregate/analytics view) into one file, makes `page.tsx` harder to reason about, and contradicts this phase's own framing (the phase brief explicitly distinguishes this from Phase 5's list view) — see Item 2 for the full route-choice reasoning.
- **Treating "área" grouping and "responsável" grouping as the same code path:** `demanda-list.tsx`'s Phase 5 `groupDemandas()` already proves these need different logic (one is a direct column, one is a join-table fan-out) — do not attempt to unify them into one generic "group by X" function that hides this difference; the responsável path fundamentally needs an extra query the área path does not.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "How many demandas does each volunteer have" | A per-volunteer query loop, or a client-side full-table scan re-implementing the join in JavaScript from scratch | A single batched `demanda_responsaveis` query + one `Map`-based grouping pass (Pattern 1b) | Matches this project's own installed N+1-avoidance guidance and Phase 5's existing `groupBy=responsavel` precedent — no new logic needs inventing, only reuse |
| "Is this visitor allowed to see the coordinator dashboard" | A new database role, grant, or RLS bypass specifically for this page | The existing `has_role('coordenador_geral')` check (already the first branch of `demandas`' SELECT policy) plus a simple Server Component redirect (Pattern 3) | The database-level answer to this question already exists and is already live — building a second mechanism duplicates Phase 2/5's work and risks the two diverging |
| Overdue-item visual treatment | A new badge/icon/color scheme for "overdue, but institution-wide this time" | The exact same `OverdueBadge`/`atrasada`-first sort `demanda-list.tsx`/`demanda-card.tsx` already implement | COORD-02 does not ask for a different visual meaning of "atrasada" — it asks for the same concept at a wider scope; reusing the component guarantees visual consistency automatically |

**Key insight:** This phase's most tempting hand-rolling risk is inventing new authorization machinery ("coordinator bypass," "admin view," a new RLS policy branch) when the actual authorization work was already fully completed in Phase 5. The only genuinely new logic this phase needs is the responsável-count join aggregation (Pattern 1b) — everything else is composition of already-existing, already-verified pieces.

## Runtime State Inventory

**Trigger check: this phase is not a rename/refactor/migration of an existing string, identifier, or schema element** — it is a new read-only route composing existing views/tables. No renamed columns, tables, RLS policies, env vars, or external service configuration are touched.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema change, no data migration. Existing `demandas`/`demanda_responsaveis`/`profiles` rows are read as-is. | None. |
| Live service config | None — no external service (Vercel Cron, Resend, Google Sheets) is touched this phase. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — no new env vars; reuses the same `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` every existing Server Component already uses. | None. |
| Build artifacts | None — no renamed packages/paths; if the planner opts into a new migration for Item 4's view/RPC alternative, it is purely additive (`0005_*.sql`), not a rename of `0001`-`0004`. | None. |

**Nothing found in any category** — verified by reading `0001`-`0004` migrations, `page.tsx`, and every `demandas/*.tsx` component directly; this phase adds a new page and (optionally) a new, additive migration, with no existing runtime state to reconcile.

## Common Pitfalls

### Pitfall 1: Assuming a new RLS policy, view, or service-role client is needed for "institution-wide" visibility

**What goes wrong:** A planner or implementer, seeing "institution-wide" in COORD-02's wording, reaches for a service-role client or a new "coordinator can see all" RLS policy branch — duplicating logic that already exists (`has_role('coordenador_geral')` is already the first OR-branch of `demandas`' SELECT policy from migration `0004`), risking the new mechanism silently diverging from the existing one (e.g. if a future migration changes the coordenador predicate in one place but not the other).
**Why it happens:** "Institution-wide" sounds like it requires bypassing the normal per-row scoping, when in fact, for exactly one role (coordenador), the normal per-row scoping already IS institution-wide by construction.
**How to avoid:** Before writing any new SQL, read `0004_demandas_role_scope.sql`'s actual SELECT policy text (reproduced in Pattern 2 above) and confirm the coordenador branch has no further condition — it doesn't. Write the dashboard's queries as ordinary authenticated-client reads, exactly like `page.tsx` already does.
**Warning signs:** A migration file that adds a new predicate mentioning `coordenador_geral` a second time, anywhere outside `0004`'s existing policies.

### Pitfall 2: Naive `GROUP BY`/count on `demandas` alone for the responsável breakdown

**What goes wrong:** `select area, count(*) from demandas group by area` is a correct pattern for área counts (Pattern 1) but has no equivalent single-table form for responsável counts, because responsável isn't a column on `demandas`. Attempting `demandas.responsavel_id` (which doesn't exist — Phase 4's schema deliberately has no such column, per `0003_demandas.sql`'s own comment) or grouping by `criado_por` (the demanda's *creator*, not its responsável) both produce a plausible-looking but semantically wrong count.
**Why it happens:** Área and responsável look structurally similar in the requirements text ("por área e por voluntário") but are modeled completely differently in the schema — one is a direct column, one is a many-to-many join.
**How to avoid:** Always query `demanda_responsaveis` explicitly for the responsável breakdown (Pattern 1b); never attempt to derive it from `demandas` alone.
**Warning signs:** A query or count that never references `demanda_responsaveis` but claims to report "demandas per volunteer."

### Pitfall 3: N+1 per-volunteer query loop for the responsável count

**What goes wrong:** For each distinct responsável, running a separate `count()` query ("how many demandas is this person responsible for") — correct in isolation, but N+1 in shape, and this project's own installed Postgres best-practices skill explicitly flags this exact pattern as MEDIUM-HIGH impact.
**Why it happens:** It's the "obvious" way to think about the problem procedurally ("for each volunteer, count their demandas") if you don't first fetch the join table in bulk.
**How to avoid:** One query against `demanda_responsaveis` (optionally joined to `profiles` for the email/display name), grouped in a single pass — Pattern 1b's exact shape. At this institution's volunteer count (documented as small — "dozens of demandas" implies a comparably small volunteer roster), the difference is not yet a measurable performance problem, but it is still the wrong shape to build, since the single-query version is no harder to write.
**Warning signs:** A `for` loop or `.map()` over a list of volunteers that issues a Supabase call inside the loop body.

### Pitfall 4: Overloading `/` instead of adding `/coordenador`, making the personal list page's Server Component do double duty

**What goes wrong:** `page.tsx` already has real complexity (searchParams parsing, área/responsável filter derivation, role-scoped-view notice, the N+1-adjacent responsável-email lookup) — adding a `role === 'coordenador_geral'` branch that computes and renders three additional aggregates inside the same file makes it harder to reason about either concern in isolation, and risks a future edit to one accidentally breaking the other (e.g. a filter-schema change accidentally affecting what the coordinator dashboard queries).
**Why it happens:** "It's the same data (`demandas_com_status`), so why not the same page" is a tempting simplification that ignores the phase brief's own explicit framing: this is "fundamentally different from Phase 5's per-row filtered LIST view... an analytics/summary view."
**How to avoid:** A new route (`/coordenador`, Pattern 3) with its own Server Component, importing shared display components (`DemandaTable`/`DemandaCard`/badges) but not sharing `page.tsx`'s filter/query logic.
**Warning signs:** A single `page.tsx` `if (role === 'coordenador_geral')` branch spanning more than a few lines, or any new aggregate-query code added directly inside the existing `/` page file.

### Pitfall 5: Área grouping key mismatch between this phase's aggregate and Phase 5's existing `demanda-list.tsx` fallback bucket

**What goes wrong:** Phase 5's `groupDemandas()` uses the exact literal string `"Sem área definida"` as its null/empty-área fallback bucket label. If this phase's área-count aggregation independently invents a different fallback label (e.g. `"Uncategorized"`, `"N/A"`, or an empty string as a real map key), the coordinator dashboard's área breakdown will visually disagree with the personal dashboard's grouped view for the exact same underlying data — confusing for a coordenador cross-referencing the two screens.
**Why it happens:** Copy-pasting the counting logic without also copying the exact fallback-label constant.
**How to avoid:** Reuse the literal string `"Sem área definida"` (or, better, export it as a shared constant from `demanda-list.tsx` and import it in the new `area-summary.tsx`, avoiding string-literal drift entirely).
**Warning signs:** A grep for `"Sem área"` turning up two different literal strings across the codebase after this phase ships.

### Pitfall 6: Forgetting that `demanda_responsaveis` has its OWN independently-scoped RLS (not inherited from `demandas`)

**What goes wrong:** Assuming that because the coordenador can see all of `demandas`, a query against `demanda_responsaveis` "must" also return everything — true for a coordenador specifically (its own SELECT policy also has an unconditional `has_role('coordenador_geral')` branch, per migration `0004`), but this assumption, if generalized carelessly into a shared helper reused for a non-coordenador page later, would be wrong for every other role, since `demanda_responsaveis`' RLS is a separately-restated predicate (Phase 5's own Pitfall 2/Pattern 4), not an automatic inheritance from `demandas`.
**Why it happens:** It's easy to forget that Postgres RLS never cascades from a parent table to a join table — a lesson Phase 5 already learned and documented at length in its own RESEARCH.md, directly relevant again here since this phase's Pattern 1b query touches that same table.
**How to avoid:** If any future reuse of Pattern 1b's query shape happens outside a coordenador-only context, re-verify against `0004_demandas_role_scope.sql`'s `demanda_responsaveis` policies specifically, not just `demandas`'.
**Warning signs:** A helper function or shared query utility that assumes "if `demandas` returns N rows for this user, `demanda_responsaveis` will return the matching join rows too" without re-checking that assumption per role.

## Code Examples

### Full `/coordenador` page skeleton (composing all three patterns)

```tsx
// src/app/(dashboard)/coordenador/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageContainer from "../page-container";
import AreaSummary from "./area-summary";
import ResponsavelSummary from "./responsavel-summary";
import OverduePanel from "./overdue-panel";

const SEM_AREA_DEFINIDA = "Sem área definida"; // matches demanda-list.tsx's
                                                  // exact fallback bucket label
                                                  // — see Pitfall 5

export default async function CoordenadorPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coordenador_geral") {
    redirect("/"); // UX gate only — see Pattern 3
  }

  // Pattern 1 + Pattern 2 base read — one query covers área counts AND
  // the overdue panel, since both derive from the same flat row set.
  const { data: rows } = await supabase
    .from("demandas_com_status")
    .select("id, titulo, prazo, status, area, atrasada");

  const countsByArea = new Map<string, number>();
  for (const row of rows ?? []) {
    const key = row.area?.trim() || SEM_AREA_DEFINIDA;
    countsByArea.set(key, (countsByArea.get(key) ?? 0) + 1);
  }

  const overdue = (rows ?? [])
    .filter((row) => row.atrasada)
    .sort((a, b) => a.prazo.localeCompare(b.prazo));

  // Pattern 1b — separate query, join table.
  const { data: responsaveisRows } = await supabase
    .from("demanda_responsaveis")
    .select("demanda_id, profile_id, profiles(email)");

  const countsByResponsavel = new Map<string, { email: string; count: number }>();
  for (const row of responsaveisRows ?? []) {
    const profileRow = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    const email = profileRow?.email;
    if (!email) continue;
    const existing = countsByResponsavel.get(row.profile_id) ?? { email, count: 0 };
    existing.count += 1;
    countsByResponsavel.set(row.profile_id, existing);
  }

  return (
    <PageContainer>
      <h1 className="text-3xl font-semibold text-zinc-900">
        Painel do coordenador
      </h1>
      <AreaSummary counts={countsByArea} />
      <ResponsavelSummary counts={countsByResponsavel} />
      <OverduePanel demandas={overdue} />
    </PageContainer>
  );
}
```

### Accessible stat card (no new dependency, matches existing token scale)

```tsx
// A plain stat card matching StatusBadge/OverdueBadge's icon+label
// convention and PageContainer's existing spacing tokens — no shadcn
// component or chart library needed for this shape.
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-14 flex-col gap-1 rounded-lg border border-zinc-300 bg-white p-4">
      <span className="text-base text-zinc-700">{label}</span>
      <span className="text-3xl font-semibold text-zinc-900">{value}</span>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `middleware.ts` / `middleware()` convention | `src/proxy.ts` / `proxy()` — same functionality, renamed | This Next.js 16.x release (confirmed live in this repo's own `src/proxy.ts` comment, citing `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`) | Any route-guard research or planning must reference `proxy.ts`, not `middleware.ts` — training-data guidance describing `middleware.ts` for this exact project is stale and must not be followed literally, per AGENTS.md's own warning |

**Deprecated/outdated:**
- `middleware.ts` at the project root or `src/` root: per this repo's own `src/proxy.ts` comment, a root-level `middleware.ts`-named file was tested and "registered in the dev middleware manifest but never actually intercepted requests under either Turbopack or webpack" in this Next.js version with `--src-dir` — do not reintroduce it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "No chart library (Recharts/Tremor) is needed this phase" — a UX/scope judgment that stat cards and a highlighted list fully satisfy COORD-01/02/03's literal wording | Summary, Standard Stack > Alternatives Considered | Low — if discuss-phase or the user wants a visual bar chart per área instead of a count list, this is a small addition (Recharts direct, per CLAUDE.md's own recommendation) layered onto the same aggregate data this research already produces; no rework of the underlying queries would be needed, only the rendering layer |
| A2 | "Ad hoc in-memory aggregation in the Server Component, not a new database view/RPC, is sufficient" — a packaging choice based on this project's documented small scale and single-consumer usage | Standard Stack > Alternatives Considered, Pattern 1 | Low-Medium — if a future phase (e.g. Phase 7's reminder-run summary) wants to reuse the exact same área/responsável counts, duplicating this in-memory logic in a second Server Component would be worse than having extracted a shared view/RPC now; not a correctness risk, only a possible future refactor |
| A3 | A Server Component redirect is the right shape for the coordinator-only UX gate, rather than extending `proxy.ts` with a role check | Pattern 3 | Low — both are valid; if a future phase adds several more coordinator-only routes, revisiting a `proxy.ts`-level role check (via a JWT custom claim, per Supabase's documented RBAC pattern already cited in this project's own `0002_profiles_role.sql` sources) becomes more attractive; for a single new route today, the simpler per-page check is proportionate |

## Open Questions

1. **Should the coordinator dashboard support the same área/responsável filtering Phase 5 built for the personal list view, or is it meant to always show the full institution-wide aggregate with no filter controls?**
   - What we know: COORD-01/02/03's wording describes a single summary view with no mention of interactive filtering; Phase 5's `demanda-filter-schema.ts` pattern is directly reusable if filtering is wanted.
   - What's unclear: Whether "painel único" (singular, unified dashboard) implies deliberately NO filter controls (see everything at once, by design) or whether a coordenador with many áreas would want to narrow the view.
   - Recommendation: Ship without filters for the first cut (matches the literal requirement wording); if discuss-phase or a UAT session surfaces a real need, adding `?area=` support to `/coordenador` is a small, additive change reusing `demanda-filter-schema.ts` as-is.

2. **Does "por voluntário" in COORD-01/COORD-03 include volunteers with a role other than `voluntario_comum` (e.g. should a `lider_area` or `financeiro` account's own responsável-assignments also appear in the per-volunteer breakdown)?**
   - What we know: `demanda_responsaveis.profile_id` references `profiles(id)` with no role restriction — any profile, regardless of role, can be a responsável for a demanda (Phase 4's schema imposes no such constraint).
   - What's unclear: Whether the coordinator dashboard's "por voluntário" breakdown is meant to literally mean every profile with ≥1 assignment, or specifically volunteers in the "rank-and-file" sense (excluding líderes/financeiro/the coordenador themself).
   - Recommendation: Include every profile with ≥1 `demanda_responsaveis` row, regardless of role — the schema doesn't distinguish, and excluding some roles would require an arbitrary, unrequested filter; simplest correct reading of "quem é responsável por quê" institution-wide.

## Environment Availability

No external tools/services beyond what's already verified running in Phases 1-5 (Supabase project reachability, Node/npm) are introduced by this phase. Skipping this section per the stated skip condition — this is a pure code/query-layer phase with no new external dependency.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 |
| Config file | `vitest.config.ts` (existing — `fileParallelism: false`, `include: ["tests/**/*.test.ts", "src/**/*.test.ts"]`) |
| Quick run command | `npx vitest run src/app/\(dashboard\)/coordenador/` (once test files exist) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COORD-01 | Per-área and per-responsável counts are computed correctly from a fixture set of demandas/demanda_responsaveis, including a demanda with 2+ responsáveis counting toward both | unit | `npx vitest run src/app/\(dashboard\)/coordenador/aggregate.test.ts` | ❌ Wave 0 |
| COORD-02 | A coordenador's `/coordenador` visit returns institution-wide overdue demandas, including ones created/owned by OTHER users (proving no accidental self-scoping) | integration | `npx vitest run tests/db/coordenador-dashboard.test.ts` | ❌ Wave 0 |
| COORD-03 | A non-coordenador (líder/voluntário/financeiro) visiting `/coordenador` is redirected to `/`, and their own direct Supabase queries against the same tables still return only their role-scoped subset (regression check against Phase 5's RLS) | integration | `npx vitest run tests/db/coordenador-dashboard.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` on the touched test file(s)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/app/(dashboard)/coordenador/aggregate.test.ts` — pure-unit tests for the área/responsável counting logic (Pattern 1/1b), extracted into a small testable helper function rather than inlined only in the Server Component, so it can be unit-tested without a live DB — covers COORD-01/COORD-03's counting correctness, including the multiple-responsáveis-per-demanda case
- [ ] `tests/db/coordenador-dashboard.test.ts` — live-integration test extending the existing `demandas-rls.test.ts`/`role-rls.test.ts` service-role-re-read pattern: proves a coordenador fixture's query against `demandas_com_status`/`demanda_responsaveis` returns rows created by OTHER fixture users (institution-wide, not self-scoped), and that a non-coordenador fixture hitting the same queries still only gets their own role-scoped subset (regression against Phase 5)
- [ ] No new test framework/config needed — existing Vitest setup and fixture patterns (`tests/db/demandas-rls.test.ts`) are directly reusable

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing Supabase Auth session, unaffected by this phase |
| V3 Session Management | no (unchanged) | Existing `proxy.ts`/`@supabase/ssr` cookie handling, unaffected |
| V4 Access Control | yes | Postgres RLS (`has_role('coordenador_geral')`, already live from Phase 2/5) remains the authorization boundary; the new route's Server Component redirect is an ADDITIONAL UX-layer check, never a substitute |
| V5 Input Validation | no (this phase, as scoped) | No new untrusted input — no `searchParams`/`formData` introduced by COORD-01/02/03 as written (see Open Question 1); if the planner adds optional filtering, reuse `demanda-filter-schema.ts`'s zod validation exactly |
| V6 Cryptography | no | Not applicable — no new secrets, tokens, or crypto operations this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A non-coordenador crafts a direct request to `/coordenador` hoping to see institution-wide data | Elevation of Privilege | Already mitigated at the data layer by RLS (their queries return only their own role-scoped rows regardless of which page renders them); the Server Component redirect (Pattern 3) additionally prevents even attempting to render the page, but is not the actual security control |
| A future edit accidentally adds a second, diverging "is this user a coordenador" check (e.g. a hardcoded email list, or a client-side-only role check) instead of reusing `has_role()`/reading `profiles.role` server-side | Tampering / Elevation of Privilege | Always reuse the existing `profiles.role` read + `has_role()` SQL helper (already `SECURITY DEFINER`, already revoked from `anon`/`public`) — never introduce a second, parallel authorization mechanism for the same question |
| Information disclosure via the aggregate counts themselves (e.g. a stat card leaking that área "X" has demandas even to a role that shouldn't know área "X" exists) | Information Disclosure | Not a risk in the current design, because the redirect (Pattern 3) prevents any non-coordenador from reaching the aggregation queries at all, and the coordenador role is, by requirement, meant to see everything institution-wide — there is no partial-visibility case to protect against within this page |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/0003_demandas.sql`, `0004_demandas_role_scope.sql`, `0002_profiles_role.sql` — read directly, this repo — RLS predicate structure, `demandas_com_status` view, `has_role()`/`is_lider_of_area()`/`is_responsavel_for()` helpers
- `src/app/(dashboard)/page.tsx`, `demandas/demanda-list.tsx`, `demanda-filters.tsx`, `demanda-filter-schema.ts`, `demanda-card.tsx`, `demanda-table.tsx`, `status-badge.tsx`, `overdue-badge.tsx` — read directly, this repo — existing Server Component query patterns, grouping tiebreaker precedent, reusable display components
- `src/proxy.ts`, `src/lib/supabase/middleware.ts` — read directly, this repo — confirms the `middleware.ts` → `proxy.ts` rename and current auth-gate scope (session-only, no role check)
- `.planning/phases/05-demandas-filtering-role-scoped-access/05-01-SUMMARY.md`, `05-02-SUMMARY.md`, `05-RESEARCH.md` — read directly, this repo — RLS narrowing rationale, grouping-by-responsável tiebreaker decision, "Next Phase Readiness" notes anticipating this phase's reuse
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` — official Next.js docs, read directly per AGENTS.md's instruction to consult `node_modules/next/dist/docs/` before writing code against this non-standard Next.js version
- `.agents/skills/supabase-postgres-best-practices/references/data-n-plus-one.md`, `security-rls-performance.md` — project-installed skill references, read directly

### Secondary (MEDIUM confidence)
- `npm view recharts version` / `npm view @tremor/react version` — registry lookups confirming current versions (3.10.1 / 3.18.7) for the "not needed this phase" recommendation's completeness, cross-referenced against CLAUDE.md's existing recommendation of the same libraries

### Tertiary (LOW confidence)
- None — every claim in this research is grounded in a file read directly from this repository or an official Next.js doc bundled with the installed `next` package; no unverified web-search-only claims were used.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, every existing package's version confirmed already installed via `package.json`
- Architecture: HIGH — the RLS-visibility claim (coordenador's SELECT already returns all rows) is verified by reading the actual policy SQL, not inferred; the `proxy.ts` rename is verified by reading this repo's own file and its cited doc
- Pitfalls: HIGH — every pitfall is a direct extension of a lesson this project's own Phase 2/4/5 already lived through and documented (SELECT-gates-UPDATE, RLS non-cascade to join tables, N+1), not a speculative concern

**Research date:** 2026-08-04
**Valid until:** 2026-09-03 (30 days — stable domain, no fast-moving external dependency; re-verify sooner only if the planner decides to introduce a chart library or a new database view, since Item 4's tradeoff should be re-checked against actual data volume at that time)

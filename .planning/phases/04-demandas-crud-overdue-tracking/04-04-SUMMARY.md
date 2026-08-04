---
phase: 04-demandas-crud-overdue-tracking
plan: 04
subsystem: ui
tags: [nextjs, tailwind, lucide-react, date-fns, accessibility, responsive]

# Dependency graph
requires:
  - phase: 04-01
    provides: "public.demandas_com_status view — atrasada boolean computed server-side, the only source of truth this plan's rendering code reads"
  - phase: 04-02
    provides: "DemandaCard (minimal tracer version), page.tsx's demandas_com_status read — both extended/replaced by this plan"
provides:
  - "StatusBadge — the only component in the codebase rendering a demanda's pendente/em_andamento/concluida state, icon+color+label"
  - "OverdueBadge — the only component rendering the Atrasada indicator, with an aria-label stating the actual prazo date"
  - "DemandaCard (full mobile layout) — título, status badge, responsável row, prazo row with overdue treatment, área chip with Sem área definida backstop"
  - "DemandaTable — desktop (lg+) table view with the border-l-4 overdue row stripe"
  - "DemandaList — the breakpoint-switching container: CSS-only lg: switch, single sort comparator (atrasada-first, prazo-ascending, concluida-last), empty state, header with count badge"
affects: ["Phase 5 (filtered views reuse StatusBadge/OverdueBadge and extend DemandaList's query, not its sort rule)", "Phase 6 (coordinator dashboard reuses the same badges)", "Phase 3 (UI polish pass lifts these tokens wholesale per 04-UI-SPEC.md's Sequencing Note)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every status/overdue indicator pairs an icon (lucide-react) with a color and an always-visible text label — never color alone, enforced via grep in acceptance criteria"
    - "atrasada is read once from demandas_com_status and threaded unchanged through DemandaList's sort comparator and both DemandaCard/DemandaTable's rendering — no component in this chain recomputes it from a client-side date comparison"
    - "Single comparator function implements the full 3-part sort rule (atrasada first, prazo ascending, concluida last) in one place rather than three separate array operations"
    - "CSS-only breakpoint switch (lg:hidden / hidden lg:block) for card-vs-table layout — no JS-based screen-width detection"

key-files:
  created:
    - src/app/(dashboard)/demandas/status-badge.tsx
    - src/app/(dashboard)/demandas/overdue-badge.tsx
    - src/app/(dashboard)/demandas/demanda-table.tsx
    - src/app/(dashboard)/demandas/demanda-list.tsx
  modified:
    - src/app/(dashboard)/demandas/demanda-card.tsx
    - src/app/(dashboard)/page.tsx

key-decisions:
  - "Moved the lg: breakpoint-switch wrapper (hidden lg:block) to demanda-list.tsx around DemandaTable, and kept DemandaCard's <li> plain, relying on demanda-list.tsx's <ul className=\"lg:hidden\"> for the mobile-side switch — keeps the single-switch decision in one component (the container) rather than splitting it across DemandaCard and DemandaTable."
  - "Downgraded page.tsx's greeting from <h1> to <h2> now that DemandaList renders the page's real <h1> (\"Demandas\", per 04-UI-SPEC.md) — avoids two <h1> elements on one page, a heading-hierarchy correctness issue for an accessibility-sensitive app (Rule 2)."
  - "Reworded a code comment in demanda-list.tsx to avoid the literal words \"useEffect\"/\"matchMedia\" appearing in prose, since the plan's own acceptance criterion greps for those tokens as a no-JS-breakpoint-detection proof and would otherwise false-positive on the comment describing what was NOT used."

patterns-established:
  - "StatusBadge and OverdueBadge are the canonical status/overdue rendering components — no other component in the codebase should re-derive this visual treatment."
  - "DemandaList's sort comparator is the phase's canonical demandas ordering; later filtering (Phase 5) extends the query feeding it, not the sort rule itself."

requirements-completed: [DEM-03, DEM-01]

coverage:
  - id: D1
    description: "A demanda whose prazo has passed and whose status is not concluída is visually flagged as atrasada automatically, with no manual marking step, via icon+color+always-visible-text (never color alone)"
    requirement: "DEM-03"
    verification:
      - kind: unit
        ref: "grep acceptance criteria: overdue-badge.tsx contains AlertTriangle, Atrasada, aria-label with 'prazo era', ptBR formatting; no isPast/new Date() comparison in overdue-badge.tsx or demanda-list.tsx"
        status: pass
      - kind: integration
        ref: "npx tsc --noEmit (exit 0)"
        status: pass
    human_judgment: true
    rationale: "Visual correctness (icon/color/label rendering together, red stripe on desktop rows) requires a rendered browser check; grep proves the required tokens/patterns are present in source but not final pixel output."
  - id: D2
    description: "StatusBadge renders all 3 statuses (pendente/em_andamento/concluida) pairing icon+color+label per 04-UI-SPEC.md's table exactly"
    requirement: "DEM-01"
    verification:
      - kind: unit
        ref: "grep acceptance criteria: Pendente/Em andamento/Concluída labels, amber-700/blue-700/green-700 colors, Circle/Clock/CheckCircle2 icons all present in status-badge.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "The demandas list renders as full-width stacked cards below lg and a table at lg+, CSS-only switch, sorted atrasada-first/prazo-ascending/concluida-last"
    requirement: "DEM-01"
    verification:
      - kind: unit
        ref: "grep acceptance criteria: lg:hidden and hidden lg:block both present in demanda-list.tsx; zero matches for useEffect/window.innerWidth/matchMedia; atrasada referenced in the sort; no isPast/new Date() comparison"
        status: pass
      - kind: integration
        ref: "npx tsc --noEmit (exit 0); npm test (40 passed, 2 skipped, 0 failed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zero demandas renders the documented empty-state heading/body/CTA; a demanda with no área renders the Sem área definida backstop in both card and table"
    requirement: "DEM-01"
    verification:
      - kind: unit
        ref: "grep acceptance criteria: 'Nenhuma demanda cadastrada ainda' in demanda-list.tsx; 'Sem área definida' in both demanda-card.tsx and demanda-table.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "tsc, full test suite, and ESLint are clean with no regression to Phase 1/2/4-01/4-02/4-03 suites"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (exit 0, both in isolation and after 04-03's concurrent commits landed); npm test (7 test files, 40 passed, 2 skipped, 0 failed); npx eslint on all 6 plan files (clean)"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-08-04
status: complete
---

# Phase 4 Plan 4: Responsive Demandas List — Status/Overdue Badges & Card/Table UI Summary

**StatusBadge and OverdueBadge as the codebase's only status/overdue rendering components (icon+color+always-visible-label, never color alone), threaded into a fully responsive DemandaList that switches between DemandaCard (mobile/tablet) and DemandaTable (desktop) via a CSS-only `lg:` breakpoint, sorted atrasada-first/prazo-ascending/concluída-last by a single comparator that reads — never recomputes — the server-computed `atrasada` boolean.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-04
- **Tasks:** 2
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- `StatusBadge` — renders `pendente` (amber, `Circle`), `em_andamento` (blue, `Clock`), `concluida` (green, `CheckCircle2`), each pairing icon + color + always-visible Portuguese label exactly per 04-UI-SPEC.md's Status Representation table.
- `OverdueBadge` — renders the `Atrasada` pill (`AlertTriangle`, red), receiving `prazo` from the caller and never checking `atrasada` itself; `aria-label` states `Atrasada — prazo era {dd/MM/yyyy}` via `date-fns`/`ptBR`.
- `DemandaCard` extended from plan 04-02's minimal tracer to the full mobile layout: título + status badge (row 1), responsável with `User` icon (row 2), prazo with `Calendar` icon that turns red + shows `OverdueBadge` when `atrasada` (row 3), área chip or `Sem área definida` backstop (row 4) — the whole card wrapped in a `<Link>` to the edit route.
- `DemandaTable` — new desktop (`lg:` and above) table with Título/Responsável/Prazo/Status/Área columns, 1-line truncation + native `title` tooltip on título, `border-l-4 border-red-700` left stripe on overdue rows in addition to the inline `OverdueBadge`, row-click navigation to the edit route.
- `DemandaList` — new container: single comparator sorting atrasada-first → prazo ascending → concluída last; CSS-only `lg:hidden`/`hidden lg:block` switch between the card list and the table; documented empty state (`ClipboardList` icon, exact heading/body copy, inline `Nova demanda` CTA); header with `h1 Demandas`, singular/plural count badge, and the `Nova demanda` CTA.
- `page.tsx` updated to fetch `status`, `area`, and `atrasada` from `demandas_com_status` (previously only `id, titulo, prazo`) and render `<DemandaList>` in place of the plan 04-02 inline list, keeping the existing greeting and `SignOutButton`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Status and overdue badges** - `87becf1` (feat)
2. **Task 2: Responsive demandas list — cards, table, sort order, empty state, área backstop** - `81ef4f3` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified

- `src/app/(dashboard)/demandas/status-badge.tsx` - `StatusBadge` component, 3-state icon+color+label pill
- `src/app/(dashboard)/demandas/overdue-badge.tsx` - `OverdueBadge` component, red pill with `aria-label` stating the prazo date
- `src/app/(dashboard)/demandas/demanda-table.tsx` - desktop table view, overdue row stripe, área backstop
- `src/app/(dashboard)/demandas/demanda-list.tsx` - breakpoint-switching container, sort comparator, empty state, header
- `src/app/(dashboard)/demandas/demanda-card.tsx` - extended to full mobile card layout (título/status/responsável/prazo/área rows)
- `src/app/(dashboard)/page.tsx` - fetches `status`/`area`/`atrasada`, renders `<DemandaList>` in place of the inline list; greeting demoted to `<h2>` so `DemandaList`'s `<h1>` is the page's only top-level heading

## Decisions Made

- **Moved the `lg:` breakpoint-switch wrapper into `demanda-list.tsx`** rather than having `DemandaTable` wrap itself: `demanda-list.tsx` renders `<ul className="lg:hidden">` for the card list and `<div className="hidden lg:block"><DemandaTable /></div>` for the table, keeping the single switch decision in one component (the container), matching the plan's own framing of `demanda-list.tsx` as "the breakpoint-switching container."
- **Demoted `page.tsx`'s greeting `<h1>` to `<h2>`** now that `DemandaList` renders the page's actual `<h1>` (`Demandas`, per 04-UI-SPEC.md's Screen Inventory) — two `<h1>` elements on one page is a heading-hierarchy defect for an app with an explicit elderly/accessibility-sensitive audience (Rule 2 — missing correctness for a11y).
- **Reworded a code comment in `demanda-list.tsx`** to avoid the literal strings "useEffect"/"matchMedia" appearing in descriptive prose, since the plan's own acceptance criterion (`grep -c 'useEffect\|window.innerWidth\|matchMedia'` must output 0) would otherwise false-positive on a comment explaining what technique was deliberately NOT used — same pattern 04-02 used for the `criado_por` grep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Acceptance-criteria grep false positive from prose mentioning "useEffect"/"matchMedia"**
- **Found during:** Task 2, first acceptance-criteria grep pass
- **Issue:** An early draft of `demanda-list.tsx`'s file-level comment explained the CSS-only breakpoint approach by naming the JS alternatives NOT used ("No JS/useEffect/matchMedia is used..."), which is exactly the token pattern the plan's own `grep -c 'useEffect\|window.innerWidth\|matchMedia'` acceptance criterion checks for (expecting 0 matches). The comment itself matched, producing a false-positive count of 1.
- **Fix:** Reworded the comment to describe the same fact in different words ("No JavaScript-based screen-width detection... is used") without using the literal banned tokens.
- **Files modified:** `src/app/(dashboard)/demandas/demanda-list.tsx`
- **Verification:** `grep -c 'useEffect\|window.innerWidth\|matchMedia' demanda-list.tsx` now outputs 0.
- **Committed in:** `81ef4f3`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug, a self-inflicted grep false-positive, not a functional defect).
**Impact on plan:** No scope creep — a one-comment wording fix with zero runtime behavior change.

## Concurrency Notes (plan 04-03 running in parallel)

This plan ran in the same wave as plan 04-03 (edit form + conclude action), which touches `actions.ts`, `demanda-form.tsx`, `conclude-button.tsx`, and `demandas/[id]/editar/page.tsx` — a disjoint file set from this plan's scope. No conflicting edits occurred. Partway through this plan's execution, 04-03 committed its own two commits (`d17360b`, `3e36d87`) directly to `master`; this plan's link targets (`/demandas/${id}/editar`) already matched the route 04-03 created, so no adjustment was needed. `npx tsc --noEmit` was re-verified clean after 04-03's commits landed.

The live-integration test suite (`tests/db/demandas-rls.test.ts`, `tests/db/role-rls.test.ts`) intermittently failed with Supabase Auth's `Request rate limit reached` during this plan's execution — a known environmental characteristic of the free-tier hosted project (documented in `04-01-SUMMARY.md`), compounded here by both agents' test runs hitting the same project's Auth sign-in rate limit concurrently. This was not a code defect: every failure was the identical `Request rate limit reached` sign-in error, and a clean `npm test` run (40 passed, 2 skipped, 0 failed) was obtained once test-run contention cleared.

## Issues Encountered

- Transient Supabase Auth sign-in rate-limit collisions during verification (see Concurrency Notes above) — resolved by re-running once contention cleared; no code change required.

## User Setup Required

None — no new environment variables, dependencies, or external service configuration. `lucide-react` and `date-fns` were already installed in plan 04-02.

## Outstanding Manual Verification (not blocking further work)

Per this plan's `autonomous: true` frontmatter, execution proceeded end-to-end without a human checkpoint. Two verification steps remain visual/manual and were not performed by this executor (no browser session available):

1. **Mobile viewport check:** confirm demandas render as cards with all 4 documented rows (título+status, responsável, prazo+overdue treatment, área chip) at a real mobile viewport width.
2. **Desktop viewport check:** confirm the same data renders as a table with the `border-l-4` overdue row stripe at ≥1024px.
3. **Overdue/concluded interaction:** confirm a demanda with a past prazo and status ≠ concluída shows the Atrasada badge automatically (no action taken), and an otherwise-identical demanda with status = concluída does not show it.
4. **Empty state:** confirm the documented empty-state block renders with zero demandas.

**What WAS verified automatically for this plan:** `npx tsc --noEmit` (clean), `npm test` (40 passed, 2 skipped, 0 failed — no regression), `npx eslint` on all 6 plan files (clean), and every grep-based acceptance criterion in both tasks (all passing).

**Recommendation:** the user should spot-check the four items above on `https://ectodash.vercel.app` (after the next deploy) or locally via `npm run dev` at their convenience.

## Next Phase Readiness

- `StatusBadge` and `OverdueBadge` are the phase's canonical status/overdue rendering components — Phase 5's filtered views and Phase 6's coordinator dashboard should reuse them rather than re-deriving the visual treatment.
- `DemandaList`'s sort comparator (atrasada-first, prazo-ascending, concluída-last) is the phase's canonical demandas ordering — Phase 5's filtering should extend the query feeding this list, not replace the sort rule.
- Phase 4 (Demandas CRUD & Overdue Tracking) is now complete: all 4 plans (04-01 schema/RLS, 04-02 create tracer, 04-03 edit/conclude, 04-04 this plan's responsive list UI) are done.
- No blockers for Phase 5 (Demandas Filtering & Role-Scoped Access).

---
*Phase: 04-demandas-crud-overdue-tracking*
*Completed: 2026-08-04*

## Self-Check: PASSED

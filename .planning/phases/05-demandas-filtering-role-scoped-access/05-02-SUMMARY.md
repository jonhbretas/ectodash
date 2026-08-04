---
phase: 05-demandas-filtering-role-scoped-access
plan: 02
subsystem: ui
tags: [nextjs, react, zod, vitest, shadcn, tailwind, searchParams]

# Dependency graph
requires:
  - phase: 05-01
    provides: "lider_areas many-to-many join table, is_lider_of_area()/is_responsavel_for() SECURITY DEFINER helpers, role/ownership-scoped RLS on demandas/demanda_responsaveis — every filter/group/notice value this plan renders is read from data RLS already scoped"
provides:
  - "demanda-filter-schema.ts — zod schema + parseDemandaFilters() validating area/responsavel/agrupar searchParams before any Supabase query is built"
  - "demanda-filters.tsx — Client Component filter bar (área/projeto Select, responsável Select, Agrupar por Select, removable active-filter chips, conditional Limpar filtros)"
  - "demanda-list.tsx groupBy prop — grouped section rendering (área or responsável), with compareDemandas applied within each group"
  - "demanda-list.tsx filtered-to-zero-results empty state, structurally distinct from the pre-existing no-demandas-at-all state"
  - "conclude-button.tsx window.confirm() gate before concludeDemanda"
  - "page.tsx searchParams-driven filtering, role-scoped-view notice (voluntário comum / líder with 0, 1, or 2+ áreas / coordenador), and filter-dropdown-option derivation from already-role-scoped data"
affects: [06-coordinator-dashboard, 07-reminders]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "searchParams read exclusively via the Server Component page prop (Promise-wrapped, Next.js 16), never useSearchParams() for data-fetching — the client hook is used ONLY in demanda-filters.tsx to control which Select option is visually shown"
    - "Filter dropdown options derived from the already role-scoped base query result, never a second unscoped DISTINCT query — closes the T-05-09 information-disclosure risk by construction"
    - "Empty-state branching kept as fully separate render branches (not a shared conditional) in demanda-list.tsx so the filtered-to-zero and no-demandas-at-all states can never bleed into each other"
    - "vitest include glob extended to also pick up src/**/*.test.ts (colocated pure-unit tests), alongside the existing tests/**/*.test.ts live-integration suites"

key-files:
  created:
    - src/app/(dashboard)/demandas/demanda-filter-schema.ts
    - src/app/(dashboard)/demandas/demanda-filter-schema.test.ts
    - src/app/(dashboard)/demandas/demanda-filters.tsx
  modified:
    - src/app/(dashboard)/demandas/demanda-list.tsx
    - src/app/(dashboard)/demandas/conclude-button.tsx
    - src/app/(dashboard)/page.tsx
    - vitest.config.ts

key-decisions:
  - "Grouping by responsável: a demanda with multiple responsáveis (demanda_responsaveis is many-to-many) appears once per group, one bucket per responsável — 05-UI-SPEC.md does not resolve this tiebreaker, so the simplest defensible rule was implemented and documented here rather than silently picking one responsável as 'primary'."
  - "Multi-área role-scoped-view notice phrasing: for a líder assigned to 2+ áreas, joined with ', ' and a final ' e ' before the last item (e.g. 'Mostrando as demandas das áreas Pesquisa de Campo e Eventos.') — no UI-SPEC copy exists for this exact case (only the single-área example is locked), so this is best-effort natural PT-BR phrasing."
  - "A líder with ZERO lider_areas rows gets the same notice as a voluntário comum ('Mostrando apenas as demandas atribuídas a você.') rather than a broken empty-área interpolation — matches plan 05-01's documented runtime-state note that a not-yet-assigned líder's effective RLS visibility is identical to a voluntário's."
  - "vitest.config.ts's include glob extended to also cover src/**/*.test.ts — the plan's own file path for the TDD task's test (demanda-filter-schema.test.ts) is colocated with the module it tests, outside the tests/ directory the config previously scoped to exclusively."

requirements-completed: [DEM-04, UX-02]

coverage:
  - id: D1
    description: "demanda-filter-schema.ts validates area/responsavel/agrupar from searchParams-shaped input via a red-then-green TDD cycle — 8 unit tests covering empty-state, trimming, empty-string-to-undefined normalization, UUID rejection, closed agrupar enum, and combined-filter cases"
    requirement: "DEM-04"
    verification:
      - kind: unit
        ref: "src/app/(dashboard)/demandas/demanda-filter-schema.test.ts — all 8 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "Filter bar (área/projeto, responsável, agrupar por shadcn Selects) with removable active-filter chips and conditional Limpar filtros, all navigation-driven with no client-held filtered data"
    requirement: "DEM-04"
    verification:
      - kind: other
        ref: "grep acceptance criteria on demanda-filters.tsx: exact copy strings, shadcn Select import, useSearchParams present (display-only), zero bg-blue-700 occurrences"
        status: pass
    human_judgment: true
    rationale: "Visual layout, breakpoint behavior, and actual filter-narrowing correctness against a live role-scoped dataset require human click-through against the real running app — grep confirms the exact contract strings and structural constraints are present, not that the UI renders/behaves correctly end-to-end."
  - id: D3
    description: "Grouped list rendering (área or responsável sections, sorted within each group) and the filtered-to-zero-results empty state, structurally distinct from the pre-existing no-demandas-at-all state"
    requirement: "DEM-04"
    verification:
      - kind: other
        ref: "grep acceptance criteria on demanda-list.tsx: FilterX/ClipboardList both present, Sem área definida, groupBy/filtersActive props, compareDemandas preserved"
        status: pass
    human_judgment: true
    rationale: "Correct empty-state selection depends on the interaction between filter state and the live role-scoped dataset size — needs human verification against a real account in each of the two empty-state conditions."
  - id: D4
    description: "conclude-button.tsx requires window.confirm() before calling concludeDemanda; canceling leaves the demanda unchanged; RLS remains the actual authorization boundary"
    requirement: "UX-02"
    verification:
      - kind: other
        ref: "grep acceptance criteria: window.confirm present, exact PT-BR copy, zero AlertDialog/@radix-ui/react-alert-dialog occurrences, concludeDemanda call preserved"
        status: pass
    human_judgment: true
    rationale: "A native confirm() dialog's actual browser behavior (blocking, cancel-preserves-state) needs a human click-through, not just static grep confirmation that the call site exists."
  - id: D5
    description: "page.tsx reads/validates searchParams, applies area/responsavel filters with no wildcard matching, derives filter options from already-scoped data, and renders the correct role-scoped-view notice for every role/área-count combination"
    requirement: "DEM-04, UX-02"
    verification:
      - kind: other
        ref: "grep acceptance criteria on page.tsx: parseDemandaFilters, Promise-wrapped searchParams, no useSearchParams import, .ilike area with no wildcard, lider_areas read, exact voluntário/coordenador notice branches, SignOutButton/demandas_com_status preserved"
        status: pass
    human_judgment: true
    rationale: "The role-scoped-view notice's correctness for líder-with-0/1/2+-áreas and the actual AND-combination of area+responsavel filters against the live role-scoped dataset both require a human exercising each role against the real hosted Supabase project."

# Metrics
duration: 55min
completed: 2026-08-04
status: complete
---

# Phase 5 Plan 2: Demandas Filter/Group UI, Role-Scoped-View Notice & Conclude-Confirmation Summary

**A 3-control shadcn Select filter bar (área/projeto, responsável, agrupar por) with removable chips and a distinct filtered-to-zero-results empty state, a server-rendered role-scoped-view notice correctly handling a líder assigned to zero/one/multiple áreas, and a window.confirm() gate on "Marcar como concluída" — all built entirely on plan 05-01's already-live RLS narrowing, zero new npm dependencies.**

## Performance

- **Duration:** ~55 min (excluding a ~5.5 min wait for a transient Supabase Auth sign-in rate-limit window to clear before final `npm test` confirmation)
- **Started:** 2026-08-04T09:45:00Z (approx)
- **Completed:** 2026-08-04T13:09:10Z
- **Tasks:** 3 (1 TDD)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `demanda-filter-schema.ts` built via a genuine red-then-green TDD cycle — 8 unit tests written first against a nonexistent module (confirmed failing), then the zod schema + `parseDemandaFilters()` helper implemented to make them pass, with no live database dependency.
- `demanda-filters.tsx` — a new Client Component filter bar reusing Phase 3's previously-unused `src/components/ui/select.tsx` for the first time: área/projeto Select, responsável Select, Agrupar por Select, capped at exactly 3 controls per 05-UI-SPEC.md, every change navigating via `router.push` with no client-held filtered data.
- `demanda-list.tsx` extended with grouped-section rendering (área or responsável, with a `Sem área definida` fallback bucket) and a structurally distinct filtered-to-zero-results empty state (`FilterX` icon) that can never be confused with the pre-existing no-demandas-at-all state (`ClipboardList` icon) — kept as two fully separate render branches.
- `conclude-button.tsx` now gates the existing `concludeDemanda` Server Action behind a native `window.confirm()` — zero new dependency, RLS remains the real authorization boundary regardless of confirmation.
- `page.tsx` reads and zod-validates `searchParams` (Next.js 16's `Promise`-wrapped Server Component prop), applies área (exact case-insensitive, no wildcards) and responsável filters combined with AND, derives filter dropdown options exclusively from the already role-scoped base query (never a second unscoped query), and renders a role-scoped-view notice correctly handling voluntário comum, líder with exactly one área, líder with 2+ áreas (best-effort PT-BR phrasing, no locked copy existed for this case), líder with zero áreas (falls back to the voluntário-comum notice rather than a broken empty interpolation), and coordenador geral (no notice, explicit branch).

## Task Commits

Each task was committed atomically:

1. **Task 1: Filter/group schema and zod-validated URL state (TDD)** - `d7d9d1c` (test+feat combined — RED suite written and confirmed failing against no implementation, then GREEN implementation added in the same commit)
2. **Task 2: Filter bar Client Component, grouped list rendering, filtered-empty-state, conclude-confirmation** - `0ed453f` (feat)
3. **Task 3: Wire searchParams into page.tsx** - `e36dcaa` (feat)

**Plan metadata:** (this commit, pending)

## TDD Gate Compliance

Task 1's RED phase was verified interactively (test run confirmed to fail with `Cannot find module './demanda-filter-schema'` before the schema file existed) and GREEN was verified immediately after (`npx vitest run` → 8/8 passing). Both phases are captured in a single commit (`d7d9d1c`) rather than two separate `test(...)`/`feat(...)` commits, since the task's own commit-granularity guidance treats "write failing tests, confirm they fail, then implement" as one atomic task-commit unit. The red-then-green discipline itself was followed exactly as specified; only the commit split differs from the strictest possible interpretation.

## Files Created/Modified

- `src/app/(dashboard)/demandas/demanda-filter-schema.ts` - zod schema (area/responsavel/agrupar) + `parseDemandaFilters()` helper for page.tsx
- `src/app/(dashboard)/demandas/demanda-filter-schema.test.ts` - 8-case unit suite, no live DB
- `src/app/(dashboard)/demandas/demanda-filters.tsx` - filter bar Client Component
- `src/app/(dashboard)/demandas/demanda-list.tsx` - groupBy rendering + filtered-to-zero-results empty state
- `src/app/(dashboard)/demandas/conclude-button.tsx` - window.confirm() gate
- `src/app/(dashboard)/page.tsx` - searchParams parsing, filtered query, role-scoped-view notice, prop wiring
- `vitest.config.ts` - extended `include` to also cover `src/**/*.test.ts`

## Decisions Made

- **Grouping-by-responsável tiebreaker:** a demanda with multiple responsáveis appears once per group (one bucket per responsável) rather than picking a single "primary" one — 05-UI-SPEC.md left this unresolved; documented here as the concrete rule implemented.
- **Multi-área notice phrasing (2+ áreas):** `", "`-joined with a final `" e "` before the last item — best-effort natural PT-BR, no locked copy existed for this exact case beyond the single-área example.
- **Zero-área líder fallback:** reuses the exact voluntário-comum notice string, matching plan 05-01's documented runtime-state note that this account's effective RLS visibility is currently identical.
- **vitest include glob extended:** added `src/**/*.test.ts` alongside the existing `tests/**/*.test.ts` — the plan's specified test file path is colocated with the schema it tests, outside the directory the config previously scoped exclusively to.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended vitest's include glob so the TDD task's test file is actually discovered**
- **Found during:** Task 1, first attempt to run `npx vitest run src/app/\(dashboard\)/demandas/demanda-filter-schema.test.ts`
- **Issue:** `vitest.config.ts`'s `include` was `["tests/**/*.test.ts"]` only (set in plan 05-01) — the plan's own specified test file path, colocated at `src/app/(dashboard)/demandas/demanda-filter-schema.test.ts`, was silently excluded ("No test files found, exiting with code 1"), which would have blocked the TDD task's entire red-then-green cycle.
- **Fix:** Added `"src/**/*.test.ts"` to the `include` array, with a comment explaining the colocated-pure-unit-test rationale.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run src/app/\(dashboard\)/demandas/demanda-filter-schema.test.ts` found and ran the file correctly afterward; full `npm test` run confirmed no existing suite was affected (still 8 files, same live-integration suites unaffected).
- **Committed in:** `d7d9d1c` (Task 1 commit)

**2. [Rule 1 - Bug] Reworded a code comment that produced a grep false-positive against its own acceptance criterion**
- **Found during:** Task 2, running the plan's own `grep -ciE 'AlertDialog|@radix-ui/react-alert-dialog' conclude-button.tsx` acceptance check
- **Issue:** A code comment explaining that no shadcn `AlertDialog` was introduced literally contained the word "AlertDialog", causing the grep (designed to catch an actual new dependency) to report a false match.
- **Fix:** Reworded the comment to convey the same intent ("no new modal-dialog dependency, Radix-backed or otherwise") without the literal substring the grep was checking for.
- **Files modified:** `src/app/(dashboard)/demandas/conclude-button.tsx`
- **Verification:** Re-ran the grep — 0 occurrences, passes.
- **Committed in:** `0ed453f` (Task 2 commit)

**3. [Rule 1 - Bug] Same false-positive pattern recurred in page.tsx against the useSearchParams acceptance criterion**
- **Found during:** Task 3, running the plan's own `grep -qE 'useSearchParams' page.tsx; test $? -eq 1` acceptance check
- **Issue:** A code comment explaining why `useSearchParams()` must never be imported in this Server Component literally contained the string "useSearchParams()", causing the same grep pattern to match the comment itself rather than an actual import.
- **Fix:** Reworded the comment to describe the client-side hook without spelling its exact name.
- **Files modified:** `src/app/(dashboard)/page.tsx`
- **Verification:** Re-ran the grep — no match, passes; re-ran `npx tsc --noEmit` and `npm test` to confirm the comment-only edit changed nothing functionally.
- **Committed in:** `e36dcaa` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug/false-positive)
**Impact on plan:** All three were necessary to actually satisfy the plan's own stated acceptance criteria (one test-discovery gap, two grep-vs-comment false positives caused by explaining a prohibition in the exact words the grep was checking for). No scope creep — none touch the actual filter/group/notice/confirm logic.

## Issues Encountered

- A transient Supabase Auth sign-in rate-limit ("Request rate limit reached") was hit during the final `npm test` confirmation run, caused by the cumulative sign-ins from three prior `npm test` invocations during Task 1/2/3 verification within the same 5-minute window (the same free-tier limit plan 05-01's own SUMMARY documents). Not a regression — waited ~5.5 minutes for the window to clear, then re-ran `npm test` cleanly (56 passed, 2 skipped, 0 failed). No code change was made in response to this; it is purely a test-execution-scheduling artifact already known from plan 05-01.

## User Setup Required

None - no external service configuration required. This plan introduces zero new npm dependencies and no schema/RLS changes.

## Verification Results

- `npx tsc --noEmit` — exit 0, no type errors, confirmed after each task and again after the final comment fixes.
- `npm test` — 56 passed, 2 intentionally skipped (missing `COORDINATOR_EMAIL`, pre-existing baseline), 0 failed. Includes the new 8-case `demanda-filter-schema.test.ts` suite plus every pre-existing suite from Phases 1/2/4/05-01.
- `npm run build` — succeeded; `/` (dashboard) correctly reports as a dynamic (`ƒ`) route, expected since reading `searchParams` opts a page into dynamic rendering.
- All plan-specified grep acceptance criteria verified directly on `demanda-filter-schema.ts`, `demanda-filters.tsx`, `demanda-list.tsx`, `conclude-button.tsx`, and `page.tsx` — see per-task acceptance criteria checklists below.

### Acceptance Criteria Checklist (Task 1)

- [x] `npx vitest run` on the filter-schema test file exits 0, all 8 behaviors passing
- [x] `npx tsc --noEmit` exits 0
- [x] Closed two-value `z.enum(["area", "responsavel"])` present
- [x] `.uuid()` validation present on `responsavel`
- [x] No wildcard/substring `%...%` construction in the schema file
- [x] `parseDemandaFilters` exported

### Acceptance Criteria Checklist (Task 2)

- [x] `npx tsc --noEmit` exits 0
- [x] `npm test` exits 0
- [x] Exact locked copy strings present (`Área ou projeto`, `Todas as áreas`, `Todos os responsáveis`, `Sem agrupamento`, `Limpar filtros`, chip remove `aria-label`s)
- [x] Uses `@/components/ui/select` (shadcn), no new native select or library
- [x] `useSearchParams` present (display-only, narrow sanctioned use)
- [x] Zero `bg-blue-700` occurrences (accent never signals an active filter)
- [x] Both empty states present and distinct (`FilterX`/`ClipboardList`, exact heading strings)
- [x] `Sem área definida` group fallback present
- [x] `filtersActive`/`groupBy` props present; `compareDemandas` name preserved
- [x] `window.confirm` + exact confirm copy present in conclude-button.tsx
- [x] Zero `AlertDialog`/`@radix-ui/react-alert-dialog` occurrences (no new dependency)
- [x] `concludeDemanda` Server Action call preserved

### Acceptance Criteria Checklist (Task 3)

- [x] `npx tsc --noEmit` exits 0
- [x] `npm test` exits 0
- [x] `parseDemandaFilters` called in page.tsx
- [x] `searchParams: Promise<...>` documented shape used, not a plain object
- [x] No `useSearchParams` import in page.tsx (Server Component only)
- [x] `.ilike("area", ...)` present with no wildcard-wrapped value
- [x] `lider_areas` actually read (not a hardcoded string)
- [x] Exact locked copy `Mostrando apenas as demandas atribuídas a você.` present, reused for both voluntário comum and the zero-área líder fallback
- [x] `coordenador_geral` no-notice branch explicit
- [x] `DemandaFilters`, `groupBy`, `filtersActive` all wired
- [x] `SignOutButton` and `demandas_com_status` preserved unchanged

## Next Phase Readiness

- DEM-04 and UX-02 are fully satisfied on top of plan 05-01's live RLS narrowing — Phase 5's roadmap goal ("Users can filter/group demandas and only see/edit what their role permits, through short, accessible forms") is complete pending a human click-through of the manual verification steps listed in the plan's `<verification>` block (role-scoped-notice text per role/área-count, filter+group combination, empty-state selection, and the conclude-confirmation dialog itself) — none of these are automatable via `npx tsc`/`npm test`/grep alone.
- Phase 6's coordinator dashboard can reuse `demanda-filter-schema.ts`'s validation pattern and `DemandaList`'s `groupBy` prop if it needs similar área/responsável grouping, per this plan's own `artifacts_this_phase_produces` contract.
- The role-scoped-view notice's role→copy mapping (including this plan's multi-área phrasing) is now the canonical reference for any future phase describing a líder's scope in prose.
- `docs/areas.md` (plan 05-01) remains the only área-assignment mechanism this notice depends on — no admin UI was added in this phase.

## Self-Check: PASSED

All created/modified files verified present on disk (`demanda-filter-schema.ts`, `demanda-filter-schema.test.ts`, `demanda-filters.tsx`, `demanda-list.tsx`, `conclude-button.tsx`, `page.tsx`, `vitest.config.ts`). All three task commits (`d7d9d1c`, `0ed453f`, `e36dcaa`) verified present in `git log`.

---
*Phase: 05-demandas-filtering-role-scoped-access*
*Completed: 2026-08-04*

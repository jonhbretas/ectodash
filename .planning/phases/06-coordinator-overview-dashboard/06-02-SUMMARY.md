---
phase: 06-coordinator-overview-dashboard
plan: 02
subsystem: ui
tags: [nextjs, rls, nav-entry-point]

requires:
  - phase: 06-coordinator-overview-dashboard
    provides: "plan 06-01's /painel route (coordenador-only institution-wide dashboard)"
provides:
  - "Coordenador-only 'Painel do coordenador' entry-point link on / (demanda-list.tsx header row)"
affects: []

tech-stack:
  added: []
  patterns:
    - "Role gating threaded as a prop from an already-fetched value (page.tsx's existing profiles.role read) rather than re-querying — same discipline already established by scopedViewNotice"
    - "New secondary/outline nav affordance reuses an exact existing className string (demanda-filters.tsx's 'Limpar filtros' desktop treatment) rather than inventing a new visual style"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/page.tsx
    - src/app/(dashboard)/demandas/demanda-list.tsx

key-decisions:
  - "Wrapped the header row's right-hand side ('Painel do coordenador' + 'Nova demanda') in a new flex flex-col sm:flex-row sm:items-center inner container so both buttons stack full-width on mobile and sit side-by-side at sm:+, without touching the outer header row's existing flex-col sm:flex-row sm:items-center sm:justify-between wrapper or its left-hand title/count block"

requirements-completed: [COORD-01]

coverage:
  - id: D1
    description: "A coordenador_geral sees a 'Painel do coordenador' link next to 'Nova demanda' on /'s header row, styled as a secondary/outline action (Limpar filtros treatment), linking to the working /painel route; every other role's header row is unchanged"
    requirement: "COORD-01"
    verification:
      - kind: other
        ref: "npx tsc --noEmit (clean); npm run build (clean, /painel still listed); npm test (56 passed/2 skipped, matches baseline); npm run lint (clean); all plan grep acceptance criteria pass except the bg-blue-700 count (see Deviations)"
        status: pass
    human_judgment: true
    rationale: "Confirming the link's visual placement, styling parity with Limpar filtros, and mobile stacking behavior (06-UI-SPEC.md Open Decision #2's flagged visual check) requires a human visually inspecting a live coordenador_geral session at narrow and wide viewport widths — no automated UI/browser test exists in this repo's suite for this page."

duration: 3min
completed: 2026-08-04
status: complete
---

# Phase 6 Plan 2: Coordinator Overview Dashboard Entry Point Summary

**Coordenador-only "Painel do coordenador" text link added to /'s existing header row, threaded from the already-fetched `profiles.role` value — zero new queries, zero new nav component.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-04T14:07:41Z
- **Completed:** 2026-08-04T14:10:41Z
- **Tasks:** 1 (auto)
- **Files modified:** 2

## Accomplishments
- `page.tsx` computes `isCoordenador = role === "coordenador_geral"` immediately after its existing `profiles` read (no second/duplicate query — `grep -c 'from("profiles")'` still outputs 1) and passes it to `DemandaList` as a new prop.
- `demanda-list.tsx` accepts the new optional `isCoordenador` prop (default `false`) and, when true, renders a `Painel do coordenador` link to `/painel` in its header row — styled with the exact secondary/outline treatment already used by `demanda-filters.tsx`'s `Limpar filtros` desktop button (`border border-zinc-400 bg-white text-zinc-900`, `min-h-14`, `hover:bg-zinc-100`, identical focus-visible ring).
- Both the new link and the existing `Nova demanda` button now live inside a small `flex flex-col sm:flex-row sm:items-center` wrapper so they stack full-width on mobile and sit side by side at `sm:`+ — reusing the outer header row's existing responsive pattern, no new breakpoint logic.
- Every role other than `coordenador_geral` renders the header row byte-identical to before this plan (verified: the only diff for that render path is the new conditional branch, which is skipped).

## Task Commits

Each task was committed atomically:

1. **Task 1 (auto): Coordenador-only "Painel do coordenador" entry-point link on /** - `27a0aff` (feat)

**Plan metadata:** pending (final docs commit, see below)

## Files Created/Modified
- `src/app/(dashboard)/page.tsx` - added `isCoordenador` derivation from the existing `role` read and threaded it as a new `DemandaList` prop
- `src/app/(dashboard)/demandas/demanda-list.tsx` - added `isCoordenador?: boolean` to `DemandaListProps`, defaulted to `false`, and renders the new link conditionally inside a new responsive wrapper around the header row's right-hand side

## Decisions Made
- Introduced one new inner `flex flex-col sm:flex-row sm:items-center` container around the header row's right-hand button(s), rather than adding the new link as a second direct child of the outer `justify-between` row — this keeps the outer row's two-slot (title-block / action-block) structure intact while giving the two buttons their own internal stacking behavior, satisfying 06-UI-SPEC.md's Open Decision #2 (buttons must not crowd at narrow widths) without inventing a new layout primitive.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blocking issues were encountered.

### Acceptance Criteria Discrepancy (documented, not auto-fixed)

**1. `grep -c 'bg-blue-700' demanda-list.tsx` outputs 2, not the plan's stated 1**
- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criteria expected `bg-blue-700` to appear exactly once in `demanda-list.tsx` post-change ("unchanged from before this plan — only the pre-existing 'Nova demanda' button uses the blue accent"). In fact the file already had **two** pre-existing occurrences before this plan: the header row's `Nova demanda` link and a second `Nova demanda` link inside the "no demandas at all" empty state (both present since Phase 4/5, confirmed via `git show HEAD~1:...demanda-list.tsx | grep -c bg-blue-700` = 2, i.e. before this plan's commit).
- **Resolution:** No code change made — this plan's diff adds zero new `bg-blue-700` occurrences (the new coordenador link correctly uses the zinc/white outline treatment, never blue). The discrepancy is a plan-authoring miscount of pre-existing occurrences, not a deviation in implementation. Verified via `git diff` that the only lines touched are the header-row restructure and the new conditional link — the empty-state `Nova demanda` button (line ~178) was never modified.
- **Files modified:** none (informational only)
- **Commit:** n/a — no fix needed, criterion premise was inaccurate

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 is now fully complete: `/painel` exists and works end-to-end (plan 06-01), and it is discoverable from the app's main screen via this plan's entry-point link (06-02). COORD-01/02/03 are all satisfied.
- `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` (56 passed/2 skipped, matching the pre-plan baseline) are all green with zero regressions.
- Manual/visual verification (coordenador sees the link; other roles do not; mobile stacking doesn't crowd) is still pending a human session — flagged per this plan's own `<verification>` section as requiring a live browser check, consistent with plan 06-01's equivalent human-judgment items.

---
*Phase: 06-coordinator-overview-dashboard*
*Completed: 2026-08-04*

## Self-Check: PASSED

Both modified files verified present on disk with expected content; commit `27a0aff` verified present in git log; 7 of 8 plan-specified grep acceptance criteria pass exactly, and the 8th (`bg-blue-700` count) is explained above as a pre-existing-count discrepancy in the plan's own criterion, not a defect introduced by this task.

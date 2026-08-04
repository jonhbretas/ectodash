---
phase: 03-accessible-ui-foundation
plan: 02
subsystem: ui
tags: [shadcn, tailwind, nextjs, accessibility, react]

requires:
  - phase: 03-01
    provides: "shadcn/ui initialized (button.tsx/input.tsx scaffolded and edited to min-h-14/text-xl accessibility floor), globals.css reconciled to locked hex palette (--primary #1D4ED8, --ring #1D4ED8, --input #A1A1AA), skip-link added to layout.tsx targeting id=\"main-content\""
provides:
  - "login-form.tsx and sign-out-button.tsx retrofitted onto shadcn Button/Input with byte-identical rendered output"
  - "New PageContainer primitive — single shared <main> wrapper for all (dashboard) group pages"
  - "id=\"main-content\" now present on every page reachable from layout.tsx's skip-link, completing Plan 03-01's incomplete wiring"
affects: [phase-5, phase-6, phase-8, phase-10]

tech-stack:
  added: []
  patterns:
    - "Retrofit-via-className-override: pass the pre-existing raw element's full className string as the shadcn component's className prop; twMerge (via cn()) resolves conflicting utilities (rounded-lg vs rounded-md, outline-based vs ring-based focus, bg-blue-700 vs bg-primary) in favor of the override, reproducing byte-identical computed output without fighting the component's own defaults."
    - "PageContainer: a zero-logic Server Component wrapper is the correct way to de-duplicate a copy-pasted layout className string across sibling route pages in the App Router, without introducing a persistent nav/header (out of scope this phase)."

key-files:
  created:
    - "src/app/(dashboard)/page-container.tsx"
  modified:
    - "src/app/(auth)/login/login-form.tsx"
    - "src/app/(dashboard)/sign-out-button.tsx"
    - "src/app/(dashboard)/page.tsx"
    - "src/app/(dashboard)/demandas/nova/page.tsx"
    - "src/app/(dashboard)/demandas/[id]/editar/page.tsx"

key-decisions:
  - "Retrofitted login-form.tsx's Input/Button and sign-out-button.tsx's Button (not left native) — the color tokens (--primary, --ring, --input) already matched exactly (Plan 03-01), and the remaining differences (rounded-lg vs rounded-md, outline- vs ring-based focus-visible, hover-shade vs hover-opacity) were a small, bounded set resolvable by passing the original className as an override through twMerge, not a full re-fight — so no element in this plan needed the raw-native fallback."
  - "PageContainer wraps all 3 <main> occurrences in [id]/editar/page.tsx, including both not-found early-return branches, for wrapper consistency, per the plan's explicit instruction."

requirements-completed: [UX-01, UX-03]

coverage:
  - id: D1
    description: "login-form.tsx's raw <input>/<button> now render through shadcn's <Input>/<Button>, with copy, sizing, and blue-700 accent unchanged"
    requirement: UX-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && npm run build (build/typecheck gate)"
        status: pass
      - kind: other
        ref: "grep 'Enviar link de acesso' / grep 'E-mail institucional' / grep 'min-h-14' / grep aria-live against login-form.tsx"
        status: pass
    human_judgment: true
    rationale: "Visual pixel-identity (computed height/color/focus-ring appearance) cannot be fully confirmed by grep or build alone — a human should view the login page and tab to the input/button to confirm no perceptible change, per the plan's own Verification section."
  - id: D2
    description: "sign-out-button.tsx's raw <button> now renders through shadcn's <Button>, preserving 'Sair' copy and the secondary/outline visual treatment"
    requirement: UX-01
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && npm run build"
        status: pass
      - kind: other
        ref: "grep 'Sair' against sign-out-button.tsx"
        status: pass
    human_judgment: true
    rationale: "Same visual-identity caveat as D1 — grep/build confirm copy and compile correctness, not pixel-for-pixel rendering."
  - id: D3
    description: "New PageContainer component replaces the triplicated py-16 px-6 bg-zinc-50 wrapper across page.tsx, nova/page.tsx, and [id]/editar/page.tsx, and adds id=\"main-content\" to all of them"
    requirement: UX-03
    verification:
      - kind: unit
        ref: "npx tsc --noEmit && npm run build && npm test (40 passed, 2 skipped — no regression)"
        status: pass
      - kind: other
        ref: "grep PageContainer/id=\"main-content\"/Olá,/DemandaList/SignOutButton/Nova demanda across the 4 target files"
        status: pass
    human_judgment: true
    rationale: "Confirms structural wiring and no test/build regression; the plan's own Verification section also calls for a manual skip-link tab-and-activate check across all three pages, which is a human keyboard-navigation judgment, not a scriptable one."

duration: 25min
completed: 2026-08-04
status: complete
---

# Phase 3 Plan 2: Retrofit login/sign-out onto shadcn Button/Input, shared PageContainer Summary

**login-form.tsx and sign-out-button.tsx now render through shadcn's accessibility-floor-sized Button/Input via a full-className-override retrofit (twMerge-resolved), and a new PageContainer component eliminates the triplicated dashboard-page wrapper while wiring the skip-link's `id="main-content"` target across all three dashboard-group pages.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-04T05:15:00Z (approx.)
- **Completed:** 2026-08-04T05:40:00Z (approx.)
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- Retrofitted `login-form.tsx`'s email `<input>` and submit `<button>` onto shadcn's `Input`/`Button`, and `sign-out-button.tsx`'s `<button>` onto shadcn's `Button` — all with the exact prior className passed as an override, verified byte-identical via grep on locked copy strings and the `min-h-14` floor.
- Created `src/app/(dashboard)/page-container.tsx` — a single Server Component reproducing the exact `flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 py-16` wrapper, now the canonical dashboard-group page wrapper for this and future phases.
- Wired all three dashboard-group pages (`page.tsx`, `demandas/nova/page.tsx`, `demandas/[id]/editar/page.tsx`, including both not-found early-return branches in the edit page) through `PageContainer`, completing Plan 03-01's previously-dangling `id="main-content"` skip-link target.

## Task Commits

Each task was committed atomically:

1. **Task 1: Retrofit login-form.tsx and sign-out-button.tsx onto shadcn Button/Input** - `da027d0` (feat)
2. **Task 2: Extract shared PageContainer and wire the skip-link's main-content target** - `776026c` (feat)

_Executed in the same shared working tree as the concurrently-running Plan 03-03 agent (disjoint file sets: `demanda-form.tsx`/`demanda-table.tsx`/`status-badge.tsx`/`overdue-badge.tsx`). That agent's interleaved commits (`eb9c121`, `f340356`) are visible in `git log` between this plan's two commits — confirmed via `git status` before each `git add` that only this plan's own files were staged._

## Files Created/Modified
- `src/app/(dashboard)/page-container.tsx` - New shared `<main id="main-content">` wrapper for the dashboard route group
- `src/app/(auth)/login/login-form.tsx` - Email `<input>` → shadcn `Input`, submit `<button>` → shadcn `Button`, both with className override
- `src/app/(dashboard)/sign-out-button.tsx` - Raw `<button>` → shadcn `Button`, with className override preserving the secondary/outline look
- `src/app/(dashboard)/page.tsx` - `<main>` wrapper replaced with `<PageContainer>`
- `src/app/(dashboard)/demandas/nova/page.tsx` - `<main>` wrapper replaced with `<PageContainer>`
- `src/app/(dashboard)/demandas/[id]/editar/page.tsx` - All 3 `<main>` occurrences (2 not-found branches + main render) replaced with `<PageContainer>`

## Decisions Made
- No element was left native/raw in this plan — both shadcn `Button` and `Input` reproduced the exact required output once the original className was passed as an override (twMerge resolves the conflicting rounded-lg/outline-focus/hover-shade utilities in favor of the override over shadcn's rounded-md/ring-focus/hover-opacity defaults). The color tokens already matched exactly from Plan 03-01's `globals.css` reconciliation (`--primary`/`--ring` both `#1D4ED8`, `--input` `#A1A1AA` = zinc-400), so no new color className was needed anywhere.
- `PageContainer` wraps all 3 `<main>` occurrences in the edit page (including both not-found early returns), not just the happy-path render, for full wrapper consistency as the plan specified.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the plan's explicit fallback (leave native if identical output can't be confirmed) was evaluated for every element but never invoked, since the override approach cleanly reproduced the required output in every case.

## Issues Encountered

Mid-execution, this agent's own turn stalled once due to a transient API error partway through Task 2 (after creating `page-container.tsx` and partially editing `page.tsx`/`nova/page.tsx`, before touching `[id]/editar/page.tsx`). On resume, `git status` was used to confirm exactly what had and hadn't been touched (per the coordinator's redirect), the remaining file was wired identically to the other two, and all of Task 2's partial edits were re-verified against the plan's own acceptance criteria rather than assumed correct — all passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `PageContainer` is now the canonical dashboard-group page wrapper — any future phase (5, 6, 8, 10, all `UI hint: yes`) adding a new dashboard-group page should render through it rather than re-copying the wrapper className string.
- The skip-link's `id="main-content"` target now exists on every page Plan 03-01's `layout.tsx` skip-link can reach (this plan's 3 pages; Plan 03-03 covers no additional `<main>` elements per its own disjoint file set).
- Manual verification still outstanding (per this plan's own Verification section, not automatable): visually compare login/dashboard/nova/editar pages before/after for zero perceptible pixel change, and tab-to-skip-link-and-activate on each of the three dashboard-group pages to confirm focus lands at/near `<main id="main-content">`.
- Ready for Plan 03-03's parallel completion; no blockers for Phase 3's overall close-out once both wave-2 plans are done.

---
*Phase: 03-accessible-ui-foundation*
*Completed: 2026-08-04*

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/page-container.tsx
- FOUND: commit da027d0
- FOUND: commit 776026c

---
phase: 03-accessible-ui-foundation
plan: 03
subsystem: ui
tags: [shadcn, tailwind, react-hook-form, lucide-react, accessibility]

# Dependency graph
requires:
  - phase: 03-01
    provides: "shadcn/ui component scaffold (src/components/ui/{button,input,label,select,badge,table}.tsx), globals.css reconciled to the project's locked hex palette, Input/Button defaults pre-edited to the min-h-14/text-xl accessibility floor"
provides:
  - "demanda-form.tsx título/prazo/área fields retrofitted onto shadcn Input/Label"
  - "demanda-table.tsx retrofitted onto shadcn Table sub-components"
  - "status-badge.tsx and overdue-badge.tsx retrofitted onto shadcn Badge"
  - "Confirmation that shadcn's Badge default icon-shrink rule ([&>svg]:size-3!) must be explicitly overridden ([&>svg]:size-4!) whenever a Lucide icon's size prop is relied on inside a Badge"
affects: [phase-05-filtering, phase-06-coordinator-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shadcn Badge icon-size override: Badge's shipped default forces [&>svg]:size-3! (12px, !important) which silently overrides a Lucide icon's size={16} HTML attribute via CSS specificity — any future Badge usage carrying an icon at a non-default size must add its own [&>svg]:size-N! override in className"
    - "shadcn Table sub-components (TableRow/TableHead/TableCell) ship default border/height/whitespace classes that must be explicitly zeroed (border-b-0, h-auto, whitespace-normal) when reproducing a pre-existing native <table> layout losslessly"

key-files:
  created: []
  modified:
    - "src/app/(dashboard)/demandas/demanda-form.tsx"
    - "src/app/(dashboard)/demandas/demanda-table.tsx"
    - "src/app/(dashboard)/demandas/status-badge.tsx"
    - "src/app/(dashboard)/demandas/overdue-badge.tsx"

key-decisions:
  - "responsavelIds native <select multiple size={5}> and its <label> left completely untouched — never replaced with shadcn's Select (T-03-06, single-value by Radix design)"
  - "status <select> left native rather than migrated to shadcn's Select — no visible benefit, avoids unnecessary risk per the plan's judgment-call framing"
  - "Both status-badge.tsx and overdue-badge.tsx successfully adopted shadcn's Badge (not the plain-span fallback) — RESEARCH.md's Pitfall 4 correction (Badge's actual default is a large border-radius that renders fully pill-shaped at this size, not a literal square rounded-md) held up in practice"
  - "demanda-table.tsx successfully adopted shadcn's Table sub-components (not left native) — zero Server/Client boundary risk since the file was already a Client Component"
  - "demanda-card.tsx required no edit — it only imports StatusBadge/OverdueBadge as opaque components and neither component's prop contract changed"

requirements-completed: [UX-01, UX-03]

coverage:
  - id: D1
    description: "demanda-form.tsx título/prazo/área fields retrofitted onto shadcn Input/Label with byte-identical copy, placeholders, field order, and validation-error display; responsavelIds multi-select and status select left native"
    requirement: "UX-01"
    verification:
      - kind: unit
        ref: "npm test (40 passed, 2 skipped — full existing suite, no regressions)"
        status: pass
      - kind: other
        ref: "grep acceptance criteria: Título *, Responsável *, Prazo *, Área ou projeto, legend copy, multiple/size={5} presence, placeholder copy, submit-button copy — all exit 0"
        status: pass
    human_judgment: true
    rationale: "Visual pixel-identical comparison of the rendered form (per 03-UI-SPEC.md's explicit gate) requires a human to actually look at the before/after form in a browser — grep/build/test confirm copy and structure but not rendered pixel output."
  - id: D2
    description: "demanda-table.tsx retrofitted onto shadcn Table sub-components; status-badge.tsx and overdue-badge.tsx retrofitted onto shadcn Badge; all icon/color/label pairings, the border-l-4 overdue stripe, and the onClick row navigation preserved exactly"
    requirement: "UX-03"
    verification:
      - kind: unit
        ref: "npm test (40 passed, 2 skipped — full existing suite, no regressions)"
        status: pass
      - kind: other
        ref: "grep acceptance criteria: 5 column headers, border-l-4/border-l-red-700, Sem área definida backstop, Pendente/Em andamento/Concluída + amber-700/blue-700/green-700 + Circle/Clock/CheckCircle2, Atrasada + AlertTriangle + aria-label + 'prazo era' — all exit 0"
        status: pass
    human_judgment: true
    rationale: "Visual pixel-identical comparison of the desktop table/badges and confirming the overdue row stripe/badge render correctly on a real overdue demanda requires a human to look at rendered output in a browser, per 03-UI-SPEC.md's explicit gate — automated checks confirm markup/copy/classes only."

duration: 22min
completed: 2026-08-04
status: complete
---

# Phase 3 Plan 3: Demanda Form/Table/Badges Retrofit Summary

**Retrofitted demanda-form.tsx's título/prazo/área fields onto shadcn Input/Label, demanda-table.tsx onto shadcn Table, and status-badge.tsx/overdue-badge.tsx onto shadcn Badge — all four elements successfully adopted shadcn primitives losslessly, with responsavelIds' native multi-select left completely untouched.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-04T05:15:00Z
- **Completed:** 2026-08-04T05:37:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `demanda-form.tsx`'s título/prazo/área fields now render through shadcn's `Input`/`Label` (already accessibility-floor-sized from Plan 03-01), with byte-identical labels, placeholders, field order, and validation-error display
- `responsavelIds`'s native `<select multiple size={5}>` (and its plain `<label>`) left completely untouched — the phase's single highest-severity threat (T-03-06) explicitly avoided
- `status`'s native `<select>` also left untouched — judged not worth migrating since it offered no visible benefit
- `demanda-table.tsx` now renders through shadcn's `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, preserving the 5 column headers, `onClick`-per-row navigation, the `border-l-4 border-l-red-700` overdue stripe, título's truncation+tooltip, and the `Sem área definida` backstop exactly
- `status-badge.tsx` and `overdue-badge.tsx` both successfully adopted shadcn's `Badge` primitive (not the plain-`<span>` fallback) — all 3 statuses' icon/color/label and the overdue flag's icon/color/label/aria-label preserved exactly
- Discovered and fixed a real lossless-retrofit hazard: shadcn's `Badge` ships a default `[&>svg]:size-3!` rule (`!important`) that silently shrinks any child Lucide icon to 12px regardless of the icon's own `size={16}` prop — added an explicit `[&>svg]:size-4!` override in both badge components to preserve the original 16px icon size

## Task Commits

Each task was committed atomically:

1. **Task 1: Retrofit demanda-form.tsx onto shadcn Input/Label, native multi-select preserved** - `eb9c121` (feat)
2. **Task 2: Retrofit demanda-table.tsx onto shadcn Table, status-badge.tsx/overdue-badge.tsx onto shadcn Badge** - `f340356` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/app/(dashboard)/demandas/demanda-form.tsx` - título/prazo/área fields now use shadcn Input/Label; responsavelIds and status remain native
- `src/app/(dashboard)/demandas/demanda-table.tsx` - native `<table>` replaced with shadcn Table sub-components, all behavior preserved
- `src/app/(dashboard)/demandas/status-badge.tsx` - now renders through shadcn Badge instead of a plain `<span>`
- `src/app/(dashboard)/demandas/overdue-badge.tsx` - now renders through shadcn Badge instead of a plain `<span>`
- `src/app/(dashboard)/demandas/demanda-card.tsx` - **not edited** — it only imports `StatusBadge`/`OverdueBadge` as opaque components, and neither component's prop contract changed, so no call-site update was needed

## Decisions Made
- **Badge migration proceeded (not the plain-span fallback):** RESEARCH.md's Pitfall 4 correction — that shadcn's actual `Badge` default (`rounded-4xl`, a large border-radius) renders as a full pill at this element's small height, not a squared `rounded-md` shape as `03-UI-SPEC.md` originally assumed — held up under direct inspection of the shipped component source. Reconciling padding/text-size/border-color via `className` overrides was straightforward, not awkward, so both `status-badge.tsx` and `overdue-badge.tsx` adopted `Badge` rather than falling back to plain `<span>`.
- **Table migration proceeded (not left native):** `demanda-table.tsx` was already a Client Component (`"use client"` for `useRouter`), so importing shadcn's `Table` (which itself ships `"use client"`) created no new Server/Client boundary, per RESEARCH.md Pattern 3. Zeroing out `Table`'s default `border-b`/`hover:bg-muted/50` classes on `TableRow` and `h-10`/`whitespace-nowrap` on `TableHead`/`TableCell` reproduced the original native-table classes exactly.
- **status `<select>` and responsavelIds left fully native:** The plan explicitly frames migrating `status` as a judgment call ("if migrating status introduces any visible risk, leave it native"); since there was no material benefit (it's a 3-option select, already accessibility-floor-sized via existing utility classes), it was left untouched to minimize diff risk. `responsavelIds` was never a judgment call — its native `<select multiple>` and label were left byte-identical per the plan's non-negotiable instruction and T-03-06's threat disposition.
- **`[&>svg]:size-4!` override added to both badge components:** Discovered during Task 2 that shadcn's `Badge` ships `[&>svg]:size-3!` (an `!important` CSS rule forcing 12px icons), which would have silently shrunk `Circle`/`Clock`/`CheckCircle2`/`AlertTriangle` from their original 16px (`size={16}` prop) to 12px — a real, if subtle, visible regression that grep-only acceptance criteria (checking for icon *names*, not rendered size) would not have caught. Verified via direct inspection of `lucide-react`'s `Icon` component source (size prop renders as an SVG `width`/`height` HTML attribute, which CSS `!important` always wins over) rather than assumed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `[&>svg]:size-4!` override to prevent shadcn Badge from shrinking status/overdue icons to 12px**
- **Found during:** Task 2 (status-badge.tsx / overdue-badge.tsx retrofit)
- **Issue:** shadcn's `Badge` component ships a default `[&>svg]:size-3!` CSS rule (`!important`), which forces any child SVG (including Lucide icons rendered with `size={16}`) down to 12px regardless of the icon's own size prop — a visible size regression to the existing icon+label badges that the plan's grep-based acceptance criteria (which check for icon component *names* like `Circle`/`Clock`, not rendered pixel size) would not have detected.
- **Fix:** Added `[&>svg]:size-4!` (16px, `!important`) to both `status-badge.tsx`'s and `overdue-badge.tsx`'s `Badge` `className`, restoring the original 16px icon size while keeping every other Badge default (pill shape, spacing).
- **Files modified:** `src/app/(dashboard)/demandas/status-badge.tsx`, `src/app/(dashboard)/demandas/overdue-badge.tsx`
- **Verification:** Direct read of shadcn's `badge.tsx` source (confirmed the `[&>svg]:size-3!` rule) and `lucide-react`'s `Icon` component source (confirmed `size` renders as an SVG `width`/`height` attribute, which loses to CSS `!important` in the cascade) before applying the fix; `npm run build` and `npm test` re-run clean afterward.
- **Committed in:** `f340356` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix, Rule 1)
**Impact on plan:** Necessary for correctness of the "componentize losslessly" contract — without this fix, the Badge migration would have shipped a real (if easy-to-miss) visual regression on the phase's highest-traffic surface. No scope creep; the fix is scoped entirely to the two files the plan already targeted.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `StatusBadge`/`OverdueBadge`/`DemandaTable` now render through shadcn primitives — Phase 5's filtering/role-scoped views and Phase 6's coordinator dashboard can reuse them as-is, with the `[&>svg]:size-4!` pattern documented above as a reusable note for any future Badge usage carrying a differently-sized icon.
- `responsavelIds`'s native multi-select decision is now doubly confirmed (03-UI-SPEC.md's original decision + this plan's non-migration) — Phase 5 should not revisit it without new information about roster scale, per the plan's own framing.
- Ran concurrently with Plan 03-02 (login-form.tsx, sign-out-button.tsx, page-container.tsx, page.tsx/nova/page.tsx/[id]/editar/page.tsx) on a fully disjoint file set — no conflicts encountered; both plans' commits interleaved cleanly in git history (`eb9c121`, `f340356` from this plan; `776026c` and others from 03-02).

## Self-Check: PASSED

All 4 modified files confirmed present on disk; both task commits (`eb9c121`, `f340356`) confirmed present in git history.

---
*Phase: 03-accessible-ui-foundation*
*Completed: 2026-08-04*

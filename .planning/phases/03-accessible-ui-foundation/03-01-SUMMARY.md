---
phase: 03-accessible-ui-foundation
plan: 01
subsystem: ui
tags: [shadcn, tailwind-v4, radix-ui, design-tokens, accessibility, wcag]

requires:
  - phase: 04-demandas-crud-overdue-tracking
    provides: locked hex palette (zinc/blue-700/red-700/green-700/amber-700), text-xl/min-h-14 accessibility floor established as plain Tailwind utility classes
provides:
  - shadcn/ui initialized (components.json, src/lib/utils.ts)
  - 6 shadcn component source files scaffolded (button, input, label, select, badge, table) in src/components/ui/
  - button.tsx and input.tsx edited so their default size variant meets the project's min-h-14/text-xl accessibility floor
  - globals.css reconciled: locked hex palette in :root, no shadcn OKLCH defaults remaining, --success/--warning custom tokens, spacing/typography @theme tokens
  - skip-to-content link in layout.tsx (WCAG 2.4.1), documents the id="main-content" convention for later plans
affects: [03-02, 03-03, 05, 06, 08, 10]

tech-stack:
  added: [shadcn (CLI, ^4.16.1), radix-ui (^1.6.7), class-variance-authority (^0.7.1), clsx (^2.1.1), tailwind-merge (^3.6.0), tw-animate-css (^1.4.0)]
  patterns:
    - "shadcn component defaults are edited at the copied-source level (button.tsx/input.tsx cva `default` size variant), not per-call-site className overrides, so every future consumer inherits the accessible size automatically"
    - "globals.css @theme tokens (--success/--warning, --spacing-*, --text-*) are additive documentation tokens; existing utility classes (gap-4, text-xl, py-16) are not rewritten to reference them"

key-files:
  created:
    - components.json
    - src/lib/utils.ts
    - src/components/ui/button.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/components/ui/select.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/table.tsx
  modified:
    - src/app/globals.css
    - src/app/layout.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "Used `npx shadcn@latest init -p vega -b radix -y` (current preset-based CLI flags: -p/--preset, -b/--base), not the deprecated --style/--base-color flags RESEARCH.md flagged as gone — confirmed live via `shadcn init --help`"
  - "Fixed two CLI-introduced regressions before committing: (1) globals.css's @theme inline block had --font-sans: var(--font-sans) self-referencing after init, corrected back to var(--font-geist-sans); (2) the CLI's 'Updating fonts' step added a new Inter font import + --font-sans variable wiring to layout.tsx, which would have silently changed the site's font from Geist Sans-only — removed the Inter import/variable, restored Geist Sans as the sole font"
  - "Left the shadcn-added @import 'shadcn/tailwind.css' and tw-animate-css imports in globals.css — both are inert utility/animation CSS not exercised by any of this phase's 6 components, consistent with RESEARCH.md Pitfall 5's low-risk-either-way guidance"

requirements-completed: [UX-01]

coverage:
  - id: D1
    description: "shadcn/ui initialized (components.json, src/lib/utils.ts) with 6 component source files scaffolded in src/components/ui/"
    requirement: "UX-01"
    verification:
      - kind: other
        ref: "test -f components.json && test -f src/lib/utils.ts && test -f src/components/ui/{button,input,label,select,badge,table}.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "button.tsx/input.tsx default size edited to min-h-14/text-xl accessibility floor"
    requirement: "UX-01"
    verification:
      - kind: other
        ref: "grep -q 'min-h-14' src/components/ui/button.tsx && grep -q 'text-xl' src/components/ui/button.tsx && grep -q 'text-xl' src/components/ui/input.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "globals.css reconciled to locked hex palette, no shadcn OKLCH defaults remaining"
    requirement: "UX-01"
    verification:
      - kind: other
        ref: "grep -q '#1D4ED8' src/app/globals.css && grep -q '#B91C1C' src/app/globals.css && ! grep -qE 'oklch' src/app/globals.css"
        status: pass
    human_judgment: false
  - id: D4
    description: "Skip-to-content link added to layout.tsx, targets #main-content, visually hidden until keyboard-focused"
    requirement: "UX-01"
    verification:
      - kind: other
        ref: "grep -q 'Pular para o conteúdo principal' src/app/layout.tsx && grep -q '#main-content' src/app/layout.tsx"
        status: pass
      - kind: unit
        ref: "npm test (full suite regression check)"
        status: pass
    human_judgment: true
    rationale: "Visual keyboard-focus reveal behavior (tab to top of page, confirm skip-link becomes visible) requires a human to actually tab through the page — no automated test asserts on this; grep confirms the copy/target exist but not the CSS reveal behaves correctly in a real browser."
  - id: D5
    description: "Zero regression to existing suite/build/lint; no already-shipped surface (login-form.tsx, demanda-*.tsx, dashboard page.tsx) touched"
    requirement: "UX-01"
    verification:
      - kind: unit
        ref: "npm test — 7 test files, 40 passed / 2 skipped (identical to pre-plan baseline)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit; npm run build; npm run lint (all clean/zero-violation)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-04
status: complete
---

# Phase 3 Plan 1: shadcn/ui Foundation Scaffold Summary

**shadcn/ui initialized via the current preset-based CLI (`vega`/`radix`), globals.css reconciled to the project's locked hex palette, Button/Input edited for the min-h-14/text-xl accessibility floor, and a WCAG 2.4.1 skip-link added — zero regression to any already-shipped surface.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-04T02:30:58Z
- **Completed:** 2026-08-04T02:35:54Z
- **Tasks:** 1 (tracer)
- **Files modified:** 12 (8 created, 4 modified)

## Accomplishments
- Initialized shadcn/ui (`components.json`, `src/lib/utils.ts`) using the current CLI's preset system (`-p vega -b radix -y`), confirming RESEARCH.md's Pitfall 1 finding live: the old `--style`/`--base-color` flags are gone, replaced by `-p/--preset` and `-b/--base`.
- Reconciled `globals.css`'s `:root` block from shadcn's stock OKLCH neutral defaults to this project's locked hex palette (`#FAFAFA`/`#171717`/`#1D4ED8`/`#B91C1C`), added `--success`/`--warning` custom tokens and the `--spacing-*`/`--text-*` documentation tokens from 03-UI-SPEC.md.
- Added exactly the 6 locked shadcn components (`button`, `input`, `label`, `select`, `badge`, `table`) — no `--all`, nothing extra.
- Edited `button.tsx`/`input.tsx`'s `cva` `default` size variant from shadcn's stock `h-9`/`text-base` to this project's `min-h-14`/`text-xl` floor, so every future call site inherits the accessible size without per-call overrides.
- Added a skip-to-content link (`Pular para o conteúdo principal`) to `layout.tsx`, `sr-only`/`focus:not-sr-only`, targeting `#main-content` (id target to be added by Plans 03-02/03-03 on each page's `<main>`).

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): shadcn init, globals.css reconciliation, component scaffold, skip-link** - `8fb827d` (feat)

**Plan metadata:** pending (final docs commit, see below)

## Files Created/Modified
- `components.json` - shadcn CLI config (style: `radix-vega`, baseColor: `neutral`, cssVariables: true)
- `src/lib/utils.ts` - `cn()` className-merge helper (clsx + tailwind-merge)
- `src/components/ui/button.tsx` - shadcn Button, default size edited to `min-h-14`/`text-xl`/`px-4 py-3`
- `src/components/ui/input.tsx` - shadcn Input, default size edited to `min-h-14`/`text-xl`/`px-4 py-3` (including the `md:` breakpoint override)
- `src/components/ui/label.tsx` - shadcn Label (Client Component, unedited)
- `src/components/ui/select.tsx` - shadcn Select (Client Component, unedited; not consumed this plan — native `<select multiple>` stays per 03-UI-SPEC.md)
- `src/components/ui/badge.tsx` - shadcn Badge (not a Client Component, unedited; `rounded-full` default per RESEARCH.md Pitfall 4)
- `src/components/ui/table.tsx` - shadcn Table (Client Component, unedited)
- `src/app/globals.css` - reconciled `@theme inline`/`:root` tokens to this project's locked hex palette; fixed CLI-introduced `--font-sans` self-reference bug
- `src/app/layout.tsx` - skip-link added; reverted CLI's unplanned Inter-font addition back to Geist Sans-only
- `package.json` / `package-lock.json` - added `shadcn`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`

## Decisions Made
- Ran the CLI non-interactively via `-p vega -b radix -y` rather than the fully interactive flow the plan anticipated — the CLI's flag surface supports full scripting (confirmed via `shadcn init --help`), which is lower-risk than an interactive session in this execution context and produces an identical result.
- Fixed the `--font-sans` self-reference left by `init` (a genuine CLI defect for this project's setup, not a hypothetical) by restoring `var(--font-geist-sans)`.
- Reverted the CLI's "Updating fonts" step, which added a new `Inter` font to `layout.tsx` unprompted — this would have been a visible, unplanned font regression across every already-shipped page. Removed the `Inter` import/variable, kept Geist Sans as the sole font family, consistent with 03-UI-SPEC.md's "Font: Geist Sans — already configured, no change."
- Left the `@import "shadcn/tailwind.css"` and `tw-animate-css` imports in place — both are inert CSS (animation keyframes/utility classes) not used by any of the 6 scoped components; removing them offered no benefit and matches RESEARCH.md Pitfall 5's "either choice is low-risk" framing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed shadcn init's self-referencing `--font-sans` CSS variable**
- **Found during:** Task 1, immediately after `shadcn init`
- **Issue:** The CLI's generated `@theme inline` block set `--font-sans: var(--font-sans)` — a circular/self-referencing custom property that would resolve to nothing, silently breaking the site's font rendering (falling back to the browser default sans-serif instead of Geist Sans).
- **Fix:** Restored `--font-sans: var(--font-geist-sans)`, referencing the actual font variable set via `next/font/google` in `layout.tsx`.
- **Files modified:** `src/app/globals.css`
- **Verification:** `npx tsc --noEmit` and `npm run build` both clean; visual font rendering unchanged (Geist Sans, as before this plan).
- **Committed in:** `8fb827d` (Task 1 commit)

**2. [Rule 1 - Bug] Reverted shadcn init's unplanned addition of a second font (Inter) to layout.tsx**
- **Found during:** Task 1, immediately after `shadcn init`
- **Issue:** The CLI's "Updating fonts" step added `import { ..., Inter } from "next/font/google"`, a new `const inter = Inter(...)` instance bound to `--font-sans`, and wired `inter.variable`/`font-sans` into the `<html>` className — none of which was requested by the plan or 03-UI-SPEC.md (which explicitly states Geist Sans, no change). Left as-is, this would have silently swapped the rendered font across every already-shipped page (login, dashboard, demanda forms/list) — a direct violation of the plan's "zero regression to any already-shipped surface" requirement.
- **Fix:** Removed the `Inter` import and `inter` const, removed `inter.variable` from the `<html>` className, keeping `font-sans` mapped through `@theme inline`'s (now-fixed) `--font-sans: var(--font-geist-sans)`.
- **Files modified:** `src/app/layout.tsx`, `src/app/globals.css`
- **Verification:** `npm test` (40 passed/2 skipped, identical baseline), `npm run build` succeeds, manual diff review confirms `layout.tsx`'s only intentional changes are the skip-link and the (harmless, additive) `cn()` helper usage for the `<html>` className.
- **Committed in:** `8fb827d` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — CLI-introduced bugs/regressions caught and reverted before commit)
**Impact on plan:** Both fixes were necessary to satisfy the plan's own "zero regression to any already-shipped surface" success criterion — the CLI's default `init` behavior on this project would have otherwise introduced a real, user-visible font change. No scope creep; both fixes are strictly corrective.

## Issues Encountered
- RESEARCH.md's Assumption A3 (uncertain interactive prompt flow) turned out to be moot — the CLI supports full non-interactive scripting via `-p`/`-b`/`-y` flags, discovered live via `shadcn init --help`. This is a refinement, not a contradiction, of RESEARCH.md's findings.
- RESEARCH.md's Pattern 1 example (globals.css conflict) did not manifest as a literal "old and new blocks coexisting" append-conflict in practice — the CLI's `init` here fully replaced the `:root` block rather than appending alongside it. The reconciliation work (removing OKLCH defaults, restoring the locked hex palette) was still necessary and performed as planned; only the CLI's specific append-vs-replace mechanics differed slightly from the cited GitHub issue's exact symptom.
- Two CLI side effects not flagged anywhere in RESEARCH.md were discovered and fixed (see Deviations above): the `--font-sans` self-reference and the unplanned `Inter` font addition to `layout.tsx`. These are documented here for future phases/CLI-version awareness.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 03-02 and 03-03 can now consume the 6 scaffolded component files directly (`button`, `input`, `label`, `select`, `badge`, `table`) without re-running `shadcn init`/`add` or re-editing Button/Input's default size.
- The `id="main-content"` convention is documented in `layout.tsx`'s skip-link comment; Plans 03-02/03-03 must add this id to each page's actual `<main>` element as they touch it.
- `--success`/`--warning` custom tokens exist in `globals.css` for any future component needing a success/warning color role.
- No blockers. Full existing test suite (40 passed/2 skipped), `tsc --noEmit`, `npm run build`, and `npm run lint` are all green with zero regressions.

---
*Phase: 03-accessible-ui-foundation*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 8 created component/config files verified present on disk; commit `8fb827d` verified present in git log.

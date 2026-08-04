---
phase: 08-ai-task-extraction-review
plan: 02
subsystem: ui
tags: [nextjs, react, server-actions, useActionState, radix-select, testing-library, jsdom]

# Dependency graph
requires:
  - phase: 08-ai-task-extraction-review (plan 01)
    provides: extractDemandas Server Action (zero database writes), ExtractDemandasState.suggestions[] shape, matchResponsavel(), extraction-schema.ts
  - phase: 04-demandas-crud
    provides: createDemanda Server Action (reused unmodified), demandaSchema, demanda-form.tsx field conventions
  - phase: 05-demandas-scoping-filtering
    provides: role-scoped demanda_list header action-row pattern (isCoordenador prop threading)
  - phase: 06-coordinator-dashboard
    provides: /painel's Server Component role-gate + calm non-authorized-role state precedent
provides:
  - /demandas/extrair route (page.tsx, import-form.tsx, suggestion-review-list.tsx) — full paste -> processing -> review -> per-card confirm/reject flow
  - Entry-point link on / visible to coordenador_geral and lider_area
  - Component-test infrastructure (@testing-library/react, jsdom, tests/setup-dom.ts) — first in this repo
affects: [08-03 (Wave 3 production GEMINI_API_KEY checkpoint + real end-to-end verification)]

# Tech tracking
tech-stack:
  added: ["@testing-library/react@^16.3.2", "@testing-library/user-event@^14.6.3", "jsdom@^30.0.1"]
  patterns:
    - "Client-state screen transition on a single route (paste -> review) via useActionState's returned suggestions[], never a second route"
    - "Per-card local editable state independent of the original AI suggestion object — edits never propagate back, Confirmar always sends the CURRENT field values"
    - "Confirmar reuses the existing createDemanda Server Action unmodified, called directly from a client component (not via a <form action>) so a per-card FormData can be built and awaited individually"
    - "Rejeitar is a pure client-state status flag change with zero network/server calls"
    - "Vitest 4's per-file environment override via the `// @vitest-environment jsdom` docblock (environmentMatchGlobs was removed in v4)"
    - "Explicit afterEach(cleanup) needed for @testing-library/react since this repo's vitest.config.ts does not set globals: true"
    - "Standard Radix UI jsdom polyfills (hasPointerCapture/setPointerCapture/releasePointerCapture/scrollIntoView, ResizeObserver) in a shared tests/setup-dom.ts, guarded to no-op under the node environment"

key-files:
  created:
    - src/app/(dashboard)/demandas/extrair/page.tsx
    - src/app/(dashboard)/demandas/extrair/import-form.tsx
    - src/app/(dashboard)/demandas/extrair/suggestion-review-list.tsx
    - src/app/(dashboard)/demandas/extrair/suggestion-review-list.test.tsx
    - tests/setup-dom.ts
  modified:
    - src/app/(dashboard)/demandas/demanda-list.tsx
    - src/app/(dashboard)/page.tsx
    - vitest.config.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Installed @testing-library/react, @testing-library/user-event, jsdom as devDependencies — no component-test infra existed in this repo before this plan, and Task 2's tdd=true behavior block requires rendering/click-simulating React components (Rule 3 blocking-issue auto-fix, standard/official packages, not a package-legitimacy concern like @google/genai)."
  - "extractDemandas' empty-paste validation message ('Cole o resumo da reunião antes de continuar.') is rendered as an inline red span next to the textarea, matching demanda-form.tsx's field-error convention — distinct from the AlertCircle extraction-error block reserved for genuine Gemini/API failures, per 08-UI-SPEC.md's explicit 'not the empty-input validation message' carve-out."
  - "Vitest 4 removed environmentMatchGlobs (a v0/v1-era option) — per-file jsdom override uses the `// @vitest-environment jsdom` docblock instead, scoped only to suggestion-review-list.test.tsx; every existing *.test.ts suite keeps running under the node environment unchanged."

requirements-completed: [IA-01, IA-03, IA-04]

coverage:
  - id: D1
    description: "/demandas/extrair Server Component role-gates coordenador_geral/lider_area (Screen 1 paste form) vs. every other role (calm non-authorized-role state at the same URL, never a redirect)"
    requirement: "IA-01"
    verification:
      - kind: unit
        ref: "grep acceptance criteria — coordenador_geral/lider_area present, no redirect() call (see plan 08-02 Task 1 acceptance_criteria)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit and npm run build both clean, /demandas/extrair route present in build output"
        status: pass
    human_judgment: true
    rationale: "Visual/interactive verification of the actual paste -> Analisando... -> review/error/zero-suggestions transitions against a real or mocked Gemini response was not run in a browser this plan — plan 08-03's live verification step is the first real exercise of this flow end-to-end, per this plan's own artifacts_this_phase_produces contract."
  - id: D2
    description: "Screen 2 review list renders one editable card per suggestion (título/responsável/prazo pre-filled from extractDemandas' suggestions[]), each independently Confirmar/Rejeitar-able"
    requirement: "IA-03"
    verification:
      - kind: unit
        ref: "src/app/(dashboard)/demandas/extrair/suggestion-review-list.test.tsx#renders exactly one card per suggestion, headed 'Sugestão N de M'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Confirmar calls the EXISTING, unmodified createDemanda Server Action with the card's CURRENT (possibly human-edited) field values — never a direct insert, never the AI's original values verbatim if edited"
    requirement: "IA-04"
    verification:
      - kind: unit
        ref: "src/app/(dashboard)/demandas/extrair/suggestion-review-list.test.tsx#Confirmar calls createDemanda once with the card's CURRENT edited field values, then shows 'Criada'"
        status: pass
      - kind: unit
        ref: "grep acceptance criteria — no supabase.from('demandas').insert() call anywhere in suggestion-review-list.tsx (see plan 08-02 Task 2 acceptance_criteria)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A suggestion with responsavelId: null renders the 'não identificado' fallback and forces a manual Select pick before Confirmar enables; Rejeitar makes zero network calls and leaves other cards unaffected; a confirmed/rejected card stays visible in a dimmed resolved state"
    requirement: "IA-04"
    verification:
      - kind: unit
        ref: "src/app/(dashboard)/demandas/extrair/suggestion-review-list.test.tsx#disables Confirmar when responsável is unmatched, enables it once a responsável is picked"
        status: pass
      - kind: unit
        ref: "src/app/(dashboard)/demandas/extrair/suggestion-review-list.test.tsx#Rejeitar makes zero calls to createDemanda, shows 'Sugestão rejeitada' with a working Desfazer, and leaves other cards unaffected"
        status: pass
      - kind: unit
        ref: "src/app/(dashboard)/demandas/extrair/suggestion-review-list.test.tsx#a FAILED Confirmar leaves the card editable (not Criada) and shows the failure message"
        status: pass
    human_judgment: false
  - id: D5
    description: "Footer 'X de N revisadas' count gates 'Concluir revisão' until every suggestion is resolved (confirmed or rejected), then navigates to /"
    requirement: "IA-04"
    verification:
      - kind: unit
        ref: "src/app/(dashboard)/demandas/extrair/suggestion-review-list.test.tsx#footer count updates as cards resolve; Concluir revisão is disabled until all cards are resolved"
        status: pass
    human_judgment: false
  - id: D6
    description: "Entry-point link 'Extrair demandas de reunião' visible on / to coordenador_geral and lider_area (hidden from other roles), ordered between Painel do coordenador and Nova demanda, threaded from the existing role read with no new query"
    verification:
      - kind: unit
        ref: "grep acceptance criteria — canExtractDemandas in both page.tsx and demanda-list.tsx, both roles in the eligibility check (see plan 08-02 Task 3 acceptance_criteria)"
        status: pass
      - kind: other
        ref: "npm test (full suite, 98 passed/2 skipped) and npm run build both clean"
        status: pass
    human_judgment: false

duration: 1h
completed: 2026-08-04
status: complete
---

# Phase 8 Plan 2: Paste + Review UI Summary

**`/demandas/extrair` paste-and-review flow: Screen 1 paste form transitions in place to per-card suggestion review, Confirmar reuses the unmodified createDemanda action, Rejeitar is a pure client-state no-op, and a "não identificado" fallback blocks confirmation until a human picks a real responsável**

## Performance

- **Duration:** ~1h
- **Started:** 2026-08-04
- **Completed:** 2026-08-04
- **Tasks:** 3
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments

- `/demandas/extrair` role-gated Server Component page (`coordenador_geral`/`lider_area`), mirroring `/painel/page.tsx`'s exact non-redirecting calm access-denied state for every other role
- `import-form.tsx` — Screen 1 paste textarea + `Processar` button following `demanda-form.tsx`'s `SubmitButton`/`useFormStatus` pattern, `Analisando...` pending state with an honest "this may take a few seconds" sub-text, extraction-error state, zero-suggestions state, and the empty-paste validation message rendered as its own inline span (not the full error block)
- `suggestion-review-list.tsx` — one independently editable card per AI suggestion; Confirmar builds a `FormData` from the card's CURRENT field values and calls the existing, unmodified `createDemanda`; Rejeitar is a pure client-state change with zero network calls; the "não identificado" fallback badge + required Select structurally disables Confirmar until a human picks a real responsável; confirmed/rejected cards stay visible in a dimmed resolved state; footer `Concluir revisão` gates on every card being resolved and navigates to `/`
- Entry-point link `Extrair demandas de reunião` added to `/`'s header action row, visible to `coordenador_geral` and `lider_area`, ordered between `Painel do coordenador` and `Nova demanda`, threaded from the existing `profiles.role` read with no new query
- First component-test infrastructure in this repo: `@testing-library/react`, `@testing-library/user-event`, `jsdom` installed, a shared `tests/setup-dom.ts` with the standard Radix pointer-capture/ResizeObserver polyfills, and a 6-test behavior suite proving the per-card state machine (gating, Rejeitar/Desfazer isolation, Confirmar's exact FormData shape, failure recovery, footer progress)

## Task Commits

Each task was committed atomically:

1. **Task 1: `/demandas/extrair` page role-gate + Screen 1 paste form** - `8984a94` (feat)
2. **Task 2: Suggestion review cards — per-card Confirmar/Rejeitar** - `37b4cdc` (feat, includes the TDD behavior-test suite)
3. **Task 3: Entry-point link on / for coordenador_geral and lider_area** - `8db5300` (feat)

**Plan metadata:** (this commit, following SUMMARY/STATE/ROADMAP/REQUIREMENTS updates)

## Files Created/Modified

- `src/app/(dashboard)/demandas/extrair/page.tsx` - role-gated Server Component, fetches `profiles` for the responsável picker
- `src/app/(dashboard)/demandas/extrair/import-form.tsx` - Screen 1 paste form + all its states (idle/pending/error/zero-suggestions), transitions to `SuggestionReviewList`
- `src/app/(dashboard)/demandas/extrair/suggestion-review-list.tsx` - Screen 2 per-card review UI
- `src/app/(dashboard)/demandas/extrair/suggestion-review-list.test.tsx` - 6-test behavior suite (jsdom)
- `tests/setup-dom.ts` - Radix/jsdom polyfills, loaded via `vitest.config.ts`'s `setupFiles`
- `src/app/(dashboard)/demandas/demanda-list.tsx` - new conditional `canExtractDemandas` entry-point link
- `src/app/(dashboard)/page.tsx` - new `canExtractDemandas` boolean threaded to `DemandaList`
- `vitest.config.ts` - `.test.tsx` include glob, `setupFiles` wiring
- `package.json` / `package-lock.json` - adds `@testing-library/react`, `@testing-library/user-event`, `jsdom` as devDependencies

## Decisions Made

- **Component-test infrastructure added this plan** — see key-decisions in frontmatter. Standard, official Testing Library / jsdom packages; not a package-legitimacy concern.
- **Empty-paste validation copy rendered inline, not as the AlertCircle error block** — see key-decisions in frontmatter.
- **Vitest 4's `environmentMatchGlobs` removal handled via the `@vitest-environment jsdom` docblock** — see key-decisions in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No component-test infrastructure existed for Task 2's `tdd="true"` behavior block**
- **Found during:** Task 2, before writing the behavior test suite
- **Issue:** This repo's `vitest.config.ts` only configured a `node` environment with no DOM; `@testing-library/react`/`jsdom` were not installed. Task 2's `<behavior>` block requires rendering `SuggestionReviewList` and simulating clicks/selects, which is impossible without a DOM.
- **Fix:** Installed `@testing-library/react@16.3.2`, `@testing-library/user-event@14.6.3`, `jsdom@30.0.1` as devDependencies (standard, official packages — verified directly against the npm registry, no legitimacy concern). Added `tests/setup-dom.ts` with the standard Radix UI jsdom polyfills (`hasPointerCapture`/`setPointerCapture`/`releasePointerCapture`/`scrollIntoView`, `ResizeObserver`) needed for the shadcn `Select` component to function under jsdom, wired via `vitest.config.ts`'s `setupFiles`. Used the `// @vitest-environment jsdom` per-file docblock (Vitest 4's replacement for the removed `environmentMatchGlobs` option) to scope jsdom to only the new test file, keeping every existing `*.test.ts` suite on the faster `node` environment unchanged. Also added an explicit `afterEach(cleanup)` in the test file since this repo's `vitest.config.ts` does not set `globals: true`, so Testing Library's own auto-cleanup hook never registers.
- **Files modified:** `package.json`, `package-lock.json`, `vitest.config.ts`, `tests/setup-dom.ts` (new), `src/app/(dashboard)/demandas/extrair/suggestion-review-list.test.tsx`
- **Verification:** `npm test` — full suite green (98 passed/2 skipped, up from 08-01's baseline of 92 passed/2 skipped; the 6 new component tests account for the difference). `npx tsc --noEmit` and `npm run build` both clean.
- **Committed in:** `37b4cdc` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — test infrastructure gap, no logic/behavior change to the shipped feature)
**Impact on plan:** Necessary to satisfy the plan's own `tdd="true"` requirement for Task 2. No scope creep beyond what Task 2 already specified; the infra addition is a prerequisite, not new product surface.

## Issues Encountered

- Radix UI's `Select` component calls `Element.prototype.hasPointerCapture`/`setPointerCapture` unconditionally on open, which jsdom does not implement — surfaced as an uncaught `TypeError` during the first test run that exercised the responsável `Select`. Resolved via the polyfills in `tests/setup-dom.ts` (documented, standard workaround for this well-known Radix+jsdom gap, not a project-specific hack).
- The footer's `"{X} de {N} revisadas"` text is split across multiple JSX text-expression nodes, so `screen.getByText()`'s default single-node string match couldn't find it directly — resolved with a regex match against the paragraph's normalized `textContent`.
- Without `globals: true` in `vitest.config.ts`, `@testing-library/react`'s automatic per-test DOM cleanup never registers, causing cross-test "multiple elements found" false failures — resolved with an explicit `afterEach(cleanup)` in the test file.

## User Setup Required

None — this plan is entirely code-complete UI work with zero new environment variables or external service configuration. `GEMINI_API_KEY` (needed for the underlying `extractDemandas` call to actually reach Gemini) remains plan 08-01's/08-03's concern; this plan's automated verification (`tsc`, tests, build) does not require it to be set, and no local `.env.local` value was configured or exercised during this plan's execution.

## Next Phase Readiness

- The full paste -> extract -> review -> confirm flow is code-complete, type-checked, and unit/component-tested — plan 08-03 (Wave 3) is the first time it runs against a real Gemini API response end-to-end (per this plan's own `artifacts_this_phase_produces` contract carried forward from the plan file).
- **Known, documented scope narrowing (not silent):** the Confirmation Feedback landing banner on `/` (`"{X} demanda(s) criada(s) a partir do resumo da reunião."`) is NOT implemented — 08-UI-SPEC.md speced it but neither RESEARCH.md nor this plan committed to a mechanism (query param or session state) for passing the confirmed count across the `Concluir revisão` navigation to `/`. `Concluir revisão` navigates to `/` with no confirmation banner. This is a real, human-visible gap for plan 08-03's verification step or a future follow-up to confirm is acceptable, not quietly treated as done.
- The "Criada" post-confirm card state omits the `Ver demanda` deep link speced in 08-UI-SPEC.md, because `createDemanda`'s current `CreateDemandaState` does not return the newly created row's id — fabricating one was explicitly prohibited by the plan. A future plan could extend `CreateDemandaState` to return the id if this link is wanted.
- No blockers identified for plan 08-03.

---
*Phase: 08-ai-task-extraction-review*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 5 created files (`page.tsx`, `import-form.tsx`, `suggestion-review-list.tsx`, `suggestion-review-list.test.tsx`, `tests/setup-dom.ts`) and this SUMMARY.md were confirmed present on disk. All three task commits (`8984a94`, `37b4cdc`, `8db5300`) were confirmed present in git history via `git log --oneline`.

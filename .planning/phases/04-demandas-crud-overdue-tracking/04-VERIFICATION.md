---
phase: 04-demandas-crud-overdue-tracking
verified: 2026-08-04T01:26:52Z
status: human_needed
score: 7/7 must-haves verified (2 present-but-behavior-unverified, routed to human verification)
behavior_unverified: 2
overrides_applied: 0
human_verification:
  - test: "Sign in on https://ectodash.vercel.app, open /demandas/nova, select 2+ responsáveis, submit, and confirm the dashboard list at / shows the new demanda with all selected responsáveis' emails visible."
    expected: "The demanda appears in the list with a status badge, prazo, área (or the Sem área definida chip), and every selected responsável's email listed — the multi-responsável write actually reached demanda_responsaveis as multiple rows, not just the schema/grep proof."
    why_human: "Requires an interactive signed-in browser session (real Supabase Auth session, form fill, visual confirmation of the rendered result) that no agent in this session — planner, executor, or verifier — has been able to perform. Automated proxies (tsc, full test suite including 9 live-integration RLS cases against the real hosted project, every grep-based acceptance criterion, production HTTP smoke check) all pass, but none of them exercises the actual browser click-path end to end."
  - test: "On an existing demanda, open /demandas/[id]/editar, confirm all fields (including the true current responsável list) are pre-filled, change título/área/one responsável (add one, remove one), save, and confirm the dashboard reflects every change with the correct final responsável set. Then, from the edit screen of a still-pending demanda, tap 'Marcar como concluída' and confirm it shows as concluída on the dashboard without ever opening the Status dropdown, and confirm the button itself disappears on a subsequent visit to that now-concluded demanda."
    expected: "Edited fields persist correctly; the responsável diff is exactly add-one/remove-one (not a silent full-replace or append); the one-tap conclude action changes status to concluída and hides itself on re-visit."
    why_human: "Same interactive-session constraint as the create-flow item above. Automated proxies (tsc, full test suite, all 11 grep-based acceptance criteria for plan 04-03, code inspection of the delete-then-insert diff logic) all pass, but the actual click-path — including the pre-filled-values render and the one-tap conclude UI behavior — has not been exercised by any agent."
---

# Phase 4: Demandas CRUD & Overdue Tracking Verification Report

**Phase Goal:** Users can create, edit, and track the status of demandas (tasks), with overdue items flagged automatically without manual marking.
**Verified:** 2026-08-04T01:26:52Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a demanda with título, responsável (multi), prazo, status, and área/projeto (ROADMAP SC1 / DEM-01) | ✓ VERIFIED | `demandaSchema` (`src/app/(dashboard)/demandas/demanda-schema.ts`) enforces all 5 fields; `createDemanda` (`actions.ts`) inserts into `demandas` + batched-inserts into `demanda_responsaveis`; live integration test `DEM-01: a demanda can have multiple responsáveis` passed against the real hosted Supabase project (2 responsável rows confirmed via service-role re-read) |
| 2 | User can edit an existing demanda and mark it as concluded (ROADMAP SC2 / DEM-02) | ✓ VERIFIED | `updateDemanda`/`concludeDemanda` (`actions.ts`) exist and are wired to `/demandas/[id]/editar/page.tsx` and `conclude-button.tsx`; live tests `DEM-02: a different authenticated user can edit...` and `DEM-02: ...can conclude a demanda, and updated_at advances` both passed against the hosted project |
| 3 | A demanda whose prazo has passed is visually flagged as atrasada automatically (ROADMAP SC3 / DEM-03) | ✓ VERIFIED | `demandas_com_status` view computes `atrasada` at read time (`prazo < current_date and status <> 'concluida'`), never stored; `OverdueBadge`/`DemandaCard`/`DemandaTable` render it via icon+color+text with no client-side recomputation (grep-enforced: `isPast`/`new Date() <>` patterns absent from `overdue-badge.tsx` and `demanda-list.tsx`); live tests prove all 3 prazo/status combinations (past+pendente=true, past+concluída=false, future=false) |
| 4 | Editing responsável list correctly adds/removes, not append-only (DEM-02 sub-truth) | ✓ VERIFIED | `updateDemanda` re-queries `demanda_responsaveis` server-side, diffs against desired set, issues real `.insert()`/`.delete()` calls, skipping either when empty; live test `DEM-02: responsável swap via delete-then-insert` confirms exactly 2 final rows (1 retained, 1 swapped) after a delete+insert |
| 5 | Status and overdue state are never conveyed by color alone (DEM-03 / UI-SPEC non-color-alone rule) | ✓ VERIFIED | `status-badge.tsx` and `overdue-badge.tsx` pair icon (lucide-react) + color + always-visible pt-BR text label; grep-enforced in code (`Circle`/`Clock`/`CheckCircle2`, `AlertTriangle`, exact label strings all present); `OverdueBadge` carries `aria-label="Atrasada — prazo era {date}"` |
| 6 | Demandas list is responsive: cards below `lg`, table at `lg`+, correct sort order | ✓ VERIFIED | `demanda-list.tsx` uses CSS-only `lg:hidden`/`hidden lg:block` switch (no `useEffect`/`matchMedia`/`window.innerWidth`); single comparator sorts atrasada-first → prazo-ascending → concluída-last, reading only the server-computed `atrasada` field |
| 7 | Empty state and missing-área backstop render correctly, never blank | ✓ VERIFIED | `demanda-list.tsx` renders the exact locked empty-state copy when count is 0; `demanda-card.tsx`/`demanda-table.tsx` both render `Sem área definida` when `area` is null |
| 8 | Create flow works end-to-end in a real browser session on production (04-02 must-have) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code, RLS, and every automated proxy pass; production deploy confirmed live via HTTP smoke check (`/login` → 200). No agent has performed the actual interactive click-path. Routed to human verification below. |
| 9 | Edit + one-tap conclude flow works end-to-end in a real browser session (04-03 must-have) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Same situation as #8 — code/tests/grep all pass, but the interactive click-path (pre-filled values rendering correctly, one-tap conclude visibly updating status and self-hiding) has not been exercised. Routed to human verification below. |

**Score:** 7/7 core truths verified (present, wired, and behaviorally proven by live-integration tests or CSS/grep-enforced invariants); 2 additional must-haves (production browser click-paths) are present-but-behavior-unverified and do not block phase completion per the accepted pattern from Phase 2 plan 02-04.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0003_demandas.sql` | `demanda_status` enum, `demandas` table, `demanda_responsaveis` link table, RLS, `demandas_com_status` view | ✓ VERIFIED | All 13 plan-specified grep acceptance criteria re-run and pass; applied live (confirmed by 9 passing live-integration tests) |
| `tests/db/demandas-rls.test.ts` | Live integration proof of DEM-01/02/03 | ✓ VERIFIED | 9/9 tests passed against the real hosted Supabase project (not skipped — credentials present) when re-run during this verification |
| `src/app/(dashboard)/demandas/demanda-schema.ts` | Shared zod schema | ✓ VERIFIED | Single schema imported by both form and both Server Actions |
| `src/app/(dashboard)/demandas/actions.ts` | createDemanda/updateDemanda/concludeDemanda | ✓ VERIFIED | All 3 present, correctly derive `criado_por`/`id` server-side, never from client-controlled fields |
| `src/app/(dashboard)/demandas/demanda-form.tsx` | Shared create/edit form | ✓ VERIFIED | `mode`/`demandaId`/`defaultValues` props confirmed; one component serves both routes |
| `src/app/(dashboard)/demandas/nova/page.tsx` | Create route | ✓ VERIFIED | Exists, fetches profiles server-side, renders `DemandaForm` |
| `src/app/(dashboard)/demandas/[id]/editar/page.tsx` | Edit route | ✓ VERIFIED | Exists, Next.js 16 async `params`, fetches demanda + responsáveis + profiles, renders form + conditional `ConcludeButton` |
| `src/app/(dashboard)/demandas/conclude-button.tsx` | One-tap conclude | ✓ VERIFIED | Client Component wired to `concludeDemanda` via bound server action |
| `src/app/(dashboard)/demandas/status-badge.tsx` | 3-state status badge | ✓ VERIFIED | Icon+color+label for all 3 statuses per UI-SPEC table |
| `src/app/(dashboard)/demandas/overdue-badge.tsx` | Atrasada badge | ✓ VERIFIED | Icon+color+label+aria-label, no client-side date recomputation |
| `src/app/(dashboard)/demandas/demanda-card.tsx` | Mobile card | ✓ VERIFIED | Full 4-row layout, tap-target link, área backstop |
| `src/app/(dashboard)/demandas/demanda-table.tsx` | Desktop table | ✓ VERIFIED | 5-column table, overdue row stripe, área backstop |
| `src/app/(dashboard)/demandas/demanda-list.tsx` | Breakpoint container | ✓ VERIFIED | CSS-only switch, sort comparator, empty state, header |
| `src/app/(dashboard)/page.tsx` | Dashboard integration | ✓ VERIFIED | Reads `demandas_com_status`, renders `DemandaList`, preserves `SignOutButton` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `demanda-form.tsx` | `demanda-schema.ts` | `zodResolver(demandaSchema)` | WIRED | Client-side validation gates submission via `handleSubmit` |
| `demanda-form.tsx` | `actions.ts` (createDemanda/updateDemanda) | `useActionState` + bound action | WIRED | Confirmed both create and edit modes bind correctly |
| `actions.ts` | `public.demandas`/`public.demanda_responsaveis` | Supabase client insert/update/delete | WIRED | RLS from 04-01 is the enforced boundary; live tests confirm cross-user writes succeed as designed |
| `page.tsx`/`editar/page.tsx` | `demandas_com_status` | Server Component SELECT | WIRED | Both read the atrasada-aware view, not the bare table |
| `demanda-list.tsx` | `demanda-card.tsx` / `demanda-table.tsx` | CSS breakpoint + prop passing | WIRED | `atrasada` and `status` threaded through unchanged, never recomputed |
| `conclude-button.tsx` | `concludeDemanda` | `<form action>` closure wrapper | WIRED | Adapts typed-state return to the `(formData) => void` signature `<form action>` requires |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `page.tsx` demandas list | `demandas` | `supabase.from("demandas_com_status").select(...)` | Yes — real DB query, live-tested | ✓ FLOWING |
| `page.tsx` responsável resolution | `responsaveisPorDemanda` | second query against `demanda_responsaveis` joined to `profiles` | Yes — real DB query | ✓ FLOWING |
| `editar/page.tsx` defaultValues | `demanda`, `responsaveis`, `profiles` | 3 real DB queries (`Promise.all` + single select) | Yes | ✓ FLOWING |
| `DemandaList` sort | `atrasada` | passed through from `demandas_com_status.atrasada`, no recomputation | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Full test suite green | `npm test` | 40 passed, 2 skipped, 0 failed (7 test files) | ✓ PASS |
| Live demandas RLS integration suite (isolated re-run) | `npx vitest run tests/db/demandas-rls.test.ts` | 9/9 passed against the real hosted Supabase project | ✓ PASS |
| ESLint clean on phase 4 files | `npx eslint "src/app/(dashboard)/demandas/**/*.{ts,tsx}" "src/app/(dashboard)/page.tsx"` | 0 errors (2 legitimate `placeholder=` HTML attribute matches, not debt markers) | ✓ PASS |
| No debt-marker comments (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase files | `grep -rniE` across all phase 4 source + migration + test files | 0 matches | ✓ PASS |
| Production URL live | `curl -s -o /dev/null -w "%{http_code}" https://ectodash.vercel.app/login` and `/` | `/login` → 200, `/` → 307 (unauthenticated redirect, expected) | ✓ PASS |
| Interactive browser create-flow on production | N/A — no browser session available to any agent | not run | ? SKIP → routed to human verification |
| Interactive browser edit/conclude-flow on production | N/A — no browser session available to any agent | not run | ? SKIP → routed to human verification |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DEM-01 | 04-01, 04-02, 04-04 | Usuário cria demanda com título, responsável, prazo, status e área/projeto | ✓ SATISFIED | Schema + RLS + live tests (04-01); create form/action/route (04-02); full list rendering including multi-responsável display (04-04) |
| DEM-02 | 04-01, 04-03 | Usuário edita e conclui demanda | ✓ SATISFIED | RLS UPDATE policy + live tests (04-01); edit route, responsável diffing, one-tap conclude (04-03) |
| DEM-03 | 04-01, 04-04 | Demanda com prazo vencido é sinalizada visualmente como atrasada | ✓ SATISFIED | Read-time view + live tests for all 3 prazo/status combinations (04-01); non-color-alone badges, sort order, row stripe (04-04) |

No orphaned requirements — REQUIREMENTS.md maps exactly DEM-01/02/03 to Phase 4, and all three are marked `[x]`/`Complete` there, consistent with this verification's findings.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty stub implementations, no hardcoded empty data flowing to rendered output, and no client-side recomputation of the `atrasada` invariant anywhere in the phase's files.

### Human Verification Required

Both items below are the same class of gap already accepted for Phase 2's plan 02-04 checkpoint this session — an interactive browser session with a real signed-in user is required, and no agent (planner, executor, or this verifier) has one available. Automated proxies are exhaustively green (tsc, full test suite including 9 live-integration RLS tests against the real hosted Supabase project, every plan-specified grep acceptance criterion re-verified independently in this pass, ESLint clean, production HTTP smoke check). This is a **present-but-behaviorally-unproven** gap, not a code defect — nothing in the codebase suggests the flows would fail, but no agent has actually clicked through them.

### 1. Create-demanda flow on production

**Test:** Sign in at `https://ectodash.vercel.app`, open `/demandas/nova`, fill título/prazo, select 2+ responsáveis, submit, confirm redirect to `/` and the new demanda visible in the list with all responsáveis' emails shown.
**Expected:** The demanda appears with correct fields and every selected responsável listed — proving the multi-responsável write path works end-to-end in a real browser, not just at the schema/RLS/grep level.
**Why human:** Requires a real authenticated browser session; no CLI or test harness in this environment can drive Supabase Auth's interactive sign-in and then assert on rendered DOM output.

### 2. Edit + one-tap conclude flow on production

**Test:** Open an existing demanda's edit form at `/demandas/[id]/editar`, confirm current values (including the true responsável list) are pre-filled, change título/área/one responsável (add one, remove one), save, confirm the dashboard reflects all changes. Then tap `Marcar como concluída` from a still-pending demanda's edit screen and confirm it shows as concluída on the dashboard, and that the conclude button disappears on a subsequent visit.
**Expected:** Edits persist correctly, the responsável diff is exactly the add/remove requested (not append-only), and the one-tap conclude changes status without ever opening the Status dropdown.
**Why human:** Same interactive-session constraint as item 1.

### Gaps Summary

No code-level gaps were found. All 4 plans' artifacts exist, are substantive (not stubs), are correctly wired end-to-end, and every plan-specified acceptance criterion was independently re-verified against the current codebase state (not merely trusted from SUMMARY.md). `npx tsc --noEmit` and `npm test` were both run fresh by this verifier and are green, including 9 live-integration RLS tests against the real hosted Supabase project. The only open item is the pair of interactive browser click-path confirmations (create-flow, edit/conclude-flow) on the production URL, which — consistent with the precedent already accepted for Phase 2's plan 02-04 this session — is tracked as an open human-verification item rather than treated as a phase-blocking failure. Recommend the user perform both checks on `https://ectodash.vercel.app` at their convenience; if either surfaces a defect, it can be fixed in a follow-up commit before Phase 5 begins, since Phase 5 builds directly on this phase's schema, RLS, and component contracts.

---

*Verified: 2026-08-04T01:26:52Z*
*Verifier: Claude (gsd-verifier)*

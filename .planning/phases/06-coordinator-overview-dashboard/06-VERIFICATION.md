---
phase: 06-coordinator-overview-dashboard
verified: 2026-08-04T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "As coordenador_geral, visit /painel and confirm the 5 stat cards, área breakdown, voluntário breakdown, and overdue panel render with data matching what / shows for the same underlying rows (cross-check a known overdue demanda appears in both the overdue panel here and as flagged atrasada on /)."
    expected: "Visual layout matches 06-UI-SPEC.md's Screen Inventory exactly: stat card grid order/breakpoints, red highlight on Atrasadas only, breakdown rows sorted by count descending with Sem área definida/Sem responsável definido always last."
    why_human: "Visual rendering, real data cross-consistency between /painel and /, and stat-card grid breakpoint behavior require a live coordenador_geral browser session — no automated UI/browser test exists in this repo's suite for this page."
  - test: "As lider_area/voluntario_comum/financeiro, visit /painel directly (typed URL, not a link) and confirm the calm 'Este painel é exclusivo do coordenador' state renders at that same URL with no redirect/URL change."
    expected: "The URL bar stays at /painel; heading reads 'Este painel é exclusivo do coordenador'; no flash/redirect to /."
    why_human: "Confirming the URL literally does not change (vs. a client-side redirect that could still occur after render) requires visually observing the browser's address bar during navigation."
  - test: "Click a 'Ver demandas' link from an área row and confirm it lands on /?area=... correctly filtered, matching Phase 5's existing filter behavior exactly."
    expected: "Navigating to /?area={área} shows the same filtered subset Phase 5's own filter UI would produce for that área."
    why_human: "End-to-end navigation + filter-application correctness in a live browser session; the underlying query-param contract is code-verified (reuses demanda-filter-schema.ts) but the rendered result needs visual confirmation."
  - test: "As coordenador_geral, visit / and confirm the 'Painel do coordenador' link appears next to 'Nova demanda', is min-h-14, and navigates to a working /painel."
    expected: "Link visible, correctly sized/styled (Limpar filtros treatment), clickable, navigates to /painel."
    why_human: "Visual placement, sizing, and click-through behavior require a live browser session."
  - test: "As lider_area/voluntario_comum/financeiro, visit / and confirm the header row is unchanged from before this plan (no new link, no layout shift)."
    expected: "Header row renders byte-identical to the pre-Phase-6 layout for these roles."
    why_human: "Absence of visual regression/layout shift is a rendering concern, not something grep/tsc can confirm."
  - test: "At a narrow mobile width, confirm both 'Painel do coordenador' and 'Nova demanda' buttons stack full-width without crowding (06-UI-SPEC.md Open Decision #2's flagged visual check)."
    expected: "Both buttons stack vertically, full width, with no visual crowding or overlap at narrow viewports."
    why_human: "Responsive layout behavior at a specific breakpoint requires visual inspection in a real or emulated narrow viewport."
  - test: "For an institution with zero demandas (or a freshly seeded test project), confirm the empty-institution state renders instead of the stat grid/breakdowns."
    expected: "Heading 'Nenhuma demanda cadastrada na instituição ainda' renders, ClipboardList icon, no stat cards/breakdowns."
    why_human: "Requires a live database state with zero demandas and a coordenador_geral session to observe the render — not exercised by the current automated test suite."
---

# Phase 6: Coordinator Overview Dashboard Verification Report

**Phase Goal:** Coordenador can view, in a single dashboard, the real status of every demanda, project, and volunteer across the institution.
**Verified:** 2026-08-04
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zero new database migrations introduced this phase | ✓ VERIFIED | `supabase/migrations/` still ends at `0004_demandas_role_scope.sql`; `git status --porcelain -- supabase/migrations/` is empty; `git log -- supabase/migrations/` shows no phase-6 commit touching this directory. |
| 2 | `/painel` reads role from `profiles`, renders a same-URL access-denied state (not `redirect()`) for non-coordenador, and queries only `demandas_com_status`/`demanda_responsaveis` (no service-role client, no bypass) | ✓ VERIFIED | Read `src/app/(dashboard)/painel/page.tsx` directly: `.from("profiles").select("role")` then `if (profile?.role !== "coordenador_geral") return (<...>Este painel é exclusivo do coordenador...</>)` — no `redirect()` call anywhere (`grep -c 'redirect('` = 0). Queries are `demandas_com_status` and `demanda_responsaveis` only. `grep -ciE 'service.?role'` = 0. `grep -c 'supabase.from('` = 3 (profiles, demandas_com_status, demanda_responsaveis). |
| 3 | Volunteer-count aggregation is a single batched query grouped in-memory, not a per-volunteer query loop | ✓ VERIFIED | Read `page.tsx`'s `PainelContent`: one query `supabase.from("demanda_responsaveis").select("demanda_id, profile_id, profiles(email)")` followed by a single `for (const row of responsaveisRows ?? [])` loop building `countsByResponsavel`/`emailsByDemandaId` Maps — no Supabase call inside any loop. Total `supabase.from(` calls in the file = 3, confirming no additional per-volunteer queries. |
| 4 | `overdue-panel.tsx` reuses `DemandaTable`/`DemandaCard` directly rather than forking new rendering logic | ✓ VERIFIED | Read `src/app/(dashboard)/painel/overdue-panel.tsx`: imports `DemandaCard` from `../demandas/demanda-card` and `DemandaTable`/`DemandaTableRow` from `../demandas/demanda-table`, renders `<DemandaCard {...demanda} />` in a `lg:hidden` list and `<DemandaTable demandas={demandas} />` in a `hidden lg:block` div — identical breakpoint pattern to `demanda-list.tsx`. No new list-rendering markup. |
| 5 | Nav link in `demanda-list.tsx` only renders for `coordenador_geral` (via `isCoordenador` prop threaded from `page.tsx`) and no new Supabase query was added to `page.tsx` for this | ✓ VERIFIED | Read `demanda-list.tsx`: `{isCoordenador && (<Link href="/painel">Painel do coordenador</Link>)}`. Read `page.tsx`: `const isCoordenador = role === "coordenador_geral";` computed immediately after the existing single `.from("profiles").select("email, role")` read — `grep -c 'from("profiles")'` in `page.tsx` = 1, confirming no duplicate/new query. |
| 6 | `npx tsc --noEmit`, `npm run build`, `npm test`, `npm run lint` all pass, with `npm test` at the expected 56/2 baseline | ✓ VERIFIED | Ran all four directly: `tsc --noEmit` exits clean (no output); `npm run build` compiles successfully and lists `ƒ /painel` as a dynamic route; `npm test` → "Test Files 8 passed (8)", "Tests 56 passed \| 2 skipped (58)" — matches expected baseline exactly; `npm run lint` exits clean (no output/errors). |
| 7 | No chart library (recharts, tremor, etc.) added to `package.json` this phase | ✓ VERIFIED | `grep -iE "recharts\|tremor" package.json` returns no matches. |

**Score:** 7/7 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/ui/card.tsx` | New shadcn Card component | ✓ VERIFIED | Exists, imported and used in `painel/page.tsx` (`Card`, `CardContent`). |
| `src/app/(dashboard)/painel/page.tsx` | `/painel` Server Component: role read, access-denied/empty-institution branches, aggregate queries | ✓ VERIFIED | Exists, substantive (321 lines), wired into the route (build lists `ƒ /painel`). |
| `src/app/(dashboard)/painel/area-summary.tsx` | Área breakdown, sorted, `Sem área definida` last | ✓ VERIFIED | Exists, imported by `page.tsx`, implements the exact sort rule (`Sem área definida` forced last regardless of count). |
| `src/app/(dashboard)/painel/responsavel-summary.tsx` | Volunteer breakdown, same sort rules | ✓ VERIFIED | Exists, imported by `page.tsx`, mirrors `area-summary.tsx`'s structure. |
| `src/app/(dashboard)/painel/overdue-panel.tsx` | Reuses `DemandaTable`/`DemandaCard` | ✓ VERIFIED | Exists, imports both components directly, no forked rendering. |
| `src/app/(dashboard)/page.tsx` (modified) | Threads `isCoordenador` prop, no new query | ✓ VERIFIED | Modified as claimed; `from("profiles")` count = 1. |
| `src/app/(dashboard)/demandas/demanda-list.tsx` (modified) | Renders coordenador-only link | ✓ VERIFIED | Modified as claimed; link gated by `isCoordenador &&`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Migration 0004's `has_role('coordenador_geral')` SELECT branch | `/painel`'s Supabase reads | Ordinary authenticated client against `demandas_com_status`/`demanda_responsaveis` | ✓ WIRED | Confirmed by direct code read — no service-role client, no new RLS policy, no `.rpc()` bypass. Migration file unchanged since Phase 5. |
| `demanda-list.tsx`'s `SEM_AREA_DEFINIDA` constant | `area-summary.tsx`'s fallback bucket | Literal string reuse | ✓ WIRED | Both files define `const SEM_AREA_DEFINIDA = "Sem área definida";` character-for-character identical. |
| `page.tsx`'s existing `profiles.role` read | `demanda-list.tsx`'s nav-link visibility | `isCoordenador` prop | ✓ WIRED | Traced: `role` read once → `isCoordenador = role === "coordenador_geral"` → passed as `isCoordenador={isCoordenador}` to `<DemandaList>` → consumed as `isCoordenador = false` default prop → gates the `<Link href="/painel">`. |
| Breakdown row "Ver demandas" links | `/?area=`/`/?responsavel=` | Query params reusing Phase 5's filter schema | ✓ WIRED | `area-summary.tsx`: `href={`/?area=${encodeURIComponent(row.area)}`}`; `responsavel-summary.tsx`: `href={`/?responsavel=${encodeURIComponent(row.profileId)}`}` — matches `page.tsx`'s `parseDemandaFilters`/`filters.area`/`filters.responsavel` consumption. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| COORD-01 | 06-01, 06-02 | Coordenador vê painel único com status por voluntário | ✓ SATISFIED | `/painel` renders stat grid + breakdowns; entry-point link makes it discoverable from `/`. REQUIREMENTS.md marks Complete. |
| COORD-02 | 06-01 | Painel destaca demandas atrasadas em toda a instituição | ✓ SATISFIED | Atrasadas stat card (`bg-red-100`, `AlertTriangle`, count = 1 non-neutral card as required) + dedicated `overdue-panel.tsx`. REQUIREMENTS.md marks Complete. |
| COORD-03 | 06-01 | Painel resume contagem de demandas por área e por voluntário | ✓ SATISFIED | `area-summary.tsx`/`responsavel-summary.tsx` computed from single flat read + single batched join query. REQUIREMENTS.md marks Complete. |

No orphaned requirements found for Phase 6.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|placeholder|coming soon|not yet implemented|service.?role` across `src/app/(dashboard)/painel/` returned no matches. No empty implementations, no hardcoded-empty stubs feeding rendered output.

### Behavioral / Static Checks Run

| Check | Command | Result | Status |
|---|---|---|---|
| Type check | `npx tsc --noEmit` | Clean, no output | ✓ PASS |
| Production build | `npm run build` | Compiled successfully; `/painel` listed as dynamic route (`ƒ /painel`) | ✓ PASS |
| Full test suite | `npm test` | 8 test files passed, 56 tests passed / 2 skipped (58 total) — matches expected baseline exactly | ✓ PASS |
| Lint | `npm run lint` | Clean, no output | ✓ PASS |
| Migration count | `ls supabase/migrations/` + `git status --porcelain` | 4 files (`0001`-`0004`), no new/staged migration | ✓ PASS |
| Chart library check | `grep -iE "recharts\|tremor" package.json` | No matches | ✓ PASS |
| Redirect check | `grep -c 'redirect(' painel/page.tsx` | 0 | ✓ PASS |
| Service-role check | `grep -ciE 'service.?role' painel/page.tsx` | 0 | ✓ PASS |
| Query count check | `grep -c 'supabase.from(' painel/page.tsx` | 3 | ✓ PASS |

**Note on env credentials:** No `.env.local`/`.env` file was read, extracted, or accessed by any means during this verification. All npm scripts (`build`, `test`) load their own environment configuration internally (Next.js's own `.env.local` loader, Vitest's own config) — this is the framework's established mechanism, not something the verifier accessed directly. No live-DB read requiring credentials was attempted beyond what these existing npm scripts already perform on their own.

### Human Verification Required

7 items — all pre-flagged as manual/visual checks in both plans' own `<verification>` sections and both SUMMARY.md files' `human_judgment: true` coverage entries. None of these are automatable via grep/tsc/build, and none indicate a code defect — they are visual/UX confirmations of behavior the code demonstrably implements correctly per static analysis:

1. **Coordenador `/painel` visual cross-check** — stat cards, breakdowns, and overdue panel render with data consistent with `/`'s own view of the same rows.
2. **Non-coordenador same-URL access-denied state** — confirm the URL bar literally does not change on `/painel` for a non-coordenador (code shows no `redirect()`, but the visual/URL-bar behavior needs a live browser).
3. **"Ver demandas" breakdown link navigation** — clicking through to `/?area=...` produces the correct filtered view.
4. **Coordenador sees the `/` entry-point link** — visual placement, sizing, click-through to `/painel`.
5. **Non-coordenador `/` header unchanged** — no visual regression/layout shift.
6. **Mobile narrow-width button stacking** — `Painel do coordenador` + `Nova demanda` don't crowd (06-UI-SPEC.md Open Decision #2).
7. **Empty-institution state** — requires a live DB with zero demandas to observe the render.

### Gaps Summary

No blocking gaps. All 7 derived observable truths are verified directly against the codebase (not SUMMARY claims): zero new migrations, correct RLS-only data access with no bypass/service-role client, batched (non-N+1) volunteer aggregation, direct reuse of `DemandaTable`/`DemandaCard` in the overdue panel, correctly-gated and correctly-wired nav link with no duplicate query, all four required tooling commands green at the exact expected baseline, and no chart library added. The only open items are manual browser/visual checks that both plans always intended to defer to human verification (documented in their own `<verification>` sections) — none of them represent unverified code logic, only unverified *rendering/visual* behavior that static analysis cannot observe.

---

*Verified: 2026-08-04*
*Verifier: Claude (gsd-verifier)*

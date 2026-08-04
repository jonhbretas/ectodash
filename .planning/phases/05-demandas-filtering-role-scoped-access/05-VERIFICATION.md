---
phase: 05-demandas-filtering-role-scoped-access
verified: 2026-08-04T10:30:00Z
status: human_needed
score: 12/12 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Visual/interaction click-through of the filter bar (área/projeto Select, responsável Select, agrupar-por Select) on real mobile (<640px) and desktop (≥1024px) viewports"
    expected: "Controls stack full-width vertically on mobile with the documented gap-4 spacing; render as a single horizontal row with w-56 fixed-width Selects on desktop; active-filter chips wrap correctly without causing horizontal scroll; Limpar filtros only appears when ≥1 filter is active"
    why_human: "Grep/tsc/vitest prove the exact copy strings, prop wiring, and structural branches exist, but cannot render Tailwind breakpoint CSS or verify actual visual layout/spacing at real viewport widths"
  - test: "Sign in as each of coordenador_geral / líder-de-área (0 áreas) / líder-de-área (1 área) / líder-de-área (2+ áreas) / voluntário comum against the real deployed app and confirm the role-scoped-view notice text"
    expected: "Exact notice per role per 05-UI-SPEC.md/page.tsx: voluntário comum and zero-área líder both see 'Mostrando apenas as demandas atribuídas a você.'; one-área líder sees 'Mostrando as demandas da área {X}.'; two+-área líder sees the comma-joined 'e'-terminated phrasing; coordenador sees no notice at all"
    why_human: "The live RLS test suite proves the underlying data-scoping is correct; the exact rendered notice string per live human account requires a real signed-in browser session, not just a database assertion"
  - test: "Filtering by área and/or responsável on the real running app, including combining both filters (AND), clearing filters, and grouping by área/responsável (including the 'Sem área definida' bucket)"
    expected: "List narrows correctly and matches the selected filter(s); grouped sections render sorted within each group; a demanda with multiple responsáveis appears once per responsável-group per the documented tiebreaker; clearing filters restores the full role-scoped list"
    why_human: "tsc/vitest/grep confirm the query-construction logic and structural contract exist; actual end-to-end filter-narrowing behavior against a live, populated, role-scoped account needs a human click-through per 05-02-SUMMARY.md's own coverage notes (D2/D3/D5 rationale)"
  - test: "Trigger the filtered-to-zero-results empty state (a filter that matches nothing) versus the 'no demandas at all' empty state (a role-scoped account with zero demandas) and confirm the two never appear for the wrong condition"
    expected: "FilterX icon + 'Nenhuma demanda encontrada com esses filtros' only when a filter is active AND narrows a non-empty role-scoped dataset to zero; ClipboardList icon + 'Nenhuma demanda cadastrada ainda' only when the underlying role-scoped dataset itself is empty, regardless of filter state"
    why_human: "The branching condition (filtersActive && count===0) is code-verified; the correct choice depends on the interaction with a live account's actual demanda count, which needs a human test account in each state"
  - test: "Click 'Marcar como concluída' on the real running app: confirm the native browser confirm() dialog appears, Cancel leaves the demanda unchanged, and confirming actually concludes it"
    expected: "A blocking native browser dialog reading 'Marcar esta demanda como concluída?' appears before any mutation; Cancel is a true no-op; OK calls the existing concludeDemanda Server Action exactly as before this phase"
    why_human: "window.confirm()'s actual browser-rendered blocking behavviour and its cancel-preserves-state guarantee cannot be exercised by a headless grep/tsc/vitest check — this is explicitly flagged by 05-02-SUMMARY.md's own D4 rationale"
---

# Phase 5: Demandas Filtering & Role-Scoped Access — Verification Report

**Phase Goal:** Users can quickly find relevant demandas and only see/edit what their role permits, through short, accessible forms.
**Verified:** 2026-08-04T10:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The SELECT and UPDATE policies on `public.demandas` are textually/logically identical predicates (Phase 2's SELECT-gates-UPDATE lesson) | ✓ VERIFIED | Read `supabase/migrations/0004_demandas_role_scope.sql` lines 110-136 directly — the `using` clause on "role-scoped demandas visibility" (SELECT) and both the `using`/`with check` clauses on "role-scoped demandas edit" (UPDATE) are byte-for-byte identical: `(select public.has_role('coordenador_geral')) or (area is not null and (select public.is_lider_of_area(area))) or criado_por = (select auth.uid()) or (select public.is_responsavel_for(id))`. Copy-pasted, not abstracted, per the migration's own comment (lines 104-109). |
| 2 | `demanda_responsaveis` has its own independent RLS policy, not inherited from the parent table | ✓ VERIFIED | Migration lines 145-205: Phase 4's permissive `demanda_responsaveis` policies are explicitly dropped by name, then two new policies ("role-scoped demanda_responsaveis visibility" SELECT, "role-scoped demanda_responsaveis manage" for-all) are created, each independently restating the visibility rule via its own `exists(select 1 from public.demandas d where ...)` subquery — never a reference to `demandas`' own policy object (Postgres RLS cannot do this). Live-proven by the passing test "DEM-05: demanda_responsaveis is independently scoped — a direct, non-joined query returns zero rows for a demanda the caller cannot see via demandas" (17/17 passing, see Behavioral Spot-Checks). |
| 3 | `lider_areas` exists as a genuine many-to-many join table (not a single column) — a líder can lead multiple áreas | ✓ VERIFIED | Migration lines 33-38: `create table public.lider_areas (lider_id uuid ..., area text ..., primary key (lider_id, area))` — composite primary key is the many-to-many mechanism. Zero occurrences of the superseded `area_liderada` single-column design anywhere in the migration (confirmed via grep, 0 matches). Live-proven by the passing test "DEM-05: lider_area assigned to TWO áreas simultaneously can SELECT/UPDATE demandas in either área, and is denied on a third" — a líder with 2 real `lider_areas` rows against the live hosted project. |
| 4 | `lider_areas` RLS prevents a líder from self-escalating (writing their own rows) | ✓ VERIFIED | Migration lines 219-230: `"lider can view own lider_areas rows"` grants SELECT only (`using (lider_id = (select auth.uid()))`); `"coordenador manages all lider_areas rows"` is the ONLY policy granting INSERT/UPDATE/DELETE, gated by `has_role('coordenador_geral')` — no policy anywhere grants a non-coordenador write access, including to their own row. Live-proven: ran `npx vitest run tests/db/demandas-rls.test.ts -t "self-assign"` in isolation — the test "DEM-05: a lider_area cannot self-assign a new área (self-escalation guard), but can view their own existing lider_areas rows" passes, with a service-role re-read confirming the attempted self-insert produced no row. |
| 5 | Full role-scoping matrix passes live: coordenador sees all, líder sees only assigned área(s) including 2+ áreas, voluntário comum sees only own/responsável demandas, denial cases correctly deny | ✓ VERIFIED | Ran `npx vitest run tests/db/demandas-rls.test.ts` directly against the live hosted Supabase project (not from SUMMARY claims): **17/17 passing**, twice in a row (once in the initial run, once again after the rate-limit-clear full-suite run). Covers: coordenador regression, líder-of-one-área allow+deny with a deliberate case/whitespace mismatch (` PESQUISA ` vs `Pesquisa`), líder-of-two-áreas allow+allow+deny, voluntário comum criado_por path, voluntário comum responsável path + unrelated-third-party denial, demanda_responsaveis independent scoping, demandas_com_status view/table parity, and the self-escalation guard. Every allowed and denied assertion is backed by a service-role re-read, never the acting client's own response shape, per the file's own stated observation contract. |
| 6 | `demandas_com_status` view (security_invoker=true) still correctly inherits the narrowed policy | ✓ VERIFIED | Confirmed `security_invoker = true` is genuinely present in the view's own definition (`supabase/migrations/0003_demandas.sql` line 152) — not just claimed in a comment. Migration 0004 makes no changes to the view (correct — it inherits automatically). Live-proven by the passing test "DEM-05: demandas_com_status view returns exactly the same demanda ids as a direct demandas query, for a lider_area fixture" — asserts `viewIds === tableIds === [matchDemandaId]` (the out-of-scope demanda is absent from both), run directly against the live project. |
| 7 | Filtering happens server-side via zod-validated searchParams, not client-side/wildcard ilike | ✓ VERIFIED | Read `src/app/(dashboard)/page.tsx` directly: `const filters = parseDemandaFilters(await searchParams);` (line 22) parses via `demanda-filter-schema.ts`'s zod schema before any query is built; `.ilike("area", filters.area)` (line 116) uses no wildcard characters — confirmed by direct read and by grep `'\.ilike\("area", *`?%'` returning no match. `page.tsx` never imports `useSearchParams` (confirmed by direct read — only the Promise-wrapped Server Component prop is used). `demanda-filters.tsx`'s one `useSearchParams()` usage is confirmed, by reading the file, to be display-only (controlling which Select option is visually shown), not a data-fetching read. |
| 8 | The filtered-to-zero-results empty state is distinct from the "no demandas at all" empty state | ✓ VERIFIED | Read `demanda-list.tsx` directly (lines 127-164): two fully separate, mutually exclusive render branches — `count === 0 && filtersActive` renders the `FilterX` icon + "Nenhuma demanda encontrada com esses filtros" + "Limpar filtros" CTA; `count === 0` (filtersActive false) renders the pre-existing `ClipboardList` icon + "Nenhuma demanda cadastrada ainda" + "Nova demanda" CTA, kept as separate `if`/`else if` blocks exactly as the plan required (not a shared conditional). |
| 9 | The native `<select multiple size={5}>` for `responsavelIds` in `demanda-form.tsx` was NOT touched by this phase | ✓ VERIFIED | `git log --oneline -- "demanda-form.tsx"` shows the file's last touching commit is `eb9c121` (Phase 3, `03-03`) — no Phase 5 commit (`ffbefe8`, `52e613f`, `d7d9d1c`, `0ed453f`, `e36dcaa`) appears in its history. Direct read confirms `<select id="responsavelIds" multiple size={5} ...>` (lines 125-128) is present, unscoped, querying the full `profiles` list — matching 05-UI-SPEC.md's explicit locked decision to leave this picker unscoped by área. |
| 10 | `conclude-button.tsx` has a confirmation step before marking a demanda concluída (UX-02) | ✓ VERIFIED | Direct read of `conclude-button.tsx`: `if (!window.confirm("Marcar esta demanda como concluída?")) { return; }` gates the call to `concludeDemanda(demandaId)` — the confirm happens before any mutation, matching the exact locked copy. Zero occurrences of `AlertDialog`/`@radix-ui/react-alert-dialog` (no new dependency). The actual blocking-dialog/cancel-preserves-state *runtime* behavior of `window.confirm()` cannot be exercised headlessly — routed to human verification below. |
| 11 | `docs/areas.md` exists as the CLI/SQL runbook for assigning líderes to áreas — no admin UI shipped this phase | ✓ VERIFIED | Direct read of `docs/areas.md`: coordenador-only SQL Editor runbook mirroring `docs/roles.md`'s structure/tone, explicitly states "um líder pode liderar mais de uma área ao mesmo tempo," gives concrete INSERT examples for assigning a second área to the same líder, a DELETE example, and an explicit "Por que não existe uma tela para isso ainda" section confirming no admin UI ships this phase. `git log` confirms no new admin route/page was added under `src/app/`. |
| 12 | Full automated verification suite (tsc, build, test, lint) passes at the documented baseline | ✓ VERIFIED | `npx tsc --noEmit` — exit 0, no output. `npm run build` — succeeded, `/` correctly reports as dynamic (`ƒ`) route (expected, since it reads `searchParams`). `npm test` (full suite, post-rate-limit-window) — **56 passed, 2 skipped, 0 failed**, exactly matching 05-02-SUMMARY.md's claimed baseline. `npm run lint` — exit 0, zero output. |

**Score:** 12/12 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0004_demandas_role_scope.sql` | lider_areas table + RLS, helper functions, narrowed demandas/demanda_responsaveis policies | ✓ VERIFIED | Read directly, 231 lines. Applied to the live hosted project — `npx supabase@latest migration list --linked` shows `0004` in both Local and Remote columns. |
| `tests/db/demandas-rls.test.ts` | Extended role-scoping re-verification matrix | ✓ VERIFIED | 17 test cases, all passing live (run twice: once standalone, once as part of the full suite). Every allowed/denied assertion backed by service-role re-read. |
| `docs/areas.md` | Coordenador-only área-assignment runbook | ✓ VERIFIED | Exists, 83 lines, matches `docs/roles.md`'s tone/structure, documents multi-área capability and the self-escalation warning. |
| `src/app/(dashboard)/demandas/demanda-filter-schema.ts` | zod schema validating searchParams | ✓ VERIFIED | Exists; `demandaFilterSchema` + `parseDemandaFilters` exported; empty-string-to-undefined preprocessing present; 8-case unit suite passes (`npx vitest run` confirms as part of full suite). |
| `src/app/(dashboard)/demandas/demanda-filters.tsx` | Filter bar Client Component | ✓ VERIFIED | Exists, 224 lines; renders exactly 3 controls (área, responsável, agrupar), removable chips, conditional Limpar filtros; uses shadcn Select; zero `bg-blue-700` (accent-not-for-active-filter rule respected). |
| `src/app/(dashboard)/demandas/demanda-list.tsx` (extended) | groupBy rendering + distinct empty states | ✓ VERIFIED | Extended, both empty states present as separate branches; `groupDemandas` helper groups by área or responsável; `compareDemandas` preserved and applied within each group. |
| `src/app/(dashboard)/demandas/conclude-button.tsx` (extended) | window.confirm() gate | ✓ VERIFIED | Extended with the confirm gate; `concludeDemanda` Server Action call preserved unchanged. |
| `src/app/(dashboard)/page.tsx` (extended) | searchParams wiring, filtered query, role-scoped notice | ✓ VERIFIED | Extended; reads `searchParams: Promise<...>`, computes `scopedViewNotice` for every role/área-count combination, applies filters server-side, derives options from already-scoped data. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `demandas` SELECT policy | `demandas` UPDATE policy | Textually identical `using`/`with check` predicate | ✓ WIRED | Confirmed by direct SQL read — literal string match between both policy bodies. This is the direct fix for the Phase 2 SELECT-gates-UPDATE trap and is the single highest-risk item in this phase; verified both by static read and by live test (líder/voluntário allow-and-deny paths on both SELECT and UPDATE). |
| `lider_areas` | `is_lider_of_area()` | `exists(...)` subquery inside the SECURITY DEFINER function body | ✓ WIRED | Function reads `lider_areas` joined to `profiles`, checks `role = 'lider_area'` AND case/whitespace-insensitive área match. Consumed by both the `demandas` SELECT and UPDATE policies (grep confirms ≥3 occurrences: definition + both policies). Live-proven correct including the demoted-líder-safety clause (role re-checked, not just row presence). |
| `demanda-filter-schema.ts` (`parseDemandaFilters`) | `page.tsx`'s `searchParams` parsing | Direct function call, `await searchParams` piped through `parseDemandaFilters` before any Supabase query is built | ✓ WIRED | Confirmed by direct read of `page.tsx` line 22. |
| `page.tsx`'s filtered query | `demanda-filters.tsx` / `DemandaList` | Props (`areaOptions`, `responsavelOptions`, `currentFilters`, `groupBy`, `filtersActive`) | ✓ WIRED | Confirmed by direct read — all five props threaded through exactly as the plan specifies, no gaps. |
| `conclude-button.tsx`'s `window.confirm()` gate | `concludeDemanda` Server Action | `concludeAction()` wrapper calls `concludeDemanda(demandaId)` only after confirm resolves true | ✓ WIRED | Confirmed by direct read; RLS (plan 05-01's narrowed UPDATE policy) remains the actual authorization boundary underneath, unaffected by the client-side confirm. |

### Behavioral Spot-Checks (Live Database)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full role-scoping RLS matrix passes live | `npx vitest run tests/db/demandas-rls.test.ts` | 17/17 passed, 18.58s | ✓ PASS |
| Self-escalation guard passes live in isolation | `npx vitest run tests/db/demandas-rls.test.ts -t "self-assign"` | 1/1 passed (16 skipped by filter), 1.93s | ✓ PASS |
| Existing role/profile RLS (Phase 2) unaffected by this phase's migration | `npx vitest run tests/db/role-rls.test.ts` | 9/9 passed, 2 skipped (missing `COORDINATOR_EMAIL`, pre-existing baseline), 7.58s | ✓ PASS |
| Migration 0004 genuinely applied to the live hosted project | `npx supabase@latest migration list --linked` | `{"local":"0004","remote":"0004",...}` | ✓ PASS |
| Full test suite (all 8 files) green at documented baseline | `npm test` (run after the documented Supabase Auth rate-limit window cleared) | 8 files passed, 56 tests passed, 2 skipped, 0 failed, 29.84s | ✓ PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | Exit 0, no output | ✓ PASS |
| Production build succeeds | `npm run build` | Succeeded; `/` reports dynamic (`ƒ`) route as expected | ✓ PASS |
| Lint passes clean | `npm run lint` | Exit 0, no output | ✓ PASS |

**Note on transient failures during verification:** An initial `npm test` run (immediately following two standalone live-DB test-file runs in this same verification session) hit `Request rate limit reached` on 5 tests plus 2 unrelated Phase-1 session-persistence tests. This is the exact, already-documented Supabase Auth free-tier sign-in rate limit (30 sign-ins/5min) both 05-01-SUMMARY.md and 05-02-SUMMARY.md independently encountered and disclosed. After waiting ~5.5 minutes for the window to clear (per the documented precedent) and re-running, the full suite passed cleanly at 56/56 + 2 skipped — confirming this was a scheduling artifact, not a regression, and that the SUMMARY's disclosed baseline is real and reproducible.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DEM-04 | 05-02 | Usuário filtra/agrupa demandas por área, projeto ou responsável | ✓ SATISFIED | Filter bar + server-side query modifiers + grouped rendering, all verified above. |
| DEM-05 | 05-01, 05-02 | Voluntário comum vê e edita só suas próprias demandas; líder de área vê as da sua área; coordenador vê tudo | ✓ SATISFIED | Full RLS role-scoping matrix verified live (17/17 passing), including the multi-área case and every allow/deny direction. |
| UX-02 | 05-02 | Formulários são curtos, com poucos campos por tela e confirmação clara em ações importantes | ✓ SATISFIED | Filter bar capped at 3 controls; `window.confirm()` gate on "Marcar como concluída"; existing 5-field create/edit form untouched. Runtime confirm-dialog behavior itself needs a human click-through (see Human Verification). |

No orphaned requirements found — `DEM-04`, `DEM-05`, `UX-02` are the complete requirement set ROADMAP.md maps to Phase 5, and all three appear in at least one plan's `requirements` frontmatter field.

### Anti-Patterns Found

None. Grep scan for `TODO|FIXME|XXX|TBD|HACK|PLACEHOLDER` (case-insensitive) across the migration file, the extended test file, and every phase-5-touched file under `src/app/(dashboard)` returned zero matches (the only `placeholder`-string hits were legitimate HTML `placeholder=` attributes on unrelated form inputs, not debt markers).

### Minor, Non-Blocking Observations (not gaps)

1. **Responsável filter applied in-memory, not via `.in("id", ...)` Supabase query modifier.** The plan's Task 3 action described applying the responsável filter as a second Supabase `.in()` query modifier; the shipped `page.tsx` (line 206-215) instead filters the already-fetched `demandaList` array in-memory using a `Set` of matching demanda ids. This is a literal deviation from the plan's described implementation, but it has no security or correctness impact: RLS has already scoped the underlying rows before this code runs, and the in-memory filter operates only on data the role-scoped base query already legitimately returned. Not flagged as a gap since the observable truth ("filtering happens server-side, not client-side/wildcard ilike") still holds — this is server-side, post-RLS-fetch filtering, just implemented as an array filter rather than an additional round-trip query.
2. **`demanda_responsaveis` "manage" policy's `is_responsavel_for(d.id)` allow-branch has no dedicated live test.** The migration correctly grants a mere responsável (non-criador, non-líder, non-coordenador) the ability to attach/detach `demanda_responsaveis` rows via this predicate clause, matching `demandas`' edit predicate by construction. However, no test in `demandas-rls.test.ts` specifically exercises a `responsavelClient` calling `.insert()`/`.delete()` on `demanda_responsaveis` to prove this specific allowed branch actually works (only the SELECT-independent-scoping and criador-initiated swap paths are tested). This is a coverage gap in the *allowed* direction for one predicate clause, not a security hole (worst case: a false negative where this capability silently doesn't work, never a leak) — not required by the phase's own must_haves, and not blocking.
3. **ROADMAP.md's progress table shows Phase 2 and Phase 3 as "In Progress"** despite Phase 5 depending only on Phase 4 (marked Complete). This predates Phase 5 and does not affect Phase 5's own verification — noted for completeness, not a Phase 5 gap.

### Human Verification Required

See frontmatter `human_verification` list. Summary: 5 items, all pre-existing manual-verification needs already disclosed in 05-02-SUMMARY.md's own coverage rationale (visual filter-bar layout at real viewports, role-scoped-notice text per live account, live filter/group narrowing behavior, empty-state selection under live conditions, and `window.confirm()`'s actual browser-rendered blocking/cancel behavior). None of these are automatable via `tsc`/`npm test`/`grep`/build — they require a human clicking through the real deployed app signed in as each role. All underlying data/authorization correctness these UI behaviors depend on has already been proven live via the RLS test suite above; what remains unverified is purely the rendering/interaction layer.

### Gaps Summary

No blocking gaps found. Every must-have — RLS predicate parity, `demanda_responsaveis` independent scoping, `lider_areas` many-to-many shape and self-escalation guard, the full live role-scoping matrix, `demandas_com_status` view parity, server-side zod-validated filtering, the two distinct empty states, the untouched native responsável multi-select, the conclude-confirmation gate, and the área-assignment runbook — is directly verified against the actual codebase and the live hosted Supabase project, not inferred from SUMMARY.md claims. `tsc`, `build`, `test` (56/56 + 2 skipped), and `lint` all pass clean.

Status is `human_needed` rather than `passed` solely because five UI/interaction behaviors (visual layout, live role-notice rendering, live filter narrowing, live empty-state selection, and the native confirm dialog's actual browser behavior) require a human click-through against the real running app — this is consistent with how prior phases in this project have routed genuinely non-automatable UI verification, and none of these five items cast any doubt on the RLS correctness work, which is fully live-proven above.

---

*Verified: 2026-08-04T10:30:00Z*
*Verifier: Claude (gsd-verifier)*

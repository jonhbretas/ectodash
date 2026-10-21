---
phase: quick-261021-g5r
plan: 261021-g5r
subsystem: reunioes/pautas
tags: [pautas, wizard, google-drive, votacao, rls, accessibility]
status: complete
requirements: [QUICK-g5r-WIZARD, QUICK-g5r-ANEXO-DRIVE, QUICK-g5r-VOTACAO, QUICK-g5r-UI-CARDS]
key-files:
  created:
    - supabase/migrations/20261021150000_pautas_votacao_anexo.sql
    - src/lib/pautas/regras.ts
    - src/lib/pautas/anexo.ts
    - src/lib/pautas/drive-folders.ts
    - src/app/(dashboard)/reunioes/pauta-votacao-actions.ts
    - src/app/(dashboard)/reunioes/pauta-anexo-actions.ts
    - src/app/(dashboard)/reunioes/_lib/enviar-anexo.ts
    - src/app/(dashboard)/reunioes/_components/pauta-wizard-etapas.tsx
    - src/app/(dashboard)/reunioes/_components/pauta-badges.tsx
    - src/app/(dashboard)/reunioes/_components/pauta-card.tsx
    - src/app/(dashboard)/reunioes/_components/votacao-painel.tsx
    - src/app/(dashboard)/reunioes/_components/anexo-pauta-button.tsx
    - tests/db/pautas-votacao-rls.test.ts
  modified:
    - src/lib/google/drive.ts
    - src/app/(dashboard)/reunioes/pauta-actions.ts
    - src/app/(dashboard)/reunioes/pauta-modal.tsx
    - src/app/(dashboard)/reunioes/page.tsx
    - src/app/(dashboard)/reunioes/[id]/page.tsx
    - src/app/(dashboard)/reunioes/_lib/get-reunioes-data.ts
    - src/app/(dashboard)/reunioes/_components/pautas-tab.tsx
  deleted:
    - src/app/(dashboard)/reunioes/pauta-form.tsx
commits:
  - b3bf40c fix(pautas) desambigua embed de profiles (pushed before db push)
  - 085e8fd feat(pautas) prioridade, tipo e votacao previa (migration + actions)
  - 3cef3d3 feat(pautas) pedido de pauta em etapas com anexo no Google Drive
  - b617d6c test(pautas) suite live nao quebra sem credenciais
  - 5a93b17 feat(pautas) cartoes com prioridade, anexo e painel de votacao
---

# Quick 261021-g5r: Pauta wizard, Drive attachment and prior voting

Pedir pauta is now a 6-step accessible wizard with an optional Google Drive attachment, deliberativa pautas open a prior vote that only the coordenador geral closes (result computed in SQL), and the pauta cards show prioridade, tipo, anexo and the votação panel.

## What was built

- **Embed fix first (b3bf40c):** every `profiles(...)` embed on pautas now uses `profiles!pautas_criado_por_fkey`. The FK name was confirmed live. The commit was pushed and both Vercel production deployments (ectodash, ectodash-brdn) reached Ready before `supabase db push`, so production never saw PGRST201.
- **Migration 20261021150000 (applied live):** new pautas columns, `pautas_votacao_tipo_check`, guard trigger `pautas_guard_votacao`, table `pauta_votos` (RLS, audit, updated_at), and SECURITY DEFINER RPCs `encerrar_votacao_pauta` / `reabrir_votacao_pauta` (execute revoked from public/anon).
- **Rules (pure):** `regras.ts` (`calcularResultadoVotacao` mirrors the SQL, `contarVotos`, `pautasSimilares`) and `anexo.ts` (types, 25 MB limit, mime map, `formatarTamanho`).
- **Actions:** `votarPauta`, `removerVoto`, `encerrarVotacao`, `reabrirVotacao`; `criarPauta` takes prioridade/tipo and returns `pautaId`; `buscarPautasSimilares`; `iniciarUploadAnexo`, `finalizarAnexo`, `enviarAnexoDireto`, `removerAnexo`; `excluirPauta` trashes the Drive attachment (best effort).
- **Drive:** `getDriveFileDetails`, `findOrCreateChildFolder`, `trashDriveFile`, `createResumableUploadSession`. Folders are `Pautas/<YYYY-MM-DD | Em espera>` under the central contracts folder (or `Pautas Ectolab` at root if none), found by name, with no settings writes.
- **Wizard:** `pauta-modal.tsx` plus `pauta-wizard-etapas.tsx`. It has 6 steps, "Etapa X de 6" with a progressbar, per-step validation, Enter advances, focus moves to the step heading, radio cards, drag-and-drop, review with Editar buttons, and a non-blocking similar-pautas warning. After the pauta is created, the attachment uploads with a progress bar.
- **Cards:** `PautaCard`, `PrioridadeBadge` / `TipoBadge` / `ResultadoVotacaoBadge` (icon plus text), `VotacaoPainel`, `AnexoPautaButton`, a "Prioridade / Tipo" column and drawer content in the histórico, and compact badges plus an anexo link in "Em espera". `getReunioesData` and the page share `PAUTAS_SELECT`, `mapearPautas` and `agruparVotos`.

## Verification (real results)

- `npx tsc --noEmit`: clean.
- `npx next build`: succeeded.
- `npx vitest run src`: 28 files, 201 tests passed (includes `regras.test.ts`, 9 tests, and `anexo.test.ts`, 7 tests).
- `npx eslint` on every touched or created file: clean. The full-repo lint still reports 15 errors and 14 warnings in files this plan did not touch (sidebar, feedback-alerta, escala dialogs, auth pages, etc.); they are out of scope.
- **Live RLS suite `tests/db/pautas-votacao-rls.test.ts` (PV-01..PV-06): written but SKIPPED here, 7 skipped.** This checkout has no `.env.local`, so there is no `SUPABASE_SERVICE_ROLE_KEY`. A request for the service key through the Supabase CLI was blocked by the permission classifier, and I did not work around it.
- **Substitute live proof:** I ran a rolled-back DO block through `supabase db query --linked`, impersonating `authenticated` users via `request.jwt.claims`, against the real migrated database. Nothing persisted (the block ends in a deliberate exception). Results:
  - PV-01: deliberativa insert forced to `aberta` with quorum 3 (client sent `aprovada` and 1); informativa has a null status.
  - PV-02: creator updates to votacao_status, quorum_minimo and tipo were all blocked.
  - PV-03: the upsert left one row per user; spoofed `user_id` blocked; voting on an informativa blocked.
  - PV-04: non-coordinator close and reopen blocked; coordinator close with 2 aprovar and 1 rejeitar returned `aprovada` and set `encerrada_por`; vote update after close blocked.
  - PV-05: reopen returned `aberta` with `encerrada_em` null; closing with 2 votes returned `sem_quorum`.
  - PV-06 (PostgREST embeds): not exercised through PostgREST. I only confirmed that all FK names exist (`pautas_criado_por_fkey`, `pautas_votacao_encerrada_por_fkey`, `pauta_votos_user_id_fkey`).
- **Human visual and keyboard checks not run** (need a browser session and Google credentials).

## CORS smoke check / upload path

The CORS smoke check (Task 2, Step E) was **not run**: no Google OAuth credentials (`GOOGLE_REFRESH_TOKEN`, etc.) are available in this checkout. The **active upload path is therefore the primary one: browser to Google resumable session**, with the session opened server-side using the browser's `Origin`. If the browser gets a network-level failure (status 0), files up to 2.5 MB fall back automatically to `enviarAnexoDireto` (server action), and larger files get a clear error. The chunk-relay contingency was **not built**, since it was only specified if the check proved Google sends no CORS headers.

## Deviations from Plan

1. **[Rule 3] Live tests and CORS check could not run (missing credentials)** — see above. Substituted a rolled-back SQL simulation for the DB behavior.
2. **[Rule 1] Test file collection bug:** `describe.skipIf` still runs the callback body, so `createClient(undefined)` crashed the suite when env vars are absent. Fixed by creating the admin client only when `canRun` (b617d6c). The older `feedback-rls.test.ts` has the same latent problem and was not touched.
3. **[Rule 1] `pautasSimilares` containment score:** substring containment initially scored 1.0, which flattened the ranking against exact matches. It now scores 0.9, so an exact Jaccard match ranks first.
4. **[Rule 1] eslint fixes in files I replaced or extended:** removed `autoFocus` (focus now set via a ref), removed the setState-in-effect and ref-during-render patterns from the modal, and rebuilt the histórico `Drawer` with a presentation overlay, a `role="dialog"` panel and an Escape handler (the old one failed `jsx-a11y` rules).
5. **Commit hygiene:** the deletion of dead `pauta-form.tsx` was already staged and landed in the Task 1 commit (085e8fd) instead of the Task 2 commit. No functional impact.
6. `getReunioesData()` dropped its unused `userId` parameter (it has no callers).
7. Wizard primary color uses `#1d6f8d` (darker than `#2195B9`) for AA contrast with white text on buttons and links.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. All `mitigate` items are implemented:
- T-g5r-01..04: guard trigger, RLS and RPC checks, verified in the simulation.
- T-g5r-05: `finalizarAnexo` and `enviarAnexoDireto` only call `setLinkSharing` after `getDriveFileDetails` shows the file is in the expected Pautas subfolder, and not trashed, and within 25 MB.
- T-g5r-07/08: size checks and creator-or-coordinator authorization.

## Manual steps for the user

1. Provide `.env.local` locally, then run `npx vitest run tests/db/pautas-votacao-rls.test.ts` to execute PV-01..PV-06 live. These use only disposable `@example.invalid` fixtures.
2. In production, attach a file larger than 2.5 MB (for example 10 MB) in the wizard. This is the real CORS check: if it fails with "Não foi possível enviar o arquivo", the chunk-relay contingency in the plan is needed.
3. Confirm the file lands in Drive under Pautas/<date> and opens via its link in a private window.
4. Run the wizard keyboard-only (Tab, arrows on the radio cards, Enter advances), and the voting flow with two accounts plus the coordinator (close shows "Sem quórum" with 2 votes, reopen, third vote, close shows "Aprovada previamente").

## Self-Check: PASSED

- Created files exist, and commits b3bf40c, 085e8fd, 3cef3d3, b617d6c and 5a93b17 are in `git log` and pushed to origin/master.
- The migration is applied remotely (`supabase db push` finished) and the new FKs and columns were confirmed via SQL.

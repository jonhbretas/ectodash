---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 11
current_phase_name: Contratos e Assinatura Eletrônica
status: shipped
stopped_at: Phase 11 (Contratos) shipped — migration 0042 applied, RLS tests green; awaiting human setup: ASSINAFY_API_KEY + ASSINAFY_ACCOUNT_ID env vars
last_updated: "2026-08-10T16:00:00.000Z"
last_activity: 2026-08-10
last_activity_desc: Phase 11 (Contratos) shipped — migration 0042, libs (variáveis/PDF/pastas/Assinafy), rotas /api/contratos, UI /contratos (+novo+modelos), 6 RLS + 4 unit tests green
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 26
  completed_plans: 23
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-02)

**Core value:** Coordenador consegue ver, num só lugar, o andamento real de todas as demandas/projetos da instituição — quem é responsável, qual o prazo, o que está atrasado — sem precisar cobrar manualmente ou vasculhar planilhas e grupos.
**Current focus:** Phase 11 (Contratos) shipped; awaits ASSINAFY_API_KEY/ASSAINAFY_ACCOUNT_ID for the signature flow

## Current Position

Phase: 11 (Contratos e Assinatura Eletrônica) — SHIPPED
Plan: 11-01 — executed lean (no PLAN/SUMMARY ceremony, per user's accelerate decision)
Status: Implemented + migration 0042 applied live + RLS tests green. Awaiting human: Assinafy API key/account id in .env.local + Vercel, then "Configurar webhook na Assinafy" no card de modelos.
Details: modelos padronizados com variáveis ({{aluno_nome}}, {{evento_titulo}}...), geração de PDF (pdfkit), pastas automáticas no Drive (Contratos Ectolab > Evento > Aluno), envio para assinatura (Assinafy: upload doc, signer, assignment virtual), webhook /api/contratos/webhook (dedup por id + account_id, baixa certificado e arquiva), cards com status gerado/assinando/assinado/recusado/cancelado.

Phase: 09 (Google Sheets Sync) — code shipped, AWAITING HUMAN SETUP
Plan: 09-01 — executed lean (no PLAN/SUMMARY ceremony per user decision to accelerate)
Status: Waiting on human: Google service account creation, spreadsheet share (Viewer), and GOOGLE_SERVICE_ACCOUNT_JSON/SPREADSHEET_ID env vars in Vercel + .env.local
Last activity: 2026-08-04 — Phases 9+10 code shipped; migration 0006 applied to live Supabase

Phase: 10 (Financial Dashboard) — /financeiro SHIPPED
Plan: 10-01 — executed lean (no PLAN/SUMMARY ceremony per user decision to accelerate)
Status: Implemented (role-gated UI, RLS-backed reads, empty states); final verification pending real synced data

Phase: 08 (AI Task Extraction) — 08-03 pending human OPENCODE_API_KEY checkpoint (DeepSeek V4 Flash via OpenCode API)

Progress: [█████████░] 90%

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: N/A

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 13min | 3 tasks | 25 files |
| Phase 01 P02 | 20min | 3 tasks | 5 files |
| Phase 01 P04 | 35min | 3 tasks | 6 files |
| Phase 01 P03 | 25min | 3 tasks | 2 files |
| Phase 02 P01 | 52min | 1 tasks | 2 files |
| Phase 04 P01 | 35min | 1 tasks | 2 files |
| Phase 04 P02 | 40min | 1 tasks | 8 files |
| Phase 04 P03 | 6min | 1 tasks | 4 files |
| Phase 04 P04 | 30min | 2 tasks | 6 files |
| Phase 03 P01 | 5min | 1 tasks | 12 files |
| Phase 3 P3 | 20m | 2 tasks | 4 files |
| Phase 03 P02 | 25min | 2 tasks | 6 files |
| Phase 05 P01 | 62min | 1 tasks | 4 files |
| Phase 05 P02 | 55min | 3 tasks | 7 files |
| Phase 06 P01 | 45min | 1 tasks | 5 files |
| Phase 06 P02 | 3min | 1 tasks | 2 files |
| Phase 07 P01 | 31536581s | 2 tasks | 8 files |
| Phase 07 P01 | 9min | 2 tasks | 8 files |
| Phase 07 P02 | ~50min | 1 tasks | 8 files |
| Phase 07 P03 | ~40min | 2 tasks | 2 files |
| Phase 08 P01 | 1h | 2 tasks | 9 files |
| Phase 08 P02 | 1h | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Auth+RLS foundation split into 3 phases (login, roles/RLS, accessible UI) so each ships an independently observable capability before Demandas work begins.
- Roadmap: Reminders, AI pipeline, and Finance dashboard/sync are mutually independent after Phase 4 — can be resequenced or parallelized by coordinator urgency.
- Roadmap: AI human-review gate (Phase 8) is a hard requirement, never bypassed — no demanda is auto-created from AI extraction.
- Roadmap revision (2026-08-03): System no longer generates its own meeting summary — Fireflies/tl;dv already produce it (IA-02 removed, moved to Out of Scope; IA-01 reworded to "paste ready-made summary"). Old Phase 8 (AI Meeting Summary) merged into old Phase 9, forming the new Phase 8 (AI Task Extraction & Review: paste summary + extract suggested demandas + human review gate). All phases from old 9-11 renumbered down to 8-10. Total phase count: 11 → 10.
- [Phase ?]: Kept typescript pinned at researched latest (7.0.2) rather than downgrading to satisfy lagging tooling; hand-assembled eslint.config.mjs from underlying plugins since eslint-config-next cannot load under TS 7.x (typescript-eslint/typescript-eslint#10940); enabled next.config.ts experimental.useTypeScriptCli for the same reason
- [Phase ?]: Tightened .gitignore from create-next-app default .env* to .env*.local so the tracked .env.local.example template is not itself gitignored
- [Phase ?]: Phase 1: profiles table limited to id/email/created_at; role/área/permission columns deferred to Phase 2 migration
- [Phase ?]: Phase 1: all Supabase CLI operations run via npx supabase@latest (no global install, no Docker) against the hosted project directly
- [Phase 01, 2026-08-03]: One-off unblock — created Coordenador geral's real Supabase account (jonathanbretas@gmail.com) directly via `admin.createUser({ email_confirm: true })`, bypassing the broken `inviteUserByEmail` email-dispatch path, so downstream work is not blocked while Supabase email delivery is investigated. `scripts/seed-coordinator.ts` was NOT modified — it still uses `inviteUserByEmail` for when the real invite flow needs to be re-verified. Plan 01-03 remains explicitly INCOMPLETE: Task 2's real acceptance criteria (successful invite email) and Task 3's real-inbox checkpoint are deferred pending the email-delivery fix.
- [Phase ?]: Plan 01-04: Vercel deployment (link/env/first deploy/URL-swap redeploy) was performed directly against the real Vercel account ahead of the plan's own commit sequence, at the user's request; the plan's Task 2 commit captures documentation + verification-recording only.
- [Phase ?]: Plan 01-04: SUPABASE_SERVICE_ROLE_KEY deliberately never added to Vercel Production env vars — only the local-only seed script needs it.
- [Phase ?]: Plan 01-03 closed out: deleted the temporary admin.createUser-bypass coordinator account and re-seeded via the real admin.inviteUserByEmail path, confirming public.profiles ON DELETE CASCADE works and closing the invite-only onboarding loop end-to-end.
- [Phase ?]: Supabase Auth email send-rate-limit raised (2/hour default -> 30/hour) via Dashboard -> Authentication -> Rate Limits to allow the real invite flow to succeed now that custom SMTP (Resend, ectolab.org) is configured.
- [Phase ?]: Supabase admin.inviteUserByEmail resends (exit 0) for a still-pending invite and only rejects (already registered) once the invited user has confirmed via the link -- duplicate-invite verification was resequenced accordingly.
- [Phase ?]: [Phase 02-01] Coordinator role backfill targets the earliest-created profiles row structurally (created_at asc limit 1) rather than hardcoding the coordinator's personal email — repository is public on GitHub
- [Phase ?]: [Phase 02-01] Added a coordinator-only SELECT policy alongside the planned coordinator-only UPDATE policy on public.profiles — Postgres RLS gates an UPDATE's row lookup through SELECT policies, so without it the UPDATE was silently unreachable (0 rows affected, no error), a gap not covered in phase research
- [Phase ?]: [Phase 04-01] demandas schema: multi-responsavel via demanda_responsaveis link table (no responsavel_id column), atrasada derived at read time via demandas_com_status view (security_invoker=true), RLS reproduces Phase 2's SELECT-gates-UPDATE/DELETE fix in the same migration. Fixed plan's invalid 'default (select auth.uid())' to bare 'default auth.uid()' — Postgres rejects subqueries in column DEFAULT expressions.
- [Phase ?]: [Phase 04-02] Create-demanda tracer: react-hook-form handleSubmit gates the Server Action call (not a direct action={formAction} binding) so client-side zod validation actually runs; normalized Supabase's nested-select array/object type ambiguity for the responsavel join in page.tsx.
- [Phase ?]: Wrapped concludeDemanda(id) in a local async closure before binding to <form action>, since <form action> requires (formData) => void|Promise<void> but concludeDemanda returns a typed state object
- [Phase ?]: Removed hardcoded defaultValue="pendente" DOM attribute from status select now that DemandaForm accepts defaultValues from the caller (edit mode)
- [Phase 04-04]: Responsive demandas list built with StatusBadge/OverdueBadge as the sole components rendering demanda status/overdue state (reused by later phases). Single sort comparator in DemandaList (atrasada-first, prazo-ascending, concluida-last) reads only the server-computed `atrasada` boolean — never recomputes it client-side. CSS-only lg: breakpoint switch for card/table layouts, no shadcn/ui introduced.
- [Phase ?]: [Phase 03-01] shadcn/ui initialized via current preset CLI (-p vega -b radix -y); globals.css reconciled to locked hex palette, no OKLCH defaults remain; button.tsx/input.tsx default size edited to min-h-14/text-xl floor; fixed two CLI-introduced regressions (self-referencing --font-sans var, unplanned Inter font addition to layout.tsx) before commit
- [Phase ?]: Retrofit demanda-form.tsx título/prazo/área onto shadcn Input/Label; left responsavelIds native <select multiple> and status <select> untouched
- [Phase ?]: Retrofit demanda-table.tsx onto shadcn Table sub-components and status-badge.tsx/overdue-badge.tsx onto shadcn Badge (with [&>svg]:size-4! override to counteract Badge's default icon-shrink rule) — both lossless, no plain-span fallback needed
- [Phase 03-02]: Retrofitted login-form.tsx's Input/Button and sign-out-button.tsx's Button onto shadcn primitives by passing the exact pre-existing className as an override — twMerge resolves shadcn's rounded-md/ring-based-focus/hover-opacity defaults in favor of the original rounded-lg/outline-based-focus/hover-shade treatment, so no element needed the raw-native fallback. Extracted new PageContainer component (src/app/(dashboard)/page-container.tsx) replacing the triplicated py-16 px-6 bg-zinc-50 <main> wrapper across page.tsx/nova/page.tsx/[id]/editar/page.tsx, and added id="main-content" to all of them, completing Plan 03-01's skip-link target.
- [Phase ?]: [Phase 05-01] lider_areas many-to-many join table (lider_id, area composite PK) built instead of a single profiles.area_liderada column, per the locked user decision that a lider can lead multiple areas simultaneously, overriding 05-RESEARCH.md's own assumed single-column design
- [Phase ?]: [Phase 05-01] demandas SELECT and UPDATE/WITH CHECK predicates are byte-identical (copy-pasted, not abstracted) as the simplest guarantee against the SELECT-gates-UPDATE trap silently reappearing
- [Phase ?]: [Phase 05-01] Disabled vitest fileParallelism globally after the extended live-integration RLS test suites collectively exceeded Supabase Auth's free-tier 30-sign-ins-per-5-minutes rate limit when run in parallel
- [Phase ?]: [Phase 05-02] Grouping by responsável: a demanda with multiple responsáveis appears once per group (one bucket per responsável), documented since 05-UI-SPEC.md left this tiebreaker unresolved
- [Phase ?]: [Phase 05-02] Multi-área role-scoped-view notice for a líder with 2+ áreas uses best-effort natural PT-BR phrasing (comma-joined, final 'e') since no locked copy existed beyond the single-área example; a líder with zero lider_areas rows falls back to the voluntário-comum notice string rather than a broken empty interpolation
- [Phase ?]: [Phase 05-02] Extended vitest.config.ts's include glob to also cover src/**/*.test.ts, since the TDD task's colocated unit test file lived outside the previous tests/**/*.test.ts-only scope
- [Phase ?]: Phase 06-01: /painel coordinator dashboard built entirely on migration 0004's already-live RLS grant, zero new migrations; adopted 06-UI-SPEC.md's /painel route + same-URL access-denied state over 06-RESEARCH.md's /coordenador + redirect() recommendation
- [Phase ?]: [Phase 06-02] Coordenador-only 'Painel do coordenador' entry-point link added to /'s header row, threaded from page.tsx's existing profiles.role read (isCoordenador prop, no new query); reused demanda-filters.tsx's exact 'Limpar filtros' secondary/outline className. Plan's bg-blue-700 acceptance criterion expected count 1 but file already had 2 pre-existing occurrences (header + empty-state Nova demanda buttons) before this plan — documented as a plan-authoring discrepancy, not an implementation defect.
- [Phase ?]: reminder_runs and demanda_reminders_log shipped as two separate tables (not one) — a crashed-before-sending cron run has no per-reminder row to attach run-level metadata to
- [Phase ?]: resend/react-email package-legitimacy checkpoint approved by human in the orchestrating conversation (registration dates 2016/2017, resend GitHub org, 9.3M/3.3M weekly downloads — [SUS] flag was a too-new-latest-version false positive)
- [Phase ?]: reminderTipoFor() uses date-fns parseISO instead of new Date() to avoid a UTC-parsing off-by-one day-count bug discovered locally in a UTC-3 timezone
- [Phase ?]: Cron route auth failure lifecycle (LEMB-04) proven via a spied PostgrestFilterBuilder.or() rejection against the live project, not a synthetic mock — confirms reminder_runs never remains 'running' on a real mid-run crash.
- [Phase ?]: src/proxy.ts's isPublicPath() gate exempts /api/cron/* — a Vercel Cron invocation has no end-user session, so without this exemption the proxy redirected every cron request to /login before the route's own CRON_SECRET check ever ran (Rule 1 bug found via manual curl verification).
- [Phase ?]: Task 1 (Vercel Production secrets + deployed cron route verification) was already performed and approved by the human in the orchestrating conversation before Task 2 execution began — recorded as approved, not re-run
- [Phase ?]: reminder-runs-panel.tsx adds zero role check of its own — relies entirely on page.tsx's existing coordenador_geral branch plus reminder_runs' own coordenador-only RLS SELECT policy (migration 0005), matching the must_haves truth explicitly
- [Phase ?]: Verified gemini-3.1-flash-lite live against ai.google.dev/gemini-api/docs/models (2026-08-04) instead of copying CLAUDE.md's older gemini-2.5-flash-lite (announced shutdown ~Oct 2026)
- [Phase ?]: @google/genai install approved via human-verify checkpoint before Task 2 ran (package legitimacy confirmed: official googleapis/js-genai org, registered 2025-03-11, no deprecation)
- [Phase ?]: [Phase 08-02] Installed @testing-library/react, @testing-library/user-event, jsdom as devDependencies to enable Task 2's tdd=true component tests — no component-test infra existed in this repo before this plan; added tests/setup-dom.ts with standard Radix pointer-capture/ResizeObserver jsdom polyfills
- [Phase ?]: [Phase 08-02] extractDemandas' empty-paste validation message is rendered as an inline span next to the textarea (matching demanda-form.tsx's field-error convention), distinct from the AlertCircle extraction-error block reserved for genuine Gemini/API failures, per 08-UI-SPEC.md's explicit carve-out

### Pending Todos

[From .planning/todos/pending/ — ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Research flag: Phase 8 (AI extraction) needs prompt/schema design work for relative-date resolution — plan with extra care.
- Research flag: Phase 9 (Sheets sync) — actual spreadsheet layout unknown until inspected; start planning with a discovery step against the live sheet.
- Research flag: re-verify current Supabase pause window, Vercel cron cap, and Resend quota numbers at Phase 1/7 start (free-tier limits drift over time).
- **RESOLVED (2026-08-03):** All prior 01-03 blockers (invite-email 500 error, admin.createUser bypass, missing SUMMARY, email-rate-limit block) are now closed. Sequence: SMTP fixed via Resend + verified `ectolab.org` domain -> bypass account deleted with `public.profiles` cascade confirmed -> Auth email-send rate limit raised (2/hour -> 30/hour) by the user in Dashboard -> Authentication -> Rate Limits -> real `admin.inviteUserByEmail` invite succeeded -> `public.profiles` row confirmed -> duplicate-invite rejection confirmed (post-confirmation) -> human confirmed the invite link signs in cleanly on production with no credential screen. See `01-03-SUMMARY.md` for full detail. Plan 01-03 and Phase 1 are both complete.
- **[Voluntariado, 2026-08-04]** User decision: volunteers self-register by the magic link (`shouldCreateUser: true` — replaces D-02's invite-only mode; Supabase instance signup re-enabled via Management API `disable_signup=false`), then link their account to their name in the institutional roster at /vincular ("escolhem um usuário pelo nome do que já consta no sistema"; not finding themselves, they type name+sobrenome and a new roster entry is created).
- **[Voluntariado, 2026-08-04]** Institutional roster decoupled from auth: new `public.voluntarios` table (migrations 0016-0019) holds nome/codigo_pf/unidade/org_depto/funcao/data_inicio/data_saida/obs/area_atuacao + intended role/areas_lideradas. 90 real volunteers seeded via `npm run seed:voluntarios` (no auth accounts created). `profiles.voluntario_id` links; `vincular_pendente` flags new accounts until linked. Writes go through SECURITY DEFINER functions (never RLS write policies) so voluntariado/coordenador_area can manage data but never roles; role changes stay coordenador_geral-only.
- **[Voluntariado, 2026-08-04]** Role model updated (migration 0016): `lider_area` renamed to `coordenador_area` ("Coordenador de área") and new role `voluntariado` (full roster access). Access by área: financeiro→financial full access; voluntariado→roster full access; coordenador_area→own-área config (demandas via lider_areas + roster scoped via voluntario_manager_role). /voluntarios modernized (stat pills, busca+filtro, grouped by área, Novo voluntário); /vincular self-link flow; perfil shows linked roster data. Auth sign-up rate limit may affect test runs (run tests/db suites individually).
- **[Contratos, 2026-08-10]** Phase 11 shipped lean (user decision). Alunos: busca no WooCommerce (wp_customers) + cadastro manual na tela. Modelos: editor de texto com placeholders {{...}}. Assinatura: Assinafy (usuário optou pela Assinafy em vez do GOV.BR; API grátis 100/mês, ICP-Brasil); webhook URL = https://painel.ectolab.org/api/contratos/webhook. A API da Assinafy NÃO assina o payload (sem HMAC/secret na spec) — verificação por account_id + dedup por id do evento em contrato_webhook_log (PK); retry manual via "Sincronizar assinatura" no card. Drive: Contratos Ectolab > Evento > Aluno (1 pasta por contrato). Env novas: ASSINAFY_API_KEY, ASSINAFY_ACCOUNT_ID, ASSINAFY_API_URL (default prod, sandbox p/ teste), ASSINAFY_NOTIFICATION_EMAIL.
- **[Responsáveis por roster, 2026-08-04]** User decision: "já temos o nome no sistema, na tela de voluntários" — the ROSTER (public.voluntarios) is the source of truth for who owns a demanda; profiles only add access. Migrations 0020-0021: demanda_responsaveis and demanda_membros accept `voluntario_id` (nullable) alongside profile_id with exactly-one CHECK, identity PK + partial unique indexes, is_responsavel_for()/meu_voluntario_id() helpers and join-table SELECT policies learn the roster self-lookup. UI: demanda form/inline editor list all roster volunteers ("sem acesso" marker), server actions resolve roster ids to profile_id (linked account) or voluntario_id; dashboard filter/group and /painel normalize to roster ids/names; volunteer detail lists demandas by profile OR roster. Test suite grew DEM-06 cases (roster volunteer without account as responsável; linked volunteer sees/edits assigned demandas). Cleanup: 69 test/fictitious accounts deleted (database hygiene, not code); jonathanbretas@gmail.com backfilled to vincular_pendente=true so the existing coordinator account links via /vincular on next sign-in. Known gap (deferred): coordinator-side e-mail field on the volunteer edit screen (would need a service-role exception in src/lib/supabase/admin.ts).
- **[Infra, 2026-08-10]** Removida linha inválida `vendor_id 17` (sem `=`) do .env.local — quebrava o parser do Supabase CLI (LegacyDbConfigLoadError) em `migration list/push --linked`.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-08-04T17:12:27.214Z
Stopped at: Completed 08-02-PLAN.md
Resume file: None

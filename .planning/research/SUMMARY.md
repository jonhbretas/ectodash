# Project Research Summary

**Project:** EctoDash
**Domain:** Internal nonprofit ops tool — demand/task management, volunteer RBAC, email reminders, AI meeting-to-task extraction, and a Google-Sheets-synced financial dashboard
**Researched:** 2026-08-02
**Confidence:** MEDIUM-HIGH

## Executive Summary

EctoDash combines task/demand tracking, 4-role RBAC, automated deadline reminders, AI meeting-to-task extraction, and a Sheets-synced financial dashboard into one accessible internal tool. No single product covers this combination, so the recommendation is a custom Next.js 16 + Supabase + Vercel stack, kept deliberately simple (no Kanban ceremony, no workflow engine, no BI builder).

Architecture: single Next.js App Router monolith, Server Components for reads, Server Actions for writes, Supabase RLS as sole authorization boundary (role in a `profiles` table via a SECURITY DEFINER helper, not JWT claims), Vercel Cron for reminders and Sheets sync. Zod validates every boundary crossing.

Dominant risk: silent failure. Paused Supabase projects, exhausted Resend quotas, drifted Sheets structure, and hallucinated AI extractions all fail invisibly. Mitigation: visible status indicators (last-run logs, last-synced timestamps, human review gates) built into each feature's initial implementation, plus a cross-cutting elderly-accessible UX contract validated on every user-facing phase.

## Key Findings

### Recommended Stack
Next.js 16 + React 19 on Vercel; Supabase (Postgres+Auth+RLS). Supporting: `@supabase/ssr`, Zod (used across forms/actions/Sheets/AI boundaries), react-hook-form, resend+react-email, googleapis (service account), Gemini/OpenAI AI SDK, Recharts, shadcn/ui+Tailwind.

**Core technologies:**
- Next.js 16 + React 19 — Vercel-native, Server Actions simplify mutations
- Supabase (Postgres+Auth+RLS) — one backend for DB/auth/authorization; relational model needed for cross-project reporting
- Vercel Hobby — hosting + Cron for reminders/sync
- Zod — shared validation across 4 of 5 core features
- Resend + react-email — reminder sending, subject to free-tier caps

### Expected Features
**Must have:** Demand CRUD (title/owner/deadline/status/área), overdue flag, institutional-email login + 4-role RBAC, automated email reminders, basic financial dashboard, elderly-accessible responsive UI.
**Should have:** AI transcript-to-tasks extraction with human review, Google Sheets sync, coordinator overview dashboard (Core Value), tiered/escalating reminders, role-scoped dashboard views.
**Defer:** Direct Fireflies/tl;dv API ingestion, audio transcription pipeline, push/SMS/WhatsApp, BI report builder, granular per-field permissions, Agenda/Drive/Gescons/Eventos/Utilidades/ICNET (already out of scope per PROJECT.md).

### Architecture Approach
Monolith with Server Components/Actions, RLS as sole auth boundary, isolated Cron route handlers (`CRON_SECRET`-gated, service-role access), narrow adapters (`lib/ai`, `lib/email`, `lib/sheets`). AI pipeline is two-step: summary text, then Zod-schema structured drafts requiring human confirmation before any `demanda` is created. Dashboard always reads from `finance_snapshots`, never live Sheets.

**Major components:**
1. Auth/RBAC layer — Supabase Auth + `profiles` + `has_role()` RLS helper
2. Demandas service — CRUD via Server Actions, RLS-scoped
3. Reminder job — daily Cron, idempotent via `lembretes_log`
4. AI summarize/extract service — two-step pipeline, human-review gated
5. Finance sync service — service-account Sheets read, validated upsert into `finance_snapshots`

Build order: (1) foundation/auth/RLS → (2) demandas+RBAC views → (3) reminders, (4) AI extraction, (5) finance sync mutually independent thereafter, can parallelize.

### Critical Pitfalls
1. **Supabase auto-pause (7-day idle)** silently kills reminders/syncs — independent keep-alive heartbeat in foundation phase.
2. **Vercel Hobby cron has no retries/alerting** — every run logs success/fail/count, surfaced on dashboard.
3. **Resend quota exhaustion/policy strike** — batch reminders into daily per-person digests, show usage-vs-cap.
4. **LLM extraction fabricates owners/deadlines** — never auto-commit; review/confirm screen with source snippet, nulls over guesses.
5. **Google Sheets sync breaks silently on structural drift** — header-based parsing, validate before display, visible "last synced" timestamp.

## Implications for Roadmap

### Phase 1: Foundation — Auth, Roles, RLS, Accessible Base Layout
**Rationale:** Everything depends on auth + 4-role RBAC; retrofitting RLS later is expensive and risks exposing financial data.
**Delivers:** Next.js scaffold, Supabase + `profiles` + `has_role()` RLS, institutional-email auth, accessible base design system, Supabase keep-alive heartbeat.
**Addresses:** Login + 4 papéis (table stakes)
**Avoids:** Pitfall 1 (auto-pause), Pitfall 6 (checklist-only accessibility) — UX contract established here.

### Phase 2: Demandas CRUD + Role-Scoped Views + Coordinator Overview
**Rationale:** Core object and PROJECT.md's Core Value; reminders/AI extraction both write into this model.
**Delivers:** `areas`/`projetos`/`demandas` schema, CRUD via Server Actions, overdue flag, filters, role-scoped views.
**Uses:** react-hook-form+Zod, RLS per role, Server Components
**Implements:** Demandas service + Auth/RBAC-gated views

### Phase 3: Email Reminders
**Rationale:** Depends only on Phase 2 schema + Phase 1 auth; independent of AI/finance — can parallelize.
**Delivers:** Resend+React Email, daily Cron, `lembretes_log`, "last run" dashboard indicator, batched per-person digest.
**Addresses:** Automated email reminders
**Avoids:** Pitfall 2, Pitfall 3

### Phase 4: AI Meeting Summarization + Task Extraction
**Rationale:** Depends only on Phase 2 schema + Phase 1 auth, not Phase 3 — parallelizable.
**Delivers:** Paste-transcript UI, two-step AI pipeline, mandatory review/confirm UI with source traceability, meeting-date-anchored relative-date resolution, `reuniao_id` FK.
**Addresses:** AI transcript-to-tasks extraction
**Avoids:** Pitfall 4 — review ships same phase, not deferred.

### Phase 5: Financial Dashboard + Google Sheets Sync
**Rationale:** Independent of demandas/AI — only depends on Phase 1 — can resequence earlier if needed.
**Delivers:** `finance_snapshots` schema, service-account Sheets integration with header-based parsing/validation, sync cron with visible last-synced indicator + failure state, Recharts dashboard, Financeiro/Coordenador RLS.
**Addresses:** Financial dashboard + Sheets sync
**Avoids:** Pitfall 5

### Phase Ordering Rationale
- Auth/RBAC first: cross-cutting dependency gating demandas, coordinator dashboard, and financial data simultaneously.
- Demandas before reminders/AI: both write into the same schema.
- Reminders/AI/finance mutually independent after Phase 2 (or Phase 1 for finance) — roadmap can parallelize or resequence per coordinator urgency.
- Each of Phases 3-5 bundles its pitfall-mitigation (log, review-gate, last-synced indicator) into the same phase, not a separate hardening phase.

### Research Flags
Needs research: Phase 4 (AI prompt/schema design for relative-date resolution and provider-specific structured output), Phase 5 (actual live spreadsheet layout unknown until inspected).
Standard patterns (skip research-phase): Phase 1 (Next.js+Supabase Auth+RLS, mainstream/official), Phase 2 (standard Server Actions CRUD), Phase 3 (Vercel Cron+Resend, documented pattern).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Cross-checked official docs + web search; no Context7 MCP available, re-verify exact free-tier numbers at build time |
| Features | MEDIUM | Well-established SaaS/nonprofit patterns but no direct competitor matches this exact combination — opinionated synthesis |
| Architecture | HIGH (MEDIUM on AI-review recommendation) | Server Actions/RLS/Cron are mainstream, officially documented; AI human-review gate is sound judgment, not sourced fact |
| Pitfalls | MEDIUM | Multiple independent community sources per topic; no official-vendor primary docs for exact numeric limits |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address
- Exact current free-tier numeric limits (Supabase pause window, Vercel cron cap, Resend caps) should be re-verified against live vendor docs at Phase 1/3 start.
- Real Google Sheet layout is unknown until inspected — Phase 5 planning should begin with a discovery step against the live spreadsheet.
- AI provider choice (Gemini vs. OpenAI) is a cost/schema-enforcement tradeoff recommendation, not a hard requirement — worth a small comparative test during Phase 4 planning.
- RLS SECURITY DEFINER pattern sourced from official docs but not cross-verified against a second independent source — validate during Phase 1 implementation.

## Sources

### Primary (HIGH confidence)
- https://nextjs.org/docs, https://nextjs.org/blog/next-16 — Next.js 16 App Router/Server Actions
- https://vercel.com/docs/cron-jobs, https://vercel.com/docs/limits — Cron/Hobby limits
- https://supabase.com/docs/guides/auth/row-level-security — RLS pattern
- https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data — structured AI extraction

### Secondary (MEDIUM confidence)
- https://supabase.com/pricing — free-tier limits
- https://resend.com/pricing, https://resend.com/docs/knowledge-base/account-quotas-and-limits — email quotas
- https://developers.google.com/sheets/api/quickstart/nodejs — Sheets API pattern
- Nonprofit-CRM/PM-tool vendor pages (Boardable, Neon One, Giveffect, Galaxy Digital, VolunteerHub) — feature landscape
- Community Supabase-pause-prevention and Vercel-cron-gotcha write-ups — pitfalls corroboration

### Tertiary (LOW confidence)
- Web-search synthesis on AI pricing comparisons and elderly-UX design patterns — directionally useful, re-check before finalizing AI provider

---
*Research completed: 2026-08-02*
*Ready for roadmap: yes*

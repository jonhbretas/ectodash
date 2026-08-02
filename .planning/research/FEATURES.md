# Feature Research

**Domain:** Internal nonprofit ops tool — demand/task management + volunteer coordination + financial visibility dashboard, for a small research/experimentation nonprofit
**Researched:** 2026-08-02
**Confidence:** MEDIUM (general SaaS/nonprofit-tooling patterns are well-established and cross-referenced across multiple sources; no direct competitor matches this exact combination of features, so synthesis is opinionated)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or coordinator reverts to spreadsheets/WhatsApp.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Demand/task CRUD (title, owner, deadline, status, area/project) | This is the core object of the whole system — every PM tool (Asana, Trello, Monday, Basecamp) and every volunteer platform (VolunteerHub, Galaxy Digital) treats "task with owner + due date + status" as the atomic unit | LOW | Status should be a small fixed set (e.g. Não iniciado / Em andamento / Atrasado / Concluído) — avoid a configurable workflow engine for v1 |
| Overdue/at-risk visual flag | Coordinators scan for what's late; Basecamp and every PM tool auto-flags overdue items, and this is literally the Core Value statement in PROJECT.md ("o que está atrasado") | LOW | Just a computed field: `deadline < today && status != done` |
| Assignment to a specific person (owner) | Accountability requires a single named owner, not a group; volunteer CRMs track "who is responsible" as a first-class field | LOW | v1 needs 1 owner per demand; multi-owner is a differentiator/future item, not table stakes |
| Filtering/grouping by area, project, or responsável | Coordinator and líderes de área need to see "their" slice; standard in every PM tool via boards/views/tags | LOW-MEDIUM | Simple filter UI is enough; don't build a saved-views/custom-filter engine for v1 |
| Automated recurring email reminders for upcoming/overdue deadlines | Explicitly requested; every mature PM tool (Basecamp "auto follow-up on lapsed due dates") and volunteer platform sends automated reminder emails — this replaces the coordinator manually chasing people, which is the core pain point | MEDIUM | Needs a scheduled job (cron/Vercel Cron + Resend), idempotent send-tracking to avoid duplicate emails, and sane default cadence (see Differentiators below for tuning) |
| Login tied to institutional email | Stated constraint; also table stakes for any internal tool holding financial data — prevents random signups | LOW-MEDIUM | Supabase Auth with email allowlist/domain restriction or magic-link is sufficient; no need for SSO/SAML |
| Role-based access (at least "can see everything" vs "can see own area" vs "financial data") | Nonprofit systems commonly gate by job function (Coordinator/Admin/Staff/Limited-Access pattern is standard in nonprofit CRMs); financial data sensitivity alone makes this non-negotiable | MEDIUM | 4 roles already decided (Coordenador, Líder de área, Voluntário, Financeiro) — map each role to a fixed permission set, not a granular permission-builder |
| Basic financial dashboard: entradas, saídas, resultado do mês, caixa atual | Standard nonprofit financial dashboard content (Sage, Databox, Funraise all cite these as the baseline KPIs); this is literally the requested feature | MEDIUM | Use a simple bar/area chart pattern (monthly bars for entradas/saídas, single number for caixa atual) — don't build a general BI/report-builder |
| Mobile-responsive, low-friction UI | Explicit constraint: audience includes elderly volunteers; every volunteer-management vendor calls out simplicity/mobile access as baseline | LOW-MEDIUM | Large tap targets, high contrast, short forms — this is a design constraint more than a "feature" but must be treated as table stakes, not polish |

### Differentiators (Competitive Advantage)

Features that set the product apart from "just use Asana/Trello + a Google Sheet". Not required for the app to function, but this is where EctoDash beats the generic-tool status quo the coordinator is fighting today.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI transcript-to-tasks extraction (paste meeting text → structured demand suggestions) | No mainstream PM tool does this out of the box; generic tools require manual re-typing of action items after every meeting. Structured extraction pattern (task + owner + deadline fields, not freeform prose) is what makes AI summarizer tools like Fireflies/Tactiq/Teams Copilot valuable, and doing it inside the same system that tracks demands (rather than a separate export/import step) closes the loop the coordinator currently does by hand | MEDIUM-HIGH | Key design decision: extraction should propose a **draft** demand list for human review/edit before committing to the DB — never auto-create without confirmation, since names/deadlines from a transcript are often ambiguous or informal ("o pessoal do financeiro fica com isso") |
| Google Sheets financial sync (read existing cash-flow spreadsheet directly, no re-entry) | Avoids double data entry, which is the #1 reason financial dashboards get abandoned; matches the pattern of fetching a fixed-format sheet and computing dashboard aggregates from it (as done by Sheets-as-backend tools like Coupler.io) rather than forcing the org to migrate its accounting workflow | MEDIUM | Complexity comes from the spreadsheet's fixed-but-informal format — build a thin, explicit mapping/parser layer with validation and a clear error state ("linha X não reconhecida") rather than a generic sheet-import wizard |
| Coordinator overview dashboard (cross-project/cross-volunteer rollup) | This is the actual Core Value from PROJECT.md — a single screen answering "quem, o quê, prazo, o que está atrasado" across the whole org, which generic PM tools only approximate via manual custom views/filters that the coordinator has to build and maintain themselves | MEDIUM | Should combine: overdue count, per-área summary, per-volunteer active-demand count — resist the urge to make this configurable/widget-based in v1; ship one well-designed fixed layout |
| Recurring reminder tuning (tiered cadence + escalation) | Generic "send reminder before due date" is table stakes; a tiered cadence (e.g., gentle nudge X days before, firmer at due date, escalation-to-líder if overdue by N days) reduces alert fatigue while increasing actual follow-through — directly reduces the "coordenador precisa cobrar manualmente" pain named in Core Value | LOW-MEDIUM once base reminders exist | Escalation-to-líder-de-área when a volunteer's item goes overdue is a strong low-cost differentiator: it distributes the "cobrança" work instead of centralizing it on the coordinator |
| Role-scoped dashboards (each role sees a tailored view, not the same screen with hidden buttons) | Nonprofit RBAC best practice is role-scoped *views*, not just permission gates on a shared view — a Líder de área wants "my area's demands", Financeiro wants the money screen, Coordenador wants everything. Doing this well (vs. bolting visibility toggles onto one dashboard) is a real UX differentiator especially for a low-tech-literacy audience | MEDIUM | Directly serves the accessibility constraint — simpler per-role screens reduce cognitive load vs. one dense screen with role-based hide/show |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this project's scope, budget, and audience.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full audio transcription/recording pipeline (own Whisper/Otter-style integration) | "Since we're doing AI already, why not record meetings ourselves?" | Explicitly out-of-scope per PROJECT.md; adds audio storage, consent/privacy handling, and real-time transcription infra cost on a zero-budget stack — the org already has Fireflies/tl;dv producing text | v1 accepts pasted transcript text only; revisit direct API ingestion (Fireflies/tl;dv API) in fase 2 once the manual-paste flow is validated |
| Real-time/live-sync everything (websocket-driven live dashboard updates) | "Dashboards should update instantly" | Adds real-time infra complexity (websockets/polling infra, Supabase Realtime tuning) for an audience that checks the dashboard a few times a week, not a trading floor; low value vs. cost on a free-tier budget | Server-rendered/refresh-on-load or a simple "last synced at" timestamp is sufficient; add realtime later only if usage data shows people leave tabs open waiting for updates |
| Configurable/custom workflow & permission builder (let admins define arbitrary statuses, roles, approval chains) | "What if our process changes later?" | Massive scope/complexity increase for a 4-role, small-team org; generic PM tools that offer this (Monday, ClickUp) are also the ones nonprofits find bloated/hard to onboard elderly volunteers onto | Hard-code the 4 roles and fixed status set now; revisit only if a second nonprofit/tenant is onboarded and needs different rules |
| Auto-create demands from AI extraction with no human review | "Fully automate it, save the coordinator a click" | Meeting transcripts are messy — informal names, ambiguous ownership ("alguém do time"), soft deadlines ("semana que vem") — auto-committing bad data erodes trust in the whole demand list fast | Always render AI extraction as an editable draft/review screen before insertion into the live demand table |
| General-purpose BI/report builder for finance (custom charts, ad-hoc queries, drill-downs) | "Financeiro might want to slice the data differently" | Full BI tooling is a different product category and conflicts with "sync from one fixed-format spreadsheet"; over-engineering for an org whose real need is "what's our cash flow, monthly result, and current balance right now" | Ship the 3-4 standard nonprofit financial views (cash flow, monthly result, current balance, entradas/saídas breakdown); point power users back to the source spreadsheet for anything deeper |
| Push notifications / SMS / WhatsApp reminders | "Email might get ignored, let's cover every channel" | Multiplies integration cost (WhatsApp Business API is not free-tier-friendly) and login/consent complexity; institution already standardized on institutional email for login | Email via Resend only for v1; if email open rates prove insufficient, revisit a single additional channel in fase 2 with data to justify it |
| Granular per-field permission matrix (e.g., "this volunteer can edit deadline but not status") | "Maximum flexibility for who can change what" | Adds a permissions-editor UI and testing surface disproportionate to a 4-role, small-org system; nobody asked for this — it's a hypothetical future need | Permissions are attached to the 4 fixed roles, not per-field; a volunteer can edit their own demands, a líder can edit their area's, coordenador/financeiro per their scope |

## Feature Dependencies

```
Demand CRUD (title, owner, deadline, status, área)
    └──requires──> Login vinculado a e-mail institucional
                       └──requires──> Role-based access (4 papéis)

Recurring email reminders
    └──requires──> Demand CRUD (needs deadline + owner + email address)
    └──requires──> Login vinculado a e-mail institucional (owner's email)

AI transcript-to-tasks extraction
    └──requires──> Demand CRUD (extraction writes into the same demand model)
    └──enhances──> Coordinator overview dashboard (new demands appear there)

Coordinator overview dashboard
    └──requires──> Demand CRUD
    └──requires──> Role-based access (coordinator-only or coordinator+líder rollup view)

Financial dashboard (cash flow, monthly result, current balance)
    └──requires──> Google Sheets sync (fixed-format spreadsheet)
    └──requires──> Role-based access (Financeiro + Coordenador visibility; volunteers likely excluded)

Role-scoped dashboards (per-role tailored views)
    └──requires──> Role-based access
    └──enhances──> Coordinator overview dashboard AND Financial dashboard

Escalation-tiered reminders (nice-to-have)
    └──requires──> Recurring email reminders (basic cadence)
    └──requires──> Role-based access (to know who the "líder" is to escalate to)
```

### Dependency Notes

- **Recurring reminders require Demand CRUD + institutional login:** you cannot send a deadline reminder without a deadline field, an owner, and a way to resolve owner → email address — so login/auth must land before or alongside the reminder feature, not after.
- **AI transcript extraction requires Demand CRUD:** the whole value of extraction is writing into the same table the coordinator already uses — building extraction before the demand model is stable would mean re-shaping the extraction schema twice.
- **Financial dashboard requires Google Sheets sync:** the dashboard has no data source without the sync layer; these two are effectively one feature split into "ingest" and "display" halves and should be planned/built together, not as separate phases with a long gap between them.
- **Role-based access is a cross-cutting dependency**, not a standalone feature — it gates visibility on demands, the coordinator dashboard, and the financial dashboard simultaneously. It should land early (ideally phase 1) because retrofitting RBAC onto an already-built single-view app is expensive and risks exposing financial data prematurely.
- **Role-scoped dashboards enhance (don't require) the base overview/financial dashboards:** v1 can ship a single dashboard with role-based visibility toggles if time is tight, and evolve into fully separate per-role screens later — this is the safest place to cut scope if needed.
- **Escalation-tiered reminders enhance basic reminders:** ship the simple "reminder N days before + on due date" first; escalation-to-líder is a valuable but strictly additive refinement once the base send pipeline is proven reliable.

## MVP Definition

### Launch With (v1)

Minimum viable product — matches PROJECT.md's Active requirements exactly.

- [ ] Demand CRUD (título, responsável, prazo, status, área/projeto) — this is the system's core object; nothing else works without it
- [ ] Login vinculado a e-mail institucional + 4 papéis (Coordenador, Líder de área, Voluntário, Financeiro) — required before any role-sensitive feature (especially financial data) can safely ship
- [ ] Lembretes automáticos por e-mail (Resend) para prazos próximos/atrasados — directly addresses the "coordenador precisa cobrar manualmente" pain in Core Value
- [ ] Colar transcrição + resumo IA + geração automática de demandas (with human review step before commit) — the AI differentiator; ship with an edit/confirm screen, not silent auto-insert
- [ ] Dashboard financeiro (entradas, saídas, resultado do mês, caixa atual) + sync com planilha Google Sheets — the two financial requirements are one feature pair, ship together
- [ ] Painel de visão geral do coordenador (status por voluntário/projeto/área, atrasos em destaque) — this is the literal Core Value; must ship in v1

### Add After Validation (v1.x)

Features to add once core is working and the coordinator has used it for a few real weeks/cycles.

- [ ] Escalation-tiered reminders (auto-notify líder de área when a volunteer's item is overdue by N days) — trigger: coordinator reports still having to manually chase people after N reminders
- [ ] Per-role tailored dashboard layouts (distinct screens per role instead of one dashboard with visibility toggles) — trigger: users report the shared dashboard feels cluttered or shows irrelevant sections
- [ ] Bulk/quick-edit for demands (e.g., inline status change from a list, keyboard-friendly forms) — trigger: coordinator or líderes report task entry/update is too slow for the volume of demands

### Future Consideration (v2+)

Features to defer until v1 core is validated and the fase-2 backlog (already listed in PROJECT.md) is prioritized.

- [ ] Direct Fireflies/tl;dv API ingestion (skip manual paste) — defer because manual paste is low-cost to validate the AI-extraction value first; automating ingestion is pure convenience, not new capability
- [ ] Google Agenda integration, Drive/acervo, Gescons, Eventos, Utilidades screens — already explicitly deferred to fase 2 in PROJECT.md; do not pull forward
- [ ] ICNET integration — decision explicitly deferred/uncertain; do not build speculatively

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Demand CRUD (título, responsável, prazo, status, área) | HIGH | LOW | P1 |
| Login + 4-role RBAC | HIGH | MEDIUM | P1 |
| Recurring email reminders (basic cadence) | HIGH | MEDIUM | P1 |
| AI transcript-to-tasks extraction (with review step) | HIGH | MEDIUM-HIGH | P1 |
| Financial dashboard + Google Sheets sync | HIGH | MEDIUM | P1 |
| Coordinator overview dashboard | HIGH | MEDIUM | P1 |
| Escalation-tiered reminders | MEDIUM | LOW-MEDIUM | P2 |
| Per-role tailored dashboard layouts | MEDIUM | MEDIUM | P2 |
| Bulk/quick-edit demands | MEDIUM | LOW | P2 |
| Direct Fireflies/tl;dv API ingestion | LOW-MEDIUM | MEDIUM-HIGH | P3 |
| Google Agenda / Drive / Gescons / Eventos / Utilidades | MEDIUM | HIGH | P3 |
| ICNET integration | LOW (uncertain) | UNKNOWN | P3 |

**Priority key:**
- P1: Must have for launch (all six map directly to PROJECT.md's Active requirements)
- P2: Should have, add when possible (post-validation refinements)
- P3: Nice to have, future consideration (already flagged as Out of Scope / fase 2 in PROJECT.md)

## Competitor Feature Analysis

No single product covers this exact combination (task tracking + AI meeting-to-task + nonprofit financial dashboard + volunteer RBAC), so the comparison below is per-capability against the closest analogues.

| Feature | Generic PM tools (Asana/Trello/Monday/Basecamp) | Volunteer-specific CRMs (VolunteerHub/Galaxy Digital/Giveffect) | Our Approach |
|---------|--------------------------------------------------|---------------------------------------------------------------|--------------|
| Task/demand tracking with owner + deadline | Strong — boards, assignees, due dates, overdue flags | Present but secondary to volunteer scheduling/hours | Match this baseline exactly; keep it simpler (no boards/Kanban ceremony) since audience needs low-friction lists, not drag-and-drop boards |
| Automated reminders | Basic due-date reminders (Basecamp auto-follows-up) | Present, mostly event/shift reminders | Tiered cadence + escalation-to-líder as a differentiator over generic "one reminder before due date" |
| AI meeting-to-task extraction | Not native (would need Zapier + Fireflies + manual mapping) | Not present | Native, integrated into the same demand model — this is the clearest differentiation point |
| Financial dashboard | Not present (out of category) | Rarely present natively; usually via separate accounting tool | Native, synced directly from the org's existing Google Sheet — no separate accounting-software subscription needed (matches zero-budget constraint) |
| Role-based access for small org | Present but generic (workspace admin/member roles) | Present, closer fit (coordinator/staff/limited-access tiers) | Adopt the volunteer-CRM pattern (role = job function) over the generic PM-tool pattern (role = workspace permission level), since it matches the institution's actual 4-role structure |
| Elderly-friendly / low-friction UX | Mixed — Trello is simplest, Monday/Asana can overwhelm new users | Varies widely, several are dated/complex | Deliberately simpler than all of the above: short forms, large touch targets, minimal navigation depth |

## Sources

- [Boardable — Volunteer Management Software for Nonprofits](https://boardable.com/resources/volunteer-management-software-for-nonprofits-civicchamps-boardable/)
- [Neon One — Top Volunteer Management Tools 2026](https://neonone.com/resources/blog/volunteer-management-software/)
- [Giveffect — Nonprofit Volunteer Management Software](https://www.giveffect.com/volunteer-management-software)
- [Galaxy Digital — Best Volunteer Management Software](https://www.galaxydigital.com/blog/volunteer-management-software)
- [VolunteerHub — Platform](https://volunteerhub.com/platform)
- [ProofHub — Top Project Management Software for Nonprofits 2026](https://www.proofhub.com/articles/project-management-software-for-nonprofits)
- [monday.com — Asana Alternatives 2026](https://monday.com/blog/project-management/asana-alternatives/)
- [Breeze — Best PM Software for Non-profits 2026](https://www.breeze.pm/articles/non-profit-project-management-software)
- [Apps 365 — AI Task Reminder Software](https://www.apps365.com/blog/task-reminder-software/)
- [Encharge — 15+ Best Reminder Emails](https://encharge.io/reminder-email/)
- [Textmagic — Reminder Email Best Practices](https://www.textmagic.com/blog/reminder-email-best-practices/)
- [ExpiryEdge — Automate Manual Deadline Reminders](https://expiryedge.com/blogs/automate-manual-deadline-reminders-a-practical-guide/)
- [Tactiq — AI Meeting Summaries](https://tactiq.io/features/summaries)
- [AWS ML Blog — Meeting Summarization and Action Item Extraction with Amazon Nova](https://aws.amazon.com/blogs/machine-learning/meeting-summarization-and-action-item-extraction-with-amazon-nova/)
- [AssemblyAI — How to Automatically Summarize Meeting Transcripts](https://www.assemblyai.com/blog/how-use-ai-automatically-summarize-meeting-transcripts)
- [BrassTranscripts — Meeting Notes to Action Items Prompt](https://brasstranscripts.com/blog/meeting-transcript-action-items-ai-prompt)
- [Funraise — Nonprofit Dashboard Guide with Examples](https://www.funraise.org/blog/your-ultimate-nonprofit-dashboard-guide-with-samples)
- [Databox — Ultimate Guide to Nonprofit Dashboards](https://databox.com/nonprofit-kpi-dashboard)
- [Sage — Nonprofit Financial Dashboard Guide](https://www.sage.com/en-us/blog/nonprofit-financial-dashboards/)
- [Golimelight — 5 Essential Nonprofit Financial Dashboards 2026](https://www.golimelight.com/blog/financial-dashboards-for-nonprofits)
- [National Council of Nonprofits — Dashboards for Nonprofits](https://www.councilofnonprofits.org/running-nonprofit/administration-and-financial-management/dashboards-nonprofits)
- [ButterflyMX — Nonprofit Access Control](https://butterflymx.com/blog/nonprofit-access-control/)
- [ClevertTap — Role-Based Access Control docs](https://docs.clevertap.com/docs/role-based-access-control)
- [Bold BI — RBAC for Embedded Dashboards](https://www.boldbi.com/blog/role-based-access-control-embedded-dashboards/)
- [Microsoft Learn — Manage Volunteers in Microsoft for Nonprofits](https://learn.microsoft.com/en-us/industry/nonprofit/volunteer-management-use)
- [MakeUseOf — Personal Finance Dashboard in Google Sheets](https://www.makeuseof.com/built-personal-finance-dashboard-in-google-sheets-that-beats-any-app/)
- [Relay — Build a Nonprofit Donor Dashboard with Google Sheets and Kindful](https://relayfi.com/blog/gearing-up-build-a-nonprofit-donor-dashboard-with-google-sheets-and-kindful/)
- [Coupler.io — Google Sheets Dashboard Examples](https://www.coupler.io/dashboard-examples/google-sheets-dashboard)
- Project context: `C:/Users/HP/Desktop/projetos/EctoDash/.planning/PROJECT.md`

---
*Feature research for: Internal nonprofit ops tool (demand/task management, AI meeting-to-task, financial dashboard, RBAC)*
*Researched: 2026-08-02*

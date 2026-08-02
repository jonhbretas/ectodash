# Architecture Research

**Domain:** Nonprofit volunteer/demand management system (task tracking + RBAC + email automation + AI transcript-to-task extraction + synced financial dashboard)
**Researched:** 2026-08-02
**Confidence:** HIGH (stack patterns are mainstream and well-documented for Next.js/Supabase/Vercel/Resend); MEDIUM on the AI-extraction human-review recommendation (a design judgment, not a sourced fact)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────────┐ ┌───────────────────────┐ │
│  │ Coordinator│ │ Demandas  │ │ Colar reunião │ │ Dashboard financeiro  │ │
│  │ overview   │ │ board     │ │ + resumo IA   │ │ (charts, cash state)  │ │
│  └─────┬─────┘ └─────┬─────┘ └───────┬───────┘ └───────────┬───────────┘ │
├────────┴─────────────┴───────────────┴─────────────────────┴─────────────┤
│                 NEXT.JS APP ROUTER (Vercel, single deploy)                │
│  Server Components (read) · Server Actions / Route Handlers (write)       │
│  ┌────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────────────┐ │
│  │ Auth/RBAC  │ │ Demandas      │ │ AI            │ │ Finance sync        │ │
│  │ middleware │ │ service       │ │ summarize/    │ │ service              │ │
│  │            │ │               │ │ extract svc   │ │                      │ │
│  └─────┬──────┘ └──────┬────────┘ └──────┬───────┘ └──────────┬───────────┘ │
├────────┴───────────────┴─────────────────┴────────────────────┴─────────────┤
│                     SCHEDULED JOBS (Vercel Cron → route handlers)          │
│  /api/cron/reminders (daily)     /api/cron/sheet-sync (hourly/daily)      │
├───────────────────────────────┬───────────────────────────────────────────┤
│         SUPABASE (Postgres + Auth + RLS)      │   EXTERNAL SERVICES        │
│  ┌───────────┐ ┌────────────┐ ┌────────────┐  │  ┌──────────┐ ┌─────────┐ │
│  │ profiles  │ │ demandas   │ │ reunioes/  │  │  │ Resend   │ │ Google  │ │
│  │ (roles)   │ │ areas      │ │ resumos    │  │  │ (email)  │ │ Sheets  │ │
│  └───────────┘ └────────────┘ └────────────┘  │  └──────────┘ │ API     │ │
│  ┌───────────┐ ┌──────────────────────────┐    │               └─────────┘ │
│  │ lembretes │ │ finance_snapshots        │    │  ┌──────────────────────┐ │
│  │ _log      │ │ (fluxo de caixa cache)   │    │  │ AI provider (OpenAI/ │ │
│  └───────────┘ └──────────────────────────┘    │  │ Anthropic via AI SDK)│ │
│                                                 │  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Auth/RBAC layer | Authenticate via institutional email; resolve role (Coordenador, Líder, Voluntário, Financeiro); gate routes and data | Supabase Auth (magic link or password) + `profiles` table (role column) + RLS policies + Next.js middleware for route-level gating |
| Demandas service | CRUD for demandas (title, owner, deadline, status, área/projeto); coordinator's cross-project overview | Server Actions calling Supabase client (server-side, service-scoped) with RLS enforcing row visibility |
| Reminder job | Find demandas due-soon/overdue, send email once per demanda/day, avoid duplicates | Vercel Cron → route handler → query + Resend send + write to `lembretes_log` for idempotency |
| AI summarize/extract service | Turn pasted transcript into (a) human-readable summary, (b) structured draft tasks for review | Two-step LLM call via Vercel AI SDK: `generateText`/`streamText` for summary, `generateObject` + Zod schema for structured task extraction |
| Finance sync service | Pull fixed-format Google Sheet, normalize into relational snapshot, feed dashboard | Vercel Cron → googleapis (service account/JWT) → parse fixed columns → upsert into `finance_snapshots` |
| Dashboard/UI | Present data per role, accessible for low-tech/elderly users | Server Components for data-heavy reads, minimal client JS, large touch targets, high contrast |

## Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/                  # login, magic-link callback
│   ├── (dashboard)/
│   │   ├── demandas/            # board + detail, role-gated views
│   │   ├── reunioes/            # paste transcript, review AI-extracted drafts
│   │   ├── financeiro/          # charts, cash position (role: Financeiro/Coordenador)
│   │   └── overview/            # coordinator cross-cutting view
│   └── api/
│       └── cron/
│           ├── reminders/route.ts    # daily digest + overdue emails
│           └── sheet-sync/route.ts   # pulls Google Sheet snapshot
├── lib/
│   ├── supabase/                # server client, browser client, RLS-aware helpers
│   ├── ai/                      # summarize.ts, extractTasks.ts (Zod schemas), prompts/
│   ├── email/                   # resend client, React Email templates
│   ├── sheets/                  # googleapis client, sheet-shape parser/validator
│   └── auth/                    # role helpers, route guards
├── components/                  # shared UI (cards, tables, charts) — accessibility-first
└── types/                       # shared DB row types (generated from Supabase schema)
```

### Structure Rationale

- **`app/(dashboard)/*` grouped by domain, not by role:** roles cut across domains (a Líder and the Coordenador both see `demandas`, just different scope) — RLS + query filters handle scope, not separate route trees. Keeps the app small and avoids duplicated UI code.
- **`api/cron/*` isolated from user-facing routes:** cron endpoints have a distinct security model (secret header, not user session) and distinct failure modes (must be idempotent, must not depend on a signed-in user).
- **`lib/ai`, `lib/email`, `lib/sheets` as narrow adapters:** each wraps exactly one external service behind a small typed interface. This is what lets AI-extraction, email, and sheet-sync be built and tested independently, and swapped later (e.g. change email or AI provider) without touching UI code.

## Architectural Patterns

### Pattern 1: Server Actions + Server Components as the default (skip a client-side API layer)

**What:** Read paths use Server Components querying Supabase directly server-side; writes use Server Actions (or minimal Route Handlers for cron/webhooks only). No separate REST/GraphQL API layer for the app's own UI.
**When to use:** Small-to-medium app, single frontend, no third-party API consumers. Exactly this project's shape.
**Trade-offs:** Much less boilerplate and fewer moving parts (important given the "keep it simple, low-friction" UX constraint and a small volunteer dev/maintenance team) vs. losing a formal API contract — acceptable since there's no external API consumer in v1.

**Example:**
```typescript
// app/(dashboard)/demandas/actions.ts
'use server'
export async function marcarConcluida(demandaId: string) {
  const supabase = createServerClient(); // RLS enforces who can update what
  const { error } = await supabase
    .from('demandas')
    .update({ status: 'concluida' })
    .eq('id', demandaId);
  if (error) throw error;
  revalidatePath('/demandas');
}
```

### Pattern 2: Role stored in a `profiles` table, checked via a security-definer helper (not raw JWT claims)

**What:** Role lives in a Postgres `profiles` table (one row per auth user), not in `app_metadata`/JWT. RLS policies call a `SECURITY DEFINER` SQL function (e.g. `has_role(uid, 'coordenador')`) instead of nesting a subquery on `profiles` directly inside every policy.
**When to use:** Any app with more than one role and any table where roles change over time (a volunteer becomes a líder, a líder becomes coordenador).
**Trade-offs:** Slightly more setup (one helper function) vs. two real risks avoided: (a) JWT claims going stale until token refresh after a role change, and (b) RLS self-referencing `profiles` inside its own policy causing infinite-recursion errors — a documented, common Supabase RLS gotcha.

**Example:**
```sql
create or replace function has_role(check_role text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = check_role
  );
$$;

create policy "financeiro pode ver fluxo de caixa"
on finance_snapshots for select
using (has_role('financeiro') or has_role('coordenador'));
```

### Pattern 3: Idempotent scheduled jobs with a log table

**What:** Every Vercel Cron job (reminders, sheet-sync) writes an audit row (`lembretes_log`, `finance_sync_log`) recording what it did and when, and checks that log before acting again.
**When to use:** Any cron-triggered side effect that costs something if duplicated (sending an email twice, double-counting a sync).
**Trade-offs:** One extra table + one extra write per run vs. eliminating duplicate reminder emails on cron retries/overlaps and giving the coordinator an audit trail ("last synced at X").

```typescript
// app/api/cron/reminders/route.ts
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const demandas = await getDemandasDueOrOverdue();
  for (const d of demandas) {
    const alreadySent = await wasReminderSentToday(d.id);
    if (alreadySent) continue;
    await sendReminderEmail(d);
    await logReminderSent(d.id);
  }
  return Response.json({ processed: demandas.length });
}
```

### Pattern 4: Two-step AI pipeline with a human-approval gate before task creation

**What:** Step 1 — `generateText`/`streamText` produces a readable meeting summary shown to the coordinator immediately. Step 2 — `generateObject` with a Zod schema (`{ title, suggestedResponsibleEmail, suggestedDeadline, area }`) extracts a list of *draft* tasks. Drafts are shown in a review UI where the coordinator confirms/edits responsible + deadline before they become real `demandas` rows.
**When to use:** Whenever an LLM's output changes data that other people will act on (assign a volunteer, set a deadline) — especially with an older, less tech-savvy user base who won't intuitively know to double-check an AI mistake.
**Trade-offs:** One extra click/step vs. an LLM silently misassigning a task to the wrong volunteer or hallucinating a deadline going straight into the system of record. Given the target users, correctness/trust matters more than saving one click.

```typescript
// lib/ai/extractTasks.ts
const TaskDraft = z.object({
  title: z.string(),
  suggestedResponsibleEmail: z.string().email().optional(),
  suggestedDeadline: z.string().optional(), // ISO date, may be absent
  area: z.string().optional(),
});
const { object } = await generateObject({
  model: aiModel,
  schema: z.object({ tasks: z.array(TaskDraft) }),
  prompt: buildExtractionPrompt(resumo),
});
// object.tasks are drafts only — inserted into `demandas` only after coordinator confirms
```

## Data Flow

### Demanda lifecycle flow

```
User (any role, scoped by RLS)
    ↓
Server Action → Supabase insert/update on `demandas`
    ↓
RLS policy checks role + ownership → allow/deny
    ↓
revalidatePath → Server Component re-fetches → UI updates
```

### Reminder flow

```
Vercel Cron (daily, e.g. 08:00) → GET /api/cron/reminders (CRON_SECRET header)
    ↓
Query `demandas` where prazo <= today+N and status != concluída
    ↓
Filter out ones already in `lembretes_log` for today
    ↓
Resend API send (React Email template) → log to `lembretes_log`
```

### Meeting → tasks flow

```
Coordenador pastes transcript text (from Fireflies/tl;dv export)
    ↓
Server Action → AI summarize (generateText) → store `reunioes.resumo`
    ↓
Server Action → AI extract (generateObject + Zod) → draft tasks (not yet persisted as demandas)
    ↓
Review UI: coordenador edits/confirms responsible + prazo per draft
    ↓
Confirmed drafts → insert into `demandas` (with `reuniao_id` FK for traceability)
```

### Financial dashboard flow

```
Vercel Cron (e.g. hourly or daily) → GET /api/cron/sheet-sync
    ↓
googleapis (service account JWT, read-only scope) → pull fixed-format Sheet
    ↓
Validate/parse expected columns → on shape mismatch, log error, keep last-good snapshot
    ↓
Upsert into `finance_snapshots` (append-only or latest-per-period, keeps history for trend charts)
    ↓
Dashboard (Server Component) reads from Postgres — never queries Sheets directly on page load
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Institution's actual size (dozens of volunteers, single org) | Everything above as a single Next.js monolith on Vercel free/hobby tier + Supabase free tier is sufficient indefinitely for this use case — no need to plan beyond this. |
| If multiple nonprofits/orgs onboard later | Add an `organizacao_id` column across tables and extend RLS policies to scope by org (multi-tenant pattern) — straightforward extension of Pattern 2, not a rewrite. |
| If AI/email volume grows large | Move cron-triggered fan-out (many emails, many AI extractions) to a queue (e.g. Supabase's `pg_cron` + a jobs table, or a hosted queue) instead of doing everything inline in one cron invocation, to respect Vercel function time limits. |

### Scaling Priorities

1. **First real constraint:** Vercel Cron function execution time limits (esp. on Hobby plan) if the number of demandas or the Sheet grows — mitigate by keeping cron handlers fast (simple queries, batch email sends) and moving heavier AI work to on-demand user-triggered actions rather than cron.
2. **Second constraint (unlikely at this scale):** Google Sheets API read quotas — mitigate by syncing on a schedule (not on every page view) and caching in Postgres, which this architecture already does by design.

## Anti-Patterns

### Anti-Pattern 1: Querying Google Sheets live on every dashboard page load

**What people do:** Call the Sheets API directly inside the page/Server Component that renders the dashboard.
**Why it's wrong:** Adds Sheets API latency to every page view, risks hitting read quotas, and breaks the entire dashboard if the sheet's format is temporarily wrong or the sheet owner has a formula error mid-edit.
**Do this instead:** Sync on a schedule into a `finance_snapshots` table; dashboard always reads from Postgres. Sync failures degrade to "last known good" data with a visible "last synced" timestamp, not a broken page.

### Anti-Pattern 2: Storing role in JWT `app_metadata` and trusting it everywhere

**What people do:** Put `role` in the Supabase Auth user's `app_metadata` and read it from `auth.jwt()` inside RLS policies for simplicity.
**Why it's wrong:** The JWT is only refreshed periodically (not instantly on role change), so promoting/demoting a volunteer doesn't take effect until their token refreshes — a real problem when the Financeiro role gates money data.
**Do this instead:** Store role in a `profiles` table (source of truth), checked live via a `SECURITY DEFINER` function in RLS policies (Pattern 2).

### Anti-Pattern 3: Auto-creating tasks straight from AI extraction with no review step

**What people do:** Pipe `generateObject` output directly into `INSERT INTO demandas`.
**Why it's wrong:** LLMs can hallucinate a deadline, mis-assign the wrong volunteer (especially with name ambiguity), or extract a non-task as a task. For a coordinator relying on this system as the single source of truth, silent bad data is worse than a small amount of manual confirmation friction — especially given the target users won't naturally think to audit AI output.
**Do this instead:** Show extracted tasks as editable drafts; require explicit confirmation before they become real `demandas` rows (Pattern 4).

### Anti-Pattern 4: Building a custom audio transcription pipeline in v1

**What people do:** Get tempted to integrate Fireflies/tl;dv APIs or build in-house audio-to-text to "complete the pipeline."
**Why it's wrong:** Explicitly out of scope for this milestone per PROJECT.md — the input is already-exported transcript text; building ingestion automation now expands surface area (webhooks, API auth, audio storage) with no validated demand yet.
**Do this instead:** A simple "paste transcript text" textarea is the entire input surface for v1. Revisit automation only after the core loop (paste → summarize → extract → review → create demandas) is validated.

### Anti-Pattern 5: Sending reminder emails without an idempotency/audit log

**What people do:** Cron handler queries overdue demandas and just sends emails every run, with no record of what was already sent.
**Why it's wrong:** Vercel Cron (and most schedulers) can occasionally retry or overlap invocations; without a log, volunteers get duplicate reminder emails, which erodes trust in the system for a not-very-tech-forward audience.
**Do this instead:** `lembretes_log` table keyed by `(demanda_id, date)`; check-then-send-then-log inside the cron handler (Pattern 3).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Resend | Server-side SDK call from `/api/cron/reminders` and from any transactional flow (e.g. account invite); templates via React Email | Free tier has a daily/monthly send cap — fine at this org's volunteer-count scale; keep sends batched per cron run, not per-request |
| Google Sheets API | `googleapis` npm package, service-account JWT auth, read-only scope; sheet must be shared with the service account email | Sync via scheduled route handler only, never from client; validate fixed-column shape defensively since a human still edits the sheet by hand |
| AI provider (OpenAI or Anthropic) via Vercel AI SDK | `generateText` for summary, `generateObject` + Zod for structured task extraction | Keep prompts and schemas in `lib/ai/`; treat model output as untrusted input requiring the review gate (Pattern 4) |
| Supabase (Auth + Postgres + RLS) | `@supabase/ssr` for server/browser clients; RLS as the single authorization boundary, enforced identically regardless of which code path reads/writes | Avoid re-implementing authorization checks in application code as the primary guard — RLS should be able to stand alone even if app code has a bug |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| UI ↔ Demandas service | Server Actions (direct function calls, no HTTP) | No public API surface needed in v1; keeps the mental model simple |
| Cron jobs ↔ Demandas/Finance data | Direct Supabase queries inside route handlers, gated by `CRON_SECRET`, not by user session | Cron runs with elevated (service-role) access deliberately — must be careful this key never reaches the client bundle |
| AI service ↔ Demandas service | AI service only ever produces *drafts*; only the confirm action writes to `demandas` | Keeps "which code path is allowed to create a real task" auditable and singular |
| Finance sync ↔ Dashboard | Dashboard reads only from `finance_snapshots`, never calls Sheets API itself | Decouples dashboard availability from Google API availability/quota |

## Build Order Implications

Given the component boundaries above, a dependency-driven build order:

1. **Foundation:** Next.js scaffold, Supabase project, Auth restricted to institutional email, `profiles` table + roles, baseline RLS (via `has_role` helper), accessible base layout/design system. Everything else depends on this.
2. **Core demandas + RBAC-scoped views:** `areas/projetos` and `demandas` schema, CRUD via Server Actions, role-scoped views (Coordenador overview vs. Líder vs. Voluntário), RLS policies per role. This is the core value and the dependency for reminders and AI-extracted tasks.
3. **Email reminders:** Resend integration, `lembretes_log`, Vercel Cron job, templates. Depends on the `demandas` schema from step 2; independent of AI and finance work, so this and step 4/5 can be built in parallel by different workstreams if desired.
4. **AI meeting summarization + task extraction:** paste-transcript UI, `generateText` summary, `generateObject` extraction, review/confirm UI writing into `demandas`. Depends only on the `demandas` schema (step 2) and auth (step 1) — not on step 3.
5. **Financial dashboard + Sheets sync:** `finance_snapshots` schema, Google Sheets service-account integration, sync cron, chart UI, Financeiro-role RLS policies. Fully independent of `demandas`/AI — only depends on step 1 (auth/roles) — so it could be resequenced earlier or run in parallel with steps 3–4 if the coordinator wants financial visibility sooner.

Practical note: steps 3, 4, and 5 are mutually independent once step 2 (or, for step 5, just step 1) lands — the roadmap can parallelize them across phases if capacity allows, rather than treating this as a strictly linear chain.

## Sources

- [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs) — HIGH confidence, official docs
- [Managing Cron Jobs (Vercel)](https://vercel.com/docs/cron-jobs/manage-cron-jobs) — HIGH confidence, official docs
- [Vercel Cron Job Example template](https://vercel.com/templates/next.js/vercel-cron) — HIGH confidence, official
- [AI SDK Core: Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) — HIGH confidence, official Vercel AI SDK docs
- [Structured Data Extraction — Vercel Academy](https://vercel.com/academy/ai-sdk/structured-data-extraction) — HIGH confidence, official
- [Authorization via Row Level Security — Supabase](https://supabase.com/features/row-level-security) — HIGH confidence, official docs
- [Custom Claims & Role-based Access Control (RBAC) — Supabase Docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — HIGH confidence, official docs
- [Supabase RLS Best Practices — makerkit.dev](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — MEDIUM confidence, third-party but widely-cited production guidance
- [Row-Level Security Recursion: A Debugging Story](https://lindanthillanayagam.substack.com/p/row-level-security-recursion-a-debugging) — MEDIUM confidence, corroborates the recursion gotcha behind Pattern 2/Anti-Pattern 2
- [Working with the Google Sheets API in Next.js — Adam Drake](https://www.adamdrake.dev/blog/working-with-googlesheets-api-nextjs) — MEDIUM confidence, community pattern, consistent across multiple independent sources found
- General Next.js App Router / Server Actions conventions — HIGH confidence, mainstream framework convention as of 2026

---
*Architecture research for: Nonprofit volunteer/demand management system (Next.js + Supabase + Vercel + Resend + AI)*
*Researched: 2026-08-02*

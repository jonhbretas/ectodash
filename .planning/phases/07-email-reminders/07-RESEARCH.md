# Phase 7: Email Reminders - Research

**Researched:** 2026-08-04
**Domain:** Scheduled server-side job (Vercel Cron -> Next.js App Router Route Handler) using a Supabase service-role client (no user session in a cron context) to query already-modeled overdue/approaching demandas, sending transactional email directly via the Resend Node SDK (NOT via Supabase Auth's SMTP relay), with a new persistence layer for both deduplication and a coordenador-visible run log.
**Confidence:** HIGH — the architectural split (Resend package vs. Supabase Auth SMTP) is verified by reading this repo's own Phase 1 summaries and `package.json` directly, not inferred; Vercel Cron's exact config shape, Hobby-plan cap, `CRON_SECRET` auto-injection, and at-least-once delivery semantics are all read directly from current official Vercel docs; the `resend`/`react-email` package legitimacy question required a deeper-than-usual check (see Package Legitimacy Audit) and is now resolved with direct registry evidence, not assumption.

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists yet for this phase — research runs before `/gsd-discuss-phase`, the same ordering Phase 6 used. No locked decisions, discretion areas, or deferred ideas to carry forward yet. Every design choice below is a research recommendation for discuss-phase/the planner to confirm or override.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEMB-01 | Sistema envia lembrete por e-mail (Resend) para demandas com prazo próximo | Architecture Item 1 (cron route + Resend SDK), Item 3 ("approaching prazo" definition), Pattern 1 |
| LEMB-02 | Sistema envia lembrete por e-mail para demandas já atrasadas | Pattern 1 (reuses `demandas_com_status.atrasada`, already server-computed by Phase 4) |
| LEMB-03 | Envio é idempotente — não manda lembrete duplicado no mesmo dia/ciclo | Item 2 (dedup schema design), Pattern 2, Common Pitfalls 1/2 |
| LEMB-04 | Execução do job de lembrete fica registrada e visível (sucesso/falha, quantidade enviada) | Item 2 (run-log schema), Item 7 (visibility surface), Pattern 3 |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Tech stack:** Vercel + Supabase free tier only — no paid services. Resend's free tier (100 emails/day, 3,000/month, 1 verified domain) [CITED: resend.com/docs/knowledge-base/account-quotas-and-limits, cross-checked via independent web search] is the hard ceiling this phase must design within; at this institution's documented scale ("dozens of demandas"), a once-daily digest for a comparably small volunteer roster stays well under 100/day even in a worst-case all-atrasada scenario.
- **`resend` npm package + `react-email`/`@react-email/components`** — CLAUDE.md's own recommendation, but the exact current package name for the components layer has changed since CLAUDE.md was written (see Package Legitimacy Audit — `@react-email/components` is now deprecated in favor of the unified `react-email` package). This research corrects that drift.
- **Vercel Cron (Hobby, 1 run/day cap) OR GitHub Actions cron workaround** — CLAUDE.md explicitly names both options and defers the choice to this phase's own research (Item 4 below resolves it: Hobby's daily cap is recommended, no GitHub Actions workaround needed for v1).
- **Same cron job also performs a trivial Supabase read to reset the 7-day inactivity pause clock** — CLAUDE.md's explicit instruction; this phase's reminder query already IS a real database read, so no separate no-op ping is needed — the reminder job itself satisfies this requirement as a side effect, not a bolted-on extra step.
- **RLS as the only real authorization boundary, EXCEPT for trusted server contexts** — CLAUDE.md's own framing distinguishes "hiding UI" (never a security boundary) from a legitimately trusted server-side job. A Vercel Cron invocation has no end-user session by construction; CLAUDE.md's principle that RLS must not be bypassed for user-facing requests does not forbid a service-role client for this one specific server-only, non-user-triggered job — see Item 6 below for the full justification.
- **`SUPABASE_SERVICE_ROLE_KEY` was deliberately never added to Vercel Production in Phase 1** (`01-04-SUMMARY.md`, `01-04-PLAN.md` Task 2 acceptance criteria) — explicitly because "no deployed code path reads it" at the time. **This phase changes that fact**: the new cron route IS a deployed code path that needs it. This is a required new deployment step, not a silent gap — flagged prominently in Common Pitfalls and Environment Availability below.
- **Migrations only as versioned SQL files under `supabase/migrations/`**, pushed via `npx supabase@latest db push` — next file is `0005_*.sql` for the new reminder-log table(s) this phase requires.
- **Accessible UX for elderly users** — carries into the reminder email itself (large text, high contrast, plain pt-BR copy, no dense HTML email trickery) and into the new coordenador-visible run-log surface (same `text-xl`/`text-2xl` scale, icon+label conventions already established by `StatusBadge`/`OverdueBadge`).
- **`zod`** — validates the cron route's own environment/config reads defensively (e.g. `CRON_SECRET` presence) and any structured data assembled before calling Resend; no new *external, untrusted* input this phase (the cron trigger itself carries no user-supplied payload).
- **`date-fns`** — reused for formatting `prazo` in the reminder email body (`dd/MM/yyyy`, pt-BR) and for the "N dias" approaching-prazo language, exactly as `OverdueBadge`/`DemandaCard` already do elsewhere.

## Summary

Phase 7 is architecturally simpler than it first looks, but it introduces this project's *first* genuinely new infrastructure shape: a server-only, non-user-triggered code path (a cron-invoked Route Handler) that must authenticate itself to Postgres without a user session, and a new persistence layer purpose-built for both deduplication and observability. Every other phase so far has been "a user is signed in, do something scoped to their role"; this phase is "no one is signed in, but a trusted job still needs institution-wide read access and write access to a new log table."

The critical architectural finding, directly answering the phase brief's framing question: **this phase must NOT reuse Supabase Auth's SMTP relay at all.** That relay (Resend, verified `ectolab.org` domain, configured entirely inside the Supabase Dashboard's Authentication -> SMTP Settings) exists solely to deliver Supabase Auth's own built-in email flows — magic-link and invite emails triggered by `signInWithOtp`/`admin.inviteUserByEmail`. There is no supported API to make Supabase Auth send an arbitrary, non-auth-flow email through that relay; `resend` is not currently installed in `package.json`, confirming Phase 1/2's SMTP work never touched application code, only Supabase Dashboard configuration. Phase 7's reminder emails are a completely different concern — arbitrary transactional email triggered by a cron schedule reading demanda data — and must go through the `resend` npm package directly, calling Resend's API from inside the cron Route Handler. The one piece of infrastructure Phase 7 *can* reuse from Phase 1/2's work is the verified `ectolab.org` sending domain itself: Resend domain verification is domain-level, not use-case-level, so the same verified domain covers both Supabase Auth's SMTP relay and a direct `resend.emails.send()` call with a `from` address like `lembretes@ectolab.org` — no new domain verification step is needed, only a new `RESEND_API_KEY` value (which may be the exact same Resend API key already used for the SMTP relay, or a new one scoped to this specific use case — either works, since verification is domain-scoped).

The second critical finding is a genuine gap this phase must close, not carry forward silently: `SUPABASE_SERVICE_ROLE_KEY` was deliberately excluded from Vercel's Production environment in Phase 1, on the explicit reasoning that no deployed code path read it. Phase 7's cron route is exactly that deployed code path — it runs with no `Authorization` cookie, no `auth.getUser()` session, and therefore cannot rely on RLS-scoped anon-key queries the way every Server Component built so far has. This is safe and appropriate specifically because the cron route's own code — not a client-supplied query — decides what to read and send; there is no untrusted input flowing into the service-role client's queries. But it requires adding `SUPABASE_SERVICE_ROLE_KEY` to Vercel Production for the first time in this project's history, which is a meaningful, flaggable change worth a human checkpoint given the key's RLS-bypassing power.

The third finding resolves LEMB-03's deduplication requirement with a single new table design rather than the two-tables-vs-one-table ambiguity the phase brief raises: a single `demanda_reminders_log` table with a UNIQUE constraint on `(demanda_id, tipo, sent_on)` serves BOTH needs simultaneously — an `INSERT ... ON CONFLICT DO NOTHING` (or a pre-check `SELECT`) against that same constraint IS the deduplication check, and the coordenador-visible run log is a `GROUP BY` aggregate over the same rows plus one small `reminder_runs` summary table for run-level metadata (started_at, finished_at, success/failure, counts) that isn't naturally derivable from per-reminder rows alone (e.g., "the job crashed before sending anything" has no per-reminder row to aggregate). Two tables, not one — but tightly scoped, both additive in a single `0005_*.sql` migration.

**Primary recommendation:** Add a new Vercel Cron-triggered Route Handler at `app/api/cron/reminders/route.ts`, scheduled once daily via `vercel.json`, secured by Vercel's auto-injected `CRON_SECRET` Authorization header. Inside, build a service-role Supabase client (bypassing RLS by design — this is a trusted, non-user-triggered context) to query `demandas_com_status` for demandas that are either `atrasada = true` or have `prazo` within a hardcoded 3-day window, join `demanda_responsaveis` + `profiles` for recipient emails, and — for each (demanda, responsável) pair not already present in `demanda_reminders_log` for today — send one email via `resend.emails.send()` using a `react-email` template, then record success/failure per reminder and a summary row in `reminder_runs`. Surface `reminder_runs` (plus per-run reminder counts) on a new coordenador-only page, most naturally as a new section on the existing `/painel` coordinator dashboard (Phase 6) rather than a wholly separate route, since it is one more "status of institution-wide operations" panel a coordenador already visits.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scheduling ("when do reminders run") | CDN/Platform (Vercel Cron) | — | Vercel Cron is a platform-level scheduling primitive that invokes an HTTP endpoint; no application code decides "when," only "what happens when invoked" |
| Reminder-eligibility computation (which demandas qualify) | Database/Storage | API/Backend | `atrasada`/approaching-prazo are date comparisons against already-modeled columns (`prazo`, `status`) — cheapest and most correct as a query predicate, not a client-side or in-memory filter over an unbounded fetch |
| Deduplication check (LEMB-03) | Database/Storage | API/Backend | A UNIQUE constraint + `ON CONFLICT`/pre-check is the database's own concurrency-safe idempotency primitive — doing this in application memory (e.g. a Set checked before sending) is not safe against Vercel's documented at-least-once/possible-duplicate cron delivery |
| Email composition and delivery | API/Backend | — | The cron Route Handler (API/Backend tier) is where `resend.emails.send()` is called; this is server-only by construction — no browser tier is involved anywhere in this phase |
| Email template rendering (visual/HTML shape) | API/Backend | — | `react-email` components render to HTML/text server-side, inside the same Route Handler process, before `resend.emails.send()`; never shipped to or executed in a browser |
| Run-log persistence and retrieval (LEMB-04) | Database/Storage | Frontend Server (SSR) | The log itself is a database write (API/Backend writes it during the cron run); the coordenador-facing display of it is an ordinary Server Component read, identical in shape to Phase 6's aggregate-dashboard pattern |
| Coordinator-only visibility of the run log | Frontend Server (SSR) | Database/Storage | Same UX-gate-vs-RLS split Phase 6 already established: a Server Component redirect for UX, with RLS on the new tables as the actual authorization boundary for any future direct-query path |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | `6.18.1` [VERIFIED: npm registry — package created 2017, actively maintained by Resend the company, 9.3M weekly downloads, official GitHub org `resend/resend-node`] | Node.js SDK for calling Resend's transactional email API directly from the cron Route Handler | This is the officially documented, company-maintained SDK for exactly this use case (server-side `emails.send()`); already CLAUDE.md's own recommendation and confirmed still current and unchanged |
| `react-email` | `6.9.1` [VERIFIED: npm registry — package created 2016, maintained by the same `resend` GitHub org, 3.3M weekly downloads] | React-component email templates, rendered to HTML at send time | Official, Resend-maintained templating layer; **package name has changed since CLAUDE.md was written** — see Package Legitimacy Audit below for the `@react-email/components` deprecation and the corrected import path |
| `@supabase/supabase-js` | already installed (`^2.112.0`, Phase 1) | Builds the service-role client inside the cron route (`createClient(url, SERVICE_ROLE_KEY)`), the same low-level factory `scripts/seed-coordinator.ts` already uses for admin operations | No new package — this is the exact same client construction pattern already proven live in this repo's own seed script, just invoked from a Route Handler instead of a local CLI script |
| `date-fns` | already installed (`^4.4.0`, Phase 4) | Computing "is `prazo` within N days" for the approaching-reminder window, and formatting `prazo` as `dd/MM/yyyy` inside the email body | Reused exactly as `OverdueBadge`/`DemandaCard` already use it; no new date library needed |
| `zod` | already installed (`^4.4.3`, Phase 4) | Optional defensive validation of the cron route's own env-derived config object before use (e.g. asserting `CRON_SECRET`/`RESEND_API_KEY` are non-empty strings at startup) | Not validating untrusted *external* input (the cron trigger carries no attacker-controlled payload), but reusing the project's own established "validate config/data shapes with zod" convention is proportionate and cheap |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | No additional supporting libraries needed — `resend` + `react-email` + existing Supabase/date-fns/zod cover this phase completely |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `resend` package direct API call (recommended) | Routing through Supabase Auth's SMTP relay somehow (e.g. abusing a custom email-template "hack") | Rejected outright — there is no supported Supabase Auth API to send an arbitrary non-auth-flow email; SMTP config in the Supabase Dashboard is wired exclusively to Auth's own email events (`signInWithOtp`, `inviteUserByEmail`, password recovery, etc.), not a general-purpose send function callable from application code |
| Vercel Cron, once daily (recommended) | GitHub Actions scheduled workflow calling a protected API route, for higher frequency | Rejected for v1 — see Item 4's full reasoning: this audience and use case don't need more than once-daily; adding a second scheduling system (GitHub Actions) for no proven benefit is unwarranted complexity CLAUDE.md itself only frames as a fallback "if you need reminder checks more than once per day" |
| `react-email` unified package (recommended, current) | `@react-email/components` (CLAUDE.md's literal original recommendation) | Not a tradeoff — a correction. `@react-email/components` is now deprecated ("Package no longer supported" [VERIFIED: npm registry `npm view @react-email/components deprecated`]); its components are now exported from the unified `react-email` package itself. Using the deprecated name would still technically install and might still work today, but building on a package the maintainers themselves have marked unsupported is the wrong call for new code |
| One `demanda_reminders_log` table (per-reminder) + one `reminder_runs` table (per-run summary) (recommended) | A single combined table trying to serve both purposes | Rejected — a per-run summary (e.g. "job started, crashed with an unhandled error before sending anything") has no natural per-reminder row to attach to; forcing run-level metadata onto a per-reminder table means either a nullable/sentinel "run summary" row mixed into the same table (fragile, easy to double-count in a `COUNT(*)` later) or duplicating run metadata onto every reminder row (denormalized, wasteful at this scale but more importantly semantically confusing) |
| Hardcoded 3-day "approaching prazo" window (recommended) | A configurable N-days setting (env var, database config row, or admin UI field) | Rejected for v1 — no requirement text or user story asks for configurability, and introducing a config surface for a single constant is speculative complexity; a hardcoded `const APPROACHING_PRAZO_DAYS = 3` is trivially changed by a future code edit if the coordenador later asks for a different window |

**Installation:**
```bash
npm install resend react-email
```

**Version verification:** `npm view resend version` -> `6.18.1`, `npm view react-email version` -> `6.9.1` — both confirmed current on the npm registry at research time [VERIFIED: npm registry]. `@react-email/components` (CLAUDE.md's original supporting-library name) exists on the registry but returns `deprecated: "Package no longer supported. Contact Support..."` via `npm view @react-email/components deprecated` [VERIFIED: npm registry] — do not install it; import email-building components from `react-email` itself instead.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `resend` | npm | Package name registered 2017; actively republished by current maintainers, latest version 2026-08-03 | 9.3M/week | `github.com/resend/resend-node` | `[SUS]` (automated "too-new" signal — see note) | **Approved, flag overridden** — see justification below |
| `react-email` | npm | Package name registered 2016; actively republished by current maintainers, latest version 2026-07-23 | 3.3M/week | `github.com/resend/react-email` | `[SUS]` (automated "too-new" signal) | **Approved, flag overridden** — see justification below |
| `@react-email/components` | npm | Long-established, but explicitly deprecated | 4.8M/week (legacy installs still pulling it) | `github.com/resend/react-email` (monorepo) | `[SUS]` (deprecated) | **REMOVED from recommendation** — replaced by importing directly from `react-email` |

**Justification for overriding the `resend`/`react-email` "too-new" `[SUS]` flags:** The automated legitimacy check's "too-new" signal is a false positive for both packages, caused by the check looking only at the *latest version's* publish timestamp, not the package's registration date. Direct registry queries (`npm view resend time.created` -> `2017-02-25`, `npm view react-email time.created` -> `2016-05-19`) prove both package *names* have been continuously held and actively published by the same GitHub organization (`resend`) for 8-10 years, with tens of millions of weekly downloads and an official, linked source repository — the textbook profile of a legitimate, heavily-used package that happens to ship frequent releases (both had a new version published within the last two weeks of this research), not a slopsquat or hallucinated name. This override is itself `[ASSUMED... resolved to VERIFIED]`: the registration-date and maintainer-continuity check was performed directly against the npm registry this session, not taken on faith from training data — see Assumptions Log for the residual risk framing.

**Justification for removing `@react-email/components`:** `npm view @react-email/components deprecated` returns the literal string `"Package no longer supported. Contact Support at https://www.npmjs.com/support for more info."` [VERIFIED: npm registry] — an unambiguous, current, first-party deprecation notice, not a heuristic signal. Web search confirms the migration path: React Email's component packages were unified into the single `react-email` package; import `{ Button, Html, ... }` from `"react-email"` rather than `"@react-email/components"` going forward [CITED: resend.com/blog/react-email-3, resend.com/blog/react-email-5, react.email/docs/changelog].

**Packages removed due to `[SLOP]` verdict:** none — neither `resend` nor `react-email` is a slopsquat; both are long-established, legitimately maintained packages that merely triggered an automated heuristic's blind spot.
**Packages flagged as suspicious `[SUS]` and requiring a `checkpoint:human-verify` before install per protocol:** `resend`, `react-email` — the planner MUST insert a `checkpoint:human-verify` task before the `npm install resend react-email` step, even though this research has already resolved the flag with direct registry evidence, per the Package Legitimacy Gate protocol's requirement that `[SUS]` verdicts always carry a human checkpoint regardless of how strong the research-time justification is.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Vercel Platform — Cron Scheduler                                         │
│  vercel.json: { "crons": [{ "path": "/api/cron/reminders",              │
│                              "schedule": "0 8 * * *" }] }                 │
│  Hobby plan: fires once/day, +/-59min precision window, UTC             │
│  Auto-injects Authorization: Bearer <CRON_SECRET> on every invocation   │
└───────────────────────────────────────────┬──────────────────────────────┘
                                             │ GET (Vercel sends GET by
                                             │ default; user-agent
                                             │ "vercel-cron/1.0")
┌────────────────────────────────────────────────────────────────────────────┐
│ Next.js 16 App Router Route Handler — app/api/cron/reminders/route.ts   │
│  (NEW — this phase's only new server entry point)                       │
│                                                                            │
│  1. Verify request.headers.get("authorization") ===                     │
│     `Bearer ${process.env.CRON_SECRET}` -> 401 if mismatch/missing      │
│     (rejects any non-Vercel-triggered manual hit on this URL)           │
│                                                                            │
│  2. Build a SERVICE-ROLE Supabase client (no user session exists here — │
│     this is a trusted, non-user-triggered context; RLS bypass by        │
│     design, see Pattern/Item 6 below)                                   │
│                                                                            │
│  3. INSERT a new reminder_runs row (status='running', started_at=now()) │
│     -- this row exists even if step 4-6 crash, satisfying LEMB-04's     │
│     "failure" visibility requirement                                    │
└───────────────────────────────────────────┬────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Supabase (Postgres) — read side, service-role bypasses RLS entirely      │
│                                                                            │
│  SELECT id, titulo, prazo, area, atrasada FROM demandas_com_status      │
│    WHERE atrasada = true                                                 │
│       OR (status <> 'concluida' AND prazo <= current_date + 3)          │
│    -- both LEMB-01 (approaching) and LEMB-02 (atrasada) in ONE query    │
│                                                                            │
│  For each qualifying demanda:                                            │
│    JOIN demanda_responsaveis + profiles -> recipient email(s)           │
│    (a demanda with 0 responsáveis: SKIPPED, logged as "sem responsável",│
│     never silently dropped — see Pitfall 4)                             │
└───────────────────────────────────────────┬────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Route Handler — per (demanda, responsável) pair                         │
│                                                                            │
│  4. Dedup check: INSERT INTO demanda_reminders_log                      │
│       (demanda_id, profile_id, tipo, sent_on) VALUES (...)               │
│       ON CONFLICT (demanda_id, profile_id, tipo, sent_on) DO NOTHING    │
│       RETURNING id;                                                      │
│     -- if 0 rows returned: already reminded today, SKIP send (LEMB-03)  │
│     -- if 1 row returned: this INSERT is itself the dedup lock — safe   │
│       even if two cron invocations somehow overlap (Vercel's own        │
│       documented at-least-once delivery warning)                        │
│                                                                            │
│  5. resend.emails.send({ from: "lembretes@ectolab.org", to: [email],    │
│       subject, react: ReminderEmail({ titulo, prazo, tipo }) })          │
│     -- react-email component rendered server-side, HTML sent via        │
│       Resend's REST API (never through Supabase Auth's SMTP relay)     │
│                                                                            │
│  6. UPDATE demanda_reminders_log SET status = 'sent'|'failed' ...        │
└───────────────────────────────────────────┬────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Route Handler — after the loop                                          │
│  7. UPDATE reminder_runs SET status='success'|'partial_failure',        │
│       finished_at=now(), sent_count=N, failed_count=M, skipped_count=K  │
│  8. Return 200 JSON summary (Vercel logs this; no retry on non-2xx      │
│     per Vercel's documented "no automatic retry" behavior)              │
└────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼ (separate, later, user-triggered)
┌────────────────────────────────────────────────────────────────────────────┐
│ Browser — Coordenador visits /painel (Phase 6's existing dashboard)     │
└───────────────────────────────────────────┬────────────────────────────┘
                                             │ GET /painel
┌────────────────────────────────────────────────────────────────────────────┐
│ Server Component — app/(dashboard)/painel/page.tsx (EXTENDED, not new)  │
│  Reads reminder_runs (+ aggregated demanda_reminders_log counts) via    │
│  the caller's ordinary ANON-key, RLS-scoped client — coordenador RLS    │
│  policy on the new tables grants full read; every other role denied    │
│  New reminder-runs-panel.tsx section rendered alongside existing        │
│  área/responsável/overdue summaries                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── cron/
│   │       └── reminders/
│   │           └── route.ts          # NEW — the only new server entry point
│   │                                    this phase adds; GET handler, verifies
│   │                                    CRON_SECRET, orchestrates the full run
│   └── (dashboard)/
│       └── painel/
│           ├── page.tsx               # EXTENDED — adds one query + one new
│           │                            section import; existing área/
│           │                            responsável/overdue logic untouched
│           └── reminder-runs-panel.tsx # NEW — renders reminder_runs +
│                                          per-run sent/failed/skipped counts,
│                                          matching StatCard's existing
│                                          accessible visual convention
├── lib/
│   ├── supabase/
│   │   ├── server.ts                  # UNCHANGED (anon-key, session-bound)
│   │   ├── client.ts                  # UNCHANGED (browser anon-key)
│   │   ├── middleware.ts              # UNCHANGED
│   │   └── admin.ts                   # NEW — thin factory wrapping
│   │                                    createClient(url, SERVICE_ROLE_KEY),
│   │                                    mirroring scripts/seed-coordinator.ts's
│   │                                    existing inline pattern but extracted
│   │                                    for reuse by the cron route
│   └── reminders/
│       ├── eligibility.ts             # NEW — pure function: given a row from
│       │                                demandas_com_status, decide tipo
│       │                                ('atrasada' | 'aproximando' | null)
│       │                                using APPROACHING_PRAZO_DAYS constant
│       └── send-reminder.ts           # NEW — wraps resend.emails.send() +
│                                         error handling, called per recipient
├── emails/
│   └── reminder-email.tsx             # NEW — react-email template, large
│                                         text/high-contrast per elderly-UX
│                                         requirement, pt-BR copy
└── vercel.json                        # NEW at repo root — crons config
```

### Pattern 1: One query serves both LEMB-01 and LEMB-02 — reuse `atrasada`, add one date-window predicate

**What:** `demandas_com_status.atrasada` already exists (Phase 4) as a server-computed boolean. "Approaching prazo" is the one genuinely new predicate this phase introduces: `status <> 'concluida' AND prazo <= current_date + 3`. Both LEMB-01 (approaching) and LEMB-02 (atrasada) are expressible as a single `OR`'d `WHERE` clause against the same view — no second query, no client-side re-filtering.
**When to use:** The cron route's main eligibility read.
**Example:**
```typescript
// src/lib/reminders/eligibility.ts
const APPROACHING_PRAZO_DAYS = 3; // hardcoded per Item 3 — not configurable in v1

export type ReminderTipo = "atrasada" | "aproximando";

export function reminderTipoFor(row: {
  prazo: string; // date string, e.g. "2026-08-10"
  status: "pendente" | "em_andamento" | "concluida";
  atrasada: boolean;
}): ReminderTipo | null {
  if (row.status === "concluida") return null;
  if (row.atrasada) return "atrasada";

  const prazoDate = new Date(row.prazo);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + APPROACHING_PRAZO_DAYS);
  // Reuses date-fns for the actual comparison in the real implementation
  // (isWithinInterval / differenceInCalendarDays) rather than raw Date math
  // shown here for brevity — see Code Examples for the date-fns version.
  return prazoDate <= windowEnd ? "aproximando" : null;
}
```
```typescript
// The actual Supabase query — one round trip, both reminder types:
const { data: rows } = await adminClient
  .from("demandas_com_status")
  .select("id, titulo, prazo, area, status, atrasada")
  .neq("status", "concluida")
  .or(`atrasada.eq.true,prazo.lte.${threeDaysFromNowISO}`);
```
**Why this is safe with a service-role client and no RLS:** The service-role client bypasses RLS entirely — but the query's own `WHERE`/`.or()` predicate is written by this phase's own trusted code, not derived from any client-supplied input. There is no privilege-escalation surface here because no external actor influences what this query selects.

### Pattern 2: Deduplication IS the INSERT, not a separate check-then-send

**What:** LEMB-03 ("never more than one reminder per demanda per day/cycle") is satisfied by a UNIQUE constraint on `demanda_reminders_log (demanda_id, profile_id, tipo, sent_on)` plus `INSERT ... ON CONFLICT DO NOTHING`. This is deliberately NOT a `SELECT` to check existence followed by a separate `INSERT` if absent — that two-step shape has a race window (relevant given Vercel's own documented possible-duplicate-invocation behavior) that a single atomic `INSERT ... ON CONFLICT` closes by construction.
**When to use:** Immediately before calling `resend.emails.send()` for each (demanda, responsável, tipo) triple.
**Example:**
```sql
-- supabase/migrations/0005_reminder_logs.sql (recommended shape)
create table public.demanda_reminders_log (
  id bigint generated always as identity primary key,
  demanda_id bigint not null references public.demandas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  tipo text not null check (tipo in ('atrasada', 'aproximando')),
  sent_on date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  run_id bigint references public.reminder_runs(id),
  created_at timestamptz not null default now(),
  unique (demanda_id, profile_id, tipo, sent_on)
);
```
```typescript
// Cron route, per recipient:
const { data: dedupRow, error: dedupError } = await adminClient
  .from("demanda_reminders_log")
  .insert({ demanda_id: demanda.id, profile_id: recipient.id, tipo, run_id: runId })
  .select("id")
  .single();

if (dedupError?.code === "23505") {
  // Unique violation -- already reminded today for this exact
  // (demanda, profile, tipo) combination. Skip silently (counts toward
  // "skipped" in the run summary, NOT "failed").
  skippedCount++;
  continue;
}
// dedupRow.id now exists -- this row IS the lock. Proceed to send.
```
**Why `sent_on = current_date` (not a timestamp) is the correct dedup granularity:** LEMB-03 says "no mesmo dia/ciclo" (same day/cycle) — since the job runs at most once/day (Item 4), "day" and "cycle" are the same window in this design. A `date` column, not `timestamptz`, makes the UNIQUE constraint naturally express "once per calendar day" without needing a separate date-truncation expression in the constraint itself.

### Pattern 3: `reminder_runs` — the run-level summary LEMB-04 needs, independent of per-reminder rows

**What:** A second, small table capturing one row per cron invocation — this is what LEMB-04's "log of reminder job runs showing success/failure and how many emails were sent" actually reads from, aggregated with (but not derived purely from) `demanda_reminders_log`.
**When to use:** One row created at the start of every cron invocation (status='running'), updated once at the end (or left as 'running' forever if the function crashes/times out — itself a visible, honest failure signal for LEMB-04, not swallowed).
**Example:**
```sql
create table public.reminder_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial_failure', 'failed')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text
);
```
```typescript
// Start of the Route Handler:
const { data: run } = await adminClient
  .from("reminder_runs")
  .insert({ status: "running" })
  .select("id")
  .single();
const runId = run.id;

// ... main loop (Pattern 1 + Pattern 2) ...

// End of the Route Handler (in a try/finally so a crash still records
// what happened up to that point, rather than leaving 'running' forever
// with zero information):
await adminClient
  .from("reminder_runs")
  .update({
    status: failedCount > 0 ? "partial_failure" : "success",
    finished_at: new Date().toISOString(),
    sent_count: sentCount,
    failed_count: failedCount,
    skipped_count: skippedCount,
  })
  .eq("id", runId);
```
**Why two tables, not one:** See Alternatives Considered — a run's own metadata (did the whole job crash before touching any demanda?) has no natural per-reminder row to live on; conflating the two would either need a fragile sentinel row or force every reminder row to redundantly carry run-level fields.

### Pattern 4: `checkpoint:human-verify` gate before the RESEND_API_KEY/SERVICE_ROLE_KEY production rollout

**What:** Adding `SUPABASE_SERVICE_ROLE_KEY` to Vercel Production for the first time (see Summary) and adding a new `RESEND_API_KEY` are both real, RLS-bypassing/quota-consuming credential changes to a live, already-deployed project — not routine code changes.
**When to use:** As an explicit plan task, before the cron route is deployed to production (though it can be developed and tested locally against `.env.local`, which already has `SUPABASE_SERVICE_ROLE_KEY` per Phase 1's local setup).
**Example task shape for the planner:**
```
checkpoint:human-verify — "Add SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY to
Vercel Production env vars (`vercel env add SUPABASE_SERVICE_ROLE_KEY production`,
`vercel env add RESEND_API_KEY production`), then confirm CRON_SECRET is also
set. Human types values directly into Vercel's prompt — key values must never
appear in a committed file or command-line argument history."
```

### Anti-Patterns to Avoid

- **Sending the reminder email THEN writing the dedup log row:** Reverses Pattern 2's ordering — if the process crashes or times out between the send and the log write, a retry (or Vercel's own documented duplicate-invocation possibility) would re-send. Always write/claim the dedup row FIRST (`INSERT ... ON CONFLICT`), then send; on send failure, update that same row's `status` to `'failed'` rather than deleting it (a failed-send attempt still "used" today's reminder slot for that demanda/tipo, consistent with LEMB-03's literal wording of "no more than one reminder," where a failed attempt still counts as an attempt).
- **Checking dedup with a `SELECT ... WHERE sent_on = today` followed by a conditional `INSERT`:** Two round trips with a race window; use the atomic `INSERT ... ON CONFLICT` (or `ON CONFLICT DO UPDATE` if you want to track retry attempts) instead — see Pattern 2.
- **Looping over demandas and calling `resend.emails.send()` once per demanda even when it has multiple responsáveis, sending a single email with all responsáveis in the `to` array:** LEMB-03's dedup granularity is per-demanda-per-recipient, not per-demanda — two different volunteers responsible for the same demanda both need to independently receive (and independently NOT be double-reminded for) their own copy. Loop over (demanda × responsável) pairs, not demandas alone.
- **Treating a demanda with zero responsáveis as simply absent from the result set:** Per the phase brief's own explicit callback (Item 8), this must be visible in the run log as "skipped, no responsável," not silently dropped — track a `skipped_no_responsavel` count (or fold it into the existing `skipped_count`, tagged distinctly) rather than only counting rows that had at least one recipient.
- **Building the service-role client inline in the Route Handler with a hardcoded env var read repeated in multiple files:** Extract `src/lib/supabase/admin.ts` as a single factory (mirroring `scripts/seed-coordinator.ts`'s existing inline construction, but shared) so there's exactly one place in the codebase that reads `SUPABASE_SERVICE_ROLE_KEY`, easing any future audit of where this powerful credential is used.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sending transactional email | A raw `fetch()` call to Resend's REST API with hand-built headers/auth | The `resend` npm package's `Resend` client + `.emails.send()` | The SDK handles auth header construction, retries-on-network-error semantics, TypeScript response typing (`{data, error}`), and stays in sync with Resend's own API surface — no reason to hand-roll HTTP calls to a well-documented, actively maintained official SDK |
| Building HTML email markup by hand (table-based layouts, inline styles for email-client compatibility) | Raw HTML template strings with manually inlined CSS | `react-email` components (`Html`, `Body`, `Container`, `Text`, `Button`, etc. imported from the unified `react-email` package) | Email HTML rendering has well-known cross-client quirks (Outlook's table-based layout requirements, Gmail's CSS stripping) that `react-email`'s components already solve; hand-rolling this is exactly the kind of "deceptively complex" problem this project's own CLAUDE.md flags libraries for |
| Deduplication/idempotency for a possibly-duplicate-invoked scheduled job | An in-memory `Set` of "already sent today," a file-based lock, or a `setTimeout`-based debounce | A Postgres UNIQUE constraint + `INSERT ... ON CONFLICT` (Pattern 2) | In-memory state does not survive across separate serverless function invocations (each cron trigger is a fresh, stateless Lambda-style execution) — only a persisted, atomically-checked constraint is safe against Vercel's own documented possible-duplicate cron delivery |
| Preventing overlapping concurrent runs (if a duplicate cron invocation fires while a previous run is still in-flight) | A hand-rolled Redis lock (as Vercel's own docs generically suggest for high-frequency crons) | Not needed at this cadence — a once-daily job has essentially zero chance of a second invocation starting before the first (typically sub-second to low-seconds) run finishes; Pattern 2's per-reminder dedup constraint already makes even a hypothetical overlap safe (the second run's `INSERT`s would just hit `ON CONFLICT` and skip), so a separate distributed lock is unwarranted complexity for this cadence and volume |

**Key insight:** This phase's two real hand-rolling temptations are (1) building email HTML/delivery from scratch instead of using the two purpose-built, actively maintained libraries CLAUDE.md already named, and (2) treating deduplication as an application-memory problem instead of a database-constraint problem. Both temptations come from the same root cause — under-trusting that "this runs once a day, how complicated can it be" — which is exactly the assumption Vercel's own documentation explicitly warns against (at-least-once delivery, no automatic retries, occasional duplicate invocations are documented, not hypothetical).

## Runtime State Inventory

**Trigger check: this phase is not a rename/refactor of an existing identifier** — it adds new infrastructure (cron route, two new tables, two new npm packages, two new env vars) without renaming or migrating any existing string, column, or config value. The Runtime State Inventory categories below are answered for completeness per the verification protocol, even though this is a greenfield-additive phase.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None renamed/migrated — `demandas`, `demanda_responsaveis`, `profiles` are read as-is by the new cron query; two new tables (`demanda_reminders_log`, `reminder_runs`) are purely additive. | None — additive migration only. |
| Live service config | **Supabase Auth's SMTP relay (Resend, `ectolab.org` domain) is configured entirely inside the Supabase Dashboard, not in this repo.** This phase does NOT touch that configuration — it is a separate, parallel path (direct `resend` package calls) that happens to share the same verified sending domain. Confirmed: no repo file references SMTP settings; `01-03-SUMMARY.md`/`01-04-SUMMARY.md` describe the SMTP fix as entirely Dashboard-side. | None to the existing SMTP config. New action: verify/obtain a `RESEND_API_KEY` value for the direct-send path (may reuse the same underlying Resend account's API key, or mint a new one scoped separately — either is valid). |
| OS-registered state | None — Vercel Cron registration lives in `vercel.json`, a tracked repo file (not OS-level state); no Windows Task Scheduler, pm2, or systemd involvement in this Vercel-hosted architecture. | None. |
| Secrets/env vars | **`SUPABASE_SERVICE_ROLE_KEY` exists locally (`.env.local`) but was deliberately excluded from Vercel Production in Phase 1** (`01-04-SUMMARY.md`). **`RESEND_API_KEY` does not exist as an application env var anywhere yet** (only as Dashboard-internal SMTP config, invisible to application code). **`CRON_SECRET` does not exist yet.** | **Data migration N/A; this is a required new deployment action**: add all three (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`) to Vercel Production via `vercel env add <NAME> production`, gated behind a `checkpoint:human-verify` task (Pattern 4) since these are sensitive credentials that must never appear in a committed file. |
| Build artifacts | None — no renamed packages, no stale installed artifacts; `resend`/`react-email` are fresh installs with no prior version to reconcile. | None. |

**Nothing found in "Stored data," "OS-registered state," or "Build artifacts"** — verified by reading `package.json`, `01-04-SUMMARY.md`/`01-04-PLAN.md`, and this repo's own `vercel.json` absence directly. "Live service config" and "Secrets/env vars" both surfaced real, actionable gaps rather than clean nothing-to-report categories — documented above rather than left blank.

## Common Pitfalls

### Pitfall 1: Assuming Supabase Auth's SMTP relay can send Phase 7's reminder emails

**What goes wrong:** An implementer sees "Resend is already configured" (true, per Phase 1/2) and tries to find a Supabase Auth API to trigger an arbitrary custom email through that same relay, discovering only after significant wasted effort that Supabase Auth's email system is hardwired to its own internal auth events (magic link, invite, recovery, email-change confirmation) with no general-purpose "send this email" function exposed to application code.
**Why it happens:** "SMTP is already set up" sounds like it solves the whole email-sending problem, when it actually only solves domain/deliverability configuration — the actual send-trigger mechanism is a completely separate concern this phase must build from scratch via the `resend` package.
**How to avoid:** Install and use `resend` directly, exactly as this research recommends; treat the existing SMTP relay as having solved ONLY "is `ectolab.org` a verified, deliverable sending domain" (yes, reusable) and nothing else.
**Warning signs:** Any code searching for a Supabase Auth admin method that sends a non-auth-flow email, or Dashboard exploration looking for a "custom email trigger" feature that doesn't exist.

### Pitfall 2: In-memory or single-request dedup logic that doesn't survive across cron invocations

**What goes wrong:** A `Set` or module-level variable tracking "already sent today" appears to work correctly in local testing (one process, one request) but provides zero protection in production, where each cron invocation is a fresh, stateless serverless function execution with no memory of previous runs.
**Why it happens:** Local development (`next dev`, a single long-running process) masks the stateless-per-invocation reality of the deployed cron route.
**How to avoid:** Dedup state MUST live in Postgres (Pattern 2's UNIQUE constraint), never in application memory.
**Warning signs:** Any `Set`, module-level array, or non-database variable named something like `sentToday` or `remindedDemandas`.

### Pitfall 3: Treating Vercel's cron delivery as guaranteed-exactly-once

**What goes wrong:** Code that assumes the cron route runs exactly once per day, with no retries and no duplicates, is fragile against Vercel's own documented behavior: "Cron delivery can also occasionally invoke the same scheduled run more than once" [VERIFIED: vercel.com/docs/cron-jobs/manage-cron-jobs, official docs, fetched directly] and "Vercel will not retry an invocation if a cron job fails" [same source] — meaning both duplicate AND missed runs are documented possibilities, not edge cases to dismiss.
**Why it happens:** "Once a day" sounds simple and reliable; the actual delivery guarantee (best-effort, at-least-once-ish, no automatic retry) is a real-world platform behavior easy to overlook without reading the specific docs page.
**How to avoid:** Design for idempotency (Pattern 2 already makes a duplicate invocation harmless) and for missed runs (the eligibility query in Pattern 1 re-evaluates the CURRENT state of every demanda every time it runs — a missed run yesterday doesn't lose data, because today's run will still find yesterday's still-atrasada demanda and correctly remind on it, since dedup is keyed by `sent_on = today`, not by "was this the Nth run").
**Warning signs:** Any comment or design assumption reading "this only ever runs once," or error-handling code that doesn't consider "what if this exact function body executes twice within the same minute."

### Pitfall 4: Silently dropping demandas with zero responsáveis instead of logging them as skipped

**What goes wrong:** A `demanda_responsaveis` join with no matching rows for a given demanda simply produces no output row for that demanda in a naive `INNER JOIN` — the demanda vanishes from the reminder run with no trace, and LEMB-04's run log shows a lower "processed" count with no visible explanation for the gap.
**Why it happens:** An `INNER JOIN` is the natural way to fetch "demanda + its responsável's email," but it silently excludes exactly the demandas that most need a coordenador's attention (nobody assigned means nobody will act on it without intervention).
**How to avoid:** After the eligibility query (Pattern 1), explicitly check for demandas with zero matching `demanda_responsaveis` rows and increment a distinct `skipped_no_responsavel` counter (or write a `demanda_reminders_log` row with `status = 'skipped'` and a `profile_id` of null if the schema allows it — recommend the counter approach for simplicity, since a null-profile_id row would violate the `not null` FK as currently designed).
**Warning signs:** A run-log summary where `sent_count + failed_count` doesn't match the total number of eligible demandas found by the Pattern 1 query, with no accounting for the difference.

### Pitfall 5: Forgetting `SUPABASE_SERVICE_ROLE_KEY` is absent from Vercel Production, discovering it only when the deployed cron route throws at runtime

**What goes wrong:** Local development and testing (where `.env.local` already has the service-role key from Phase 1) work perfectly; the first production deployment then fails at runtime with an authentication error the moment the cron route tries to build its service-role client, because Phase 1 deliberately never added that key to Vercel.
**Why it happens:** This project's env-var history up to this phase has a real, documented, INTENTIONAL gap (Phase 1's own explicit decision) that this phase must explicitly reverse — easy to overlook since "it already works locally" gives false confidence.
**How to avoid:** Treat "add `SUPABASE_SERVICE_ROLE_KEY` + `RESEND_API_KEY` + `CRON_SECRET` to Vercel Production" as an explicit, named plan task with its own checkpoint (Pattern 4), not an implicit assumption folded into a "deploy" step.
**Warning signs:** A plan that mentions deploying the cron route but never explicitly lists adding these three env vars as a distinct step.

### Pitfall 6: Using `@react-email/components` because CLAUDE.md and/or training data still names it

**What goes wrong:** Following CLAUDE.md's literal original text (`@react-email/components`) or general training-data familiarity with that package name leads to installing a package the maintainers have explicitly marked "no longer supported," which may still function today but receives no further updates/fixes and signals to any future maintainer that the dependency choice wasn't re-verified.
**Why it happens:** The unification into the single `react-email` package is a real, dated change (confirmed via `react-email` changelog/blog posts) that postdates a lot of existing training data and documentation snapshots — this is exactly the kind of drift AGENTS.md's own top-level warning ("this version has breaking changes... read the relevant guide before writing code... heed deprecation notices") is calibrated to catch, generalized here to a project dependency rather than the Next.js version itself.
**How to avoid:** Import email components (`Html`, `Body`, `Container`, `Text`, `Button`, etc.) from `"react-email"`, not `"@react-email/components"`; only install `react-email` (already includes the components + CLI + preview server), never the deprecated scoped package.
**Warning signs:** A `package.json` dependency entry for `@react-email/components`, or an import statement referencing that package name anywhere in `src/emails/`.

## Code Examples

### Approaching-prazo date-fns comparison (replacing the illustrative raw-Date version in Pattern 1)

```typescript
// src/lib/reminders/eligibility.ts
import { differenceInCalendarDays, isBefore, startOfDay } from "date-fns";

const APPROACHING_PRAZO_DAYS = 3;

export type ReminderTipo = "atrasada" | "aproximando";

export function reminderTipoFor(row: {
  prazo: string;
  status: "pendente" | "em_andamento" | "concluida";
  atrasada: boolean;
}): ReminderTipo | null {
  if (row.status === "concluida") return null;
  if (row.atrasada) return "atrasada";

  const daysUntilPrazo = differenceInCalendarDays(
    startOfDay(new Date(row.prazo)),
    startOfDay(new Date())
  );

  return daysUntilPrazo >= 0 && daysUntilPrazo <= APPROACHING_PRAZO_DAYS
    ? "aproximando"
    : null;
}
```

### react-email template (elderly-accessible: large text, high contrast, plain structure)

```tsx
// src/emails/reminder-email.tsx
import { Html, Head, Body, Container, Text, Heading } from "react-email";

interface ReminderEmailProps {
  titulo: string;
  prazoFormatado: string; // pre-formatted dd/MM/yyyy via date-fns, pt-BR
  tipo: "atrasada" | "aproximando";
}

export function ReminderEmail({ titulo, prazoFormatado, tipo }: ReminderEmailProps) {
  const mensagem =
    tipo === "atrasada"
      ? `A demanda "${titulo}" está atrasada. O prazo era ${prazoFormatado}.`
      : `A demanda "${titulo}" tem prazo próximo: ${prazoFormatado}.`;

  return (
    <Html lang="pt-BR">
      <Head />
      <Body style={{ backgroundColor: "#f4f4f5", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "480px", padding: "24px" }}>
          <Heading style={{ fontSize: "24px", color: "#18181b" }}>
            EctoDash — Lembrete de demanda
          </Heading>
          <Text style={{ fontSize: "18px", lineHeight: "1.6", color: "#27272a" }}>
            {mensagem}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

### Cron route skeleton (composing Patterns 1-3)

```typescript
// src/app/api/cron/reminders/route.ts
import type { NextRequest } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { reminderTipoFor } from "@/lib/reminders/eligibility";
import { ReminderEmail } from "@/emails/reminder-email";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient(); // service-role, RLS bypassed by design
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { data: run } = await supabase
    .from("reminder_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  const runId = run!.id;

  let sentCount = 0, failedCount = 0, skippedCount = 0, skippedNoResponsavel = 0;

  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const { data: demandas } = await supabase
      .from("demandas_com_status")
      .select("id, titulo, prazo, status, atrasada")
      .neq("status", "concluida")
      .or(`atrasada.eq.true,prazo.lte.${threeDaysFromNow.toISOString().slice(0, 10)}`);

    for (const demanda of demandas ?? []) {
      const tipo = reminderTipoFor(demanda);
      if (!tipo) continue;

      const { data: responsaveis } = await supabase
        .from("demanda_responsaveis")
        .select("profile_id, profiles(email)")
        .eq("demanda_id", demanda.id);

      if (!responsaveis || responsaveis.length === 0) {
        skippedNoResponsavel++;
        continue;
      }

      for (const r of responsaveis) {
        const { data: dedupRow, error: dedupError } = await supabase
          .from("demanda_reminders_log")
          .insert({ demanda_id: demanda.id, profile_id: r.profile_id, tipo, run_id: runId })
          .select("id")
          .single();

        if (dedupError?.code === "23505") {
          skippedCount++;
          continue;
        }

        const profileRow = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        if (!profileRow?.email) { skippedCount++; continue; }

        const { error: sendError } = await resend.emails.send({
          from: "EctoDash <lembretes@ectolab.org>",
          to: [profileRow.email],
          subject: tipo === "atrasada" ? "Demanda atrasada" : "Demanda com prazo próximo",
          react: ReminderEmail({
            titulo: demanda.titulo,
            prazoFormatado: format(new Date(demanda.prazo), "dd/MM/yyyy", { locale: ptBR }),
            tipo,
          }),
        });

        await supabase
          .from("demanda_reminders_log")
          .update({ status: sendError ? "failed" : "sent", error_message: sendError?.message })
          .eq("id", dedupRow!.id);

        sendError ? failedCount++ : sentCount++;
      }
    }

    await supabase
      .from("reminder_runs")
      .update({
        status: failedCount > 0 ? "partial_failure" : "success",
        finished_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
        skipped_count: skippedCount + skippedNoResponsavel,
      })
      .eq("id", runId);

    return Response.json({ sentCount, failedCount, skippedCount, skippedNoResponsavel });
  } catch (err) {
    await supabase
      .from("reminder_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: err instanceof Error ? err.message : "unknown error",
      })
      .eq("id", runId);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
```

### vercel.json cron configuration

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```
Note: on the Hobby plan, actual invocation time will be anywhere within the 08:00-08:59 UTC hour, per Vercel's documented "per-hour (±59 min)" scheduling precision for Hobby accounts [VERIFIED: vercel.com/docs/cron-jobs/usage-and-pricing, official docs, fetched directly].

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@react-email/components` as the components package, individual `@react-email/*` sub-packages | Unified `react-email` package exports everything (components + render + CLI) | React Email 3.0+ (per `resend.com/blog/react-email-3`, `react-email/docs/changelog`) — confirmed still the deprecated/superseded relationship as of this research's registry check | Any new code (including CLAUDE.md's own original recommendation) that names `@react-email/components` must be corrected to `react-email`; installing the deprecated name still works today but receives no further support |

**Deprecated/outdated:**
- `@react-email/components`: marked "Package no longer supported" directly on the npm registry; superseded by importing the same components from the unified `react-email` package.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A hardcoded 3-day "approaching prazo" window is the right default, and v1 should not make it configurable | Summary, Standard Stack > Alternatives Considered, Pattern 1 | Low — if discuss-phase or the coordenador wants a different window (2, 5, 7 days), this is a one-line constant change (`APPROACHING_PRAZO_DAYS`), not a schema or architecture change; no rework needed elsewhere |
| A2 | `demanda_reminders_log` + `reminder_runs` (two tables) is the right split, rather than one combined table or three+ tables | Summary, Pattern 2/3, Alternatives Considered | Medium — if the planner or a future phase wants richer run-level detail (e.g. per-área breakdown per run) the two-table shape still supports it via a `GROUP BY run_id`, so this is a low-risk assumption; the main risk is only naming/shape bikeshedding, not a functional gap |
| A3 | The `reminder_runs` log should surface on the EXISTING `/painel` coordinator dashboard (Phase 6) as a new section, rather than a separate new route | Summary, Recommended Project Structure, Item 7 | Low-Medium — mirrors Phase 6's own established pattern of coordinator-only aggregate views living at one URL; if the coordenador dashboard becomes overcrowded, splitting this into its own route later is an additive, non-breaking change (new page importing the same query logic) |
| A4 | Reusing the SAME Resend API key already used for Supabase Auth's SMTP relay (rather than minting a distinct key scoped to this new use case) is acceptable | Summary, Runtime State Inventory | Low — Resend API keys are typically scoped by permission level (full access vs. sending-only), not by "use case"; either choice works technically, and this is purely an operational preference the human setting up `RESEND_API_KEY` in Vercel can decide at that moment without any code implication |
| A5 | The `resend`/`react-email` package-name legitimacy override (see Package Legitimacy Audit) correctly identifies both as long-established, actively-maintained packages rather than a sophisticated squat of an old, abandoned name later revived maliciously | Package Legitimacy Audit | Low — the override is based on direct registry evidence (creation date, consistent maintainer org across 8-10 years, linked official GitHub repo, tens of millions of weekly downloads matching Resend's well-known public status as a real company) rather than name-recognition alone; residual risk is negligible given the depth of cross-checking performed, but the planner should still honor the mandatory `checkpoint:human-verify` gate per protocol regardless |

## Open Questions

1. **Should a "failed" email send (e.g. Resend API error, invalid recipient address) count against LEMB-03's dedup guarantee, or should it be eligible for a retry on the NEXT day's run even if that means technically two attempts within a short window?**
   - What we know: Pattern 2's design marks the dedup row as `status = 'failed'` but does NOT delete it — meaning a failed send today will NOT be retried until tomorrow's run (since today's UNIQUE constraint slot is already claimed).
   - What's unclear: Whether "never more than one reminder... no mesmo dia/ciclo" is meant to tolerate a same-day retry-after-failure (arguably not a "duplicate reminder" since the first one never actually delivered), or whether "once per day, period, regardless of outcome" is the intended, simpler reading.
   - Recommendation: Ship with the simpler "once per day regardless of outcome" reading (no same-day retry) for v1 — it's the literal, conservative interpretation of LEMB-03's wording, and a failed send is still visible in the run log (LEMB-04) for a human to notice and manually resolve if needed; revisit only if real-world failure rates make this feel too rigid.

2. **Does "atrasada" reminders need to repeat EVERY day a demanda remains overdue, or only once (the first day it becomes atrasada)?**
   - What we know: LEMB-02's wording ("já atrasadas") and LEMB-03's dedup wording ("no mesmo dia/ciclo") together imply the SYSTEM allows a new reminder each new day, but doesn't mandate it — a demanda that's been atrasada for 5 days could reasonably be reminded once (day 1 of being atrasada) or every day it remains atrasada.
   - What's unclear: The roadmap's phrasing doesn't distinguish these; "nunca manda lembrete duplicado no mesmo dia" reads naturally as "at most once per calendar day," which is compatible with EITHER "remind every day it's overdue" (most useful for nagging toward action) or "remind once, ever, per demanda."
   - Recommendation: Remind every day a demanda remains atrasada (bounded to once per day via the dedup constraint) — this is more useful for the actual goal (get someone to act on an overdue task) and matches how most task-reminder systems behave by default; a "remind only once ever" design would require additional state (has this demanda EVER been reminded) that nothing in the requirements asks for.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `resend` npm package | LEMB-01/02 email sending | ✗ (not yet installed) | — | None needed — install is the whole point of this phase; `npm install resend` |
| `react-email` npm package | Email template rendering | ✗ (not yet installed) | — | None needed — `npm install react-email` |
| `RESEND_API_KEY` (application env var, distinct from Supabase Dashboard's SMTP config) | Calling `resend.emails.send()` from the cron route | ✗ (does not exist yet as an app-level env var) | — | Must be obtained from the Resend dashboard and added via `vercel env add RESEND_API_KEY production` (Pattern 4) |
| `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production | Cron route's admin Supabase client | ✗ (exists locally in `.env.local`; explicitly excluded from Vercel Production since Phase 1) | — | Must be added via `vercel env add SUPABASE_SERVICE_ROLE_KEY production` (Pattern 4) — the value already exists locally, no new key generation needed, only a new deployment step |
| `CRON_SECRET` in Vercel Production | Securing the cron route against unauthorized manual invocation | ✗ (does not exist yet) | — | Generate a random 16+ char string, add via `vercel env add CRON_SECRET production` |
| Verified Resend sending domain (`ectolab.org`) | The `from` address on outgoing reminder emails | ✓ (verified in Phase 1/2 for the SMTP relay use case) | — | None needed — domain verification is domain-level, directly reusable for the direct `resend` package send path |
| Vercel Cron (platform feature) | Scheduling the daily job | ✓ (Hobby plan, no setup needed beyond `vercel.json`) | — | None needed at v1's once-daily cadence |

**Missing dependencies with no fallback:**
- `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (production), `CRON_SECRET` — all three MUST be added to Vercel Production before this phase's cron route can function in production; none has a code-level workaround, only a `checkpoint:human-verify` deployment step (Pattern 4).

**Missing dependencies with fallback:**
- None — the three missing env vars above are hard requirements with no viable code-level fallback (a cron route cannot function without its secret, its email API key, or its database credential).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 |
| Config file | `vitest.config.ts` (existing — `fileParallelism: false`, `include: ["tests/**/*.test.ts", "src/**/*.test.ts"]`) |
| Quick run command | `npx vitest run src/lib/reminders/` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEMB-01 | `reminderTipoFor()` correctly classifies a demanda with `prazo` 0-3 days out (not yet atrasada) as `"aproximando"`, and >3 days out as `null` | unit | `npx vitest run src/lib/reminders/eligibility.test.ts` | ❌ Wave 0 |
| LEMB-02 | `reminderTipoFor()` correctly classifies a demanda with `atrasada: true` as `"atrasada"` regardless of `prazo` distance, and a `concluida` demanda as `null` even if overdue | unit | `npx vitest run src/lib/reminders/eligibility.test.ts` | ❌ Wave 0 |
| LEMB-03 | A second `INSERT` into `demanda_reminders_log` with the same `(demanda_id, profile_id, tipo, sent_on)` violates the UNIQUE constraint (returns Postgres error code `23505`); a real cron-route integration test proves calling the route handler twice in the same day sends exactly one email per (demanda, responsável) pair, not two | integration | `npx vitest run tests/db/reminder-dedup.test.ts` | ❌ Wave 0 |
| LEMB-04 | A `reminder_runs` row is created at the start of a run and updated with correct `sent_count`/`failed_count`/`skipped_count` at the end; a simulated mid-run failure leaves a `status='failed'` row with `error_message` populated rather than an indefinitely `'running'` row with no trace | integration | `npx vitest run tests/db/reminder-run-log.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` on the touched test file(s)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/reminders/eligibility.test.ts` — pure-unit tests for `reminderTipoFor()`'s date-boundary logic (the 3-day window edge cases: exactly 3 days out, 4 days out, already atrasada, concluída-and-overdue)
- [ ] `tests/db/reminder-dedup.test.ts` — live-integration test (guarded by `describe.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)`, following this repo's established pattern from `tests/db/demandas-rls.test.ts`) proving the UNIQUE constraint actually rejects a duplicate `(demanda_id, profile_id, tipo, sent_on)` insert, and that invoking the cron route's core logic twice against the same fixture data results in exactly one `resend.emails.send()` call per recipient (mock the Resend client for this test — no real emails should be sent by the test suite)
- [ ] `tests/db/reminder-run-log.test.ts` — live-integration test proving `reminder_runs` rows are created/updated correctly across success, partial-failure, and thrown-exception scenarios
- [ ] Migration file `supabase/migrations/0005_reminder_logs.sql` — creates `demanda_reminders_log` and `reminder_runs` with RLS enabled (coordenador-only SELECT, matching Phase 6's `has_role('coordenador_geral')` pattern; no INSERT/UPDATE policy needed for `authenticated` since only the service-role client ever writes these tables)
- [ ] Mock/test double for `Resend.emails.send()` — every automated test must NOT send real emails; use Vitest's `vi.mock("resend")` to intercept the SDK call, consistent with how `tests/auth/signInWithOtp.test.ts` already mocks Supabase client calls in this repo

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (new shape) | The cron route has NO end-user authentication — it authenticates the REQUEST itself via `CRON_SECRET` Bearer-token comparison (Vercel's own documented mechanism), a fundamentally different authentication model from every other route in this app (which authenticate the requesting USER via Supabase session cookies) |
| V3 Session Management | no | No session is created, read, or relevant to the cron route — it is stateless per invocation by design |
| V4 Access Control | yes | The service-role Supabase client bypasses RLS entirely by design (Architectural Responsibility Map) — access control for this route is enforced entirely by the `CRON_SECRET` check at the HTTP layer, NOT by any database-level policy; the coordenador-only VIEW of `reminder_runs`/`demanda_reminders_log` on `/painel` IS RLS-gated (new SELECT policy using `has_role('coordenador_geral')`, mirroring Phase 6's precedent) |
| V5 Input Validation | no (cron route itself) | The cron trigger carries no user-supplied payload to validate — Vercel's own scheduler is the only caller, and its request body/params are not read by this route's logic |
| V6 Cryptography | no | `CRON_SECRET` is a shared-secret comparison (string equality against an env var), not a cryptographic signature scheme — this matches Vercel's own documented, official pattern exactly and is not a custom crypto implementation |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| An external attacker discovers `/api/cron/reminders` and repeatedly POSTs/GETs it, attempting to trigger unlimited reminder sends (spam/cost abuse against the Resend free-tier quota) or to probe for information via error responses | Denial of Service / Information Disclosure | `CRON_SECRET` Bearer-token check rejects any request without the exact matching header (401) before any database or Resend call is made; the dedup constraint (Pattern 2) additionally caps actual email volume even in a hypothetical bypass scenario, since a repeat trigger the same day would find every eligible reminder already claimed |
| `SUPABASE_SERVICE_ROLE_KEY` leaking via a logging statement, error message, or accidental client-bundle inclusion | Information Disclosure / Elevation of Privilege | Never log the key itself; the admin client factory (`src/lib/supabase/admin.ts`) is the sole place this key is read, mirroring `client.ts`'s existing "anon-key-only" discipline in reverse — a negative grep (`grep -r SUPABASE_SERVICE_ROLE_KEY src/app` excluding the one `api/cron` route and `lib/supabase/admin.ts`) should find zero other occurrences, same audit shape Phase 1's own acceptance criteria already used for this exact key |
| A future edit accidentally imports `createAdminClient()` (service-role) into a user-facing Server Component or Server Action, silently bypassing RLS for a real user-driven request | Elevation of Privilege | Restrict `createAdminClient()`'s usage, by code-review convention, to files under `src/app/api/cron/` only; never import it from anything under `src/app/(dashboard)/` or `src/app/(auth)/` |
| Resend API key or webhook payloads exposing recipient email addresses in a way a non-coordenador could access | Information Disclosure | The `reminder_runs`/`demanda_reminders_log` tables' RLS SELECT policy restricts read access to `coordenador_geral` only (mirroring the existing profiles/demandas pattern); no email addresses are stored redundantly in these log tables beyond the `profile_id` FK, which resolves back through `profiles` under that same table's existing RLS |

## Sources

### Primary (HIGH confidence)
- `package.json`, `supabase/migrations/0001-0004_*.sql`, `src/lib/supabase/server.ts`, `.planning/phases/01-project-scaffold-institutional-login/01-03-SUMMARY.md`, `01-04-SUMMARY.md`, `01-04-PLAN.md`, `.planning/STATE.md` — read directly, this repo — confirms `resend`/`react-email` not yet installed, no `app/api` directory exists yet, `SUPABASE_SERVICE_ROLE_KEY` deliberately excluded from Vercel Production, Supabase Auth SMTP relay is Dashboard-only config with `ectolab.org` verified, STATE.md's own explicit "re-verify... Resend quota numbers at Phase 1/7 start" flag
- `npm view resend version/time.created`, `npm view react-email version/time.created`, `npm view @react-email/components deprecated` — registry lookups performed directly this session [VERIFIED: npm registry]
- https://vercel.com/docs/cron-jobs, https://vercel.com/docs/cron-jobs/manage-cron-jobs, https://vercel.com/docs/cron-jobs/usage-and-pricing — official Vercel docs, fetched directly this session — `vercel.json` schema, `CRON_SECRET` auto-injection mechanism and exact verification code sample, Hobby-plan once-daily cap with ±59min precision, no-retry-on-failure, documented possible-duplicate-invocation and idempotency guidance
- https://resend.com/docs/send-with-nextjs — official Resend docs, fetched directly this session — exact `resend.emails.send()` call shape, `react:` prop passed as a function call not JSX

### Secondary (MEDIUM confidence)
- WebSearch (multiple independent sources, cross-checked against CLAUDE.md's own already-documented numbers) — Resend free tier 100/day, 3,000/month, 1 verified domain; Supabase free-tier 7-day inactivity pause with ~30s resume time
- WebSearch — `@react-email/components` deprecation and migration path to unified `react-email` package, corroborated by the direct npm registry deprecation string and by resend.com's own blog posts (react-email-3, react-email-5)

### Tertiary (LOW confidence)
- None — every architectural claim in this research is grounded either in a file read directly from this repository or an official vendor documentation page fetched directly; the resend/react-email legitimacy override is the one finding that required deeper-than-usual cross-checking (multiple registry queries), documented explicitly in the Package Legitimacy Audit and Assumptions Log rather than asserted as a plain fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `resend`/`react-email` current versions and the `@react-email/components` deprecation are all confirmed via direct npm registry queries, not training-data recall
- Architecture: HIGH — the Supabase-Auth-SMTP-vs-direct-Resend-package split is verified by reading this repo's own Phase 1 files directly (not assumed), and Vercel Cron's exact behavior (config shape, CRON_SECRET mechanism, at-least-once delivery) is read from current official docs fetched this session
- Pitfalls: HIGH — every pitfall traces either to an explicitly documented Vercel platform behavior (duplicate invocations, no retry) or to a directly-verified gap in this repo's own history (`SUPABASE_SERVICE_ROLE_KEY` excluded from Production)

**Research date:** 2026-08-04
**Valid until:** 2026-09-03 (30 days — the core architecture is stable, but re-verify Resend/Vercel free-tier quota numbers and the `react-email` package structure specifically if planning is delayed past this window, since both have shown active, recent change velocity — `react-email` shipped a new major-adjacent release within the last two weeks of this research)

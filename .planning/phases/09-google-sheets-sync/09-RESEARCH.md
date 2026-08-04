# Phase 9: Google Sheets Sync - Research

**Researched:** 2026-08-04
**Domain:** A second Vercel Cron-triggered Route Handler (mirroring Phase 7's cron shape exactly) that authenticates to the Google Sheets API as a service account (`googleapis` + `google-auth-library`, no OAuth consent flow), reads a single spreadsheet range with a service-role Supabase client, parses rows through a validation layer, and replaces a new financial-entries table's contents on every run — plus a `sheet_sync_runs` log table and a small "last synced" status panel on `/painel`, matching `reminder_runs`/`reminder-runs-panel.tsx` byte-for-byte in shape.
**Confidence:** MEDIUM — the architectural pattern (cron + service-role + run-log + coordenador-only RLS + `/painel` panel) is HIGH confidence, verified by reading this repo's own Phase 7 implementation directly. The `googleapis`/`google-auth-library` service-account auth pattern is HIGH confidence, cross-checked against official Google docs and the current GitHub README. The actual column-mapping/parsing logic is necessarily LOW confidence — **no one in this session has seen the real spreadsheet** — and is explicitly scaffolded as a placeholder pending a required human checkpoint, not asserted as a real schema.

<user_constraints>
## User Constraints (from CONTEXT.md)

No CONTEXT.md exists yet for this phase — research runs before `/gsd-discuss-phase`, the same ordering Phase 6/7/8 used. No locked decisions, discretion areas, or deferred ideas to carry forward yet. Every design choice below is a research recommendation for discuss-phase/the planner to confirm or override.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIN-01 | Sistema sincroniza dados automaticamente da planilha Google Sheets de fluxo de caixa (formato fixo) | Architecture Items 1-2 (cron route + `googleapis`/`google-auth-library` service-account auth), Item 5 (daily cadence), Pattern 1-2 |
| FIN-03 | Sistema mostra indicador visível de última sincronização (data/hora, sucesso ou falha) | Architecture Item 1 (`sheet_sync_runs` table, mirroring `reminder_runs`), Item 6 (minimal `/painel` panel), Pattern 3 |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **`googleapis` + `google-auth-library`, service account only (never OAuth desktop flow)** — CLAUDE.md's explicit recommendation. A service account requires no human consent-screen click and does not expire the way a user OAuth refresh token can if unused; this matches the cron context exactly (no user is present when the job runs), the same reasoning that already justified `SUPABASE_SERVICE_ROLE_KEY` for Phase 7's cron route.
- **Share the sheet with the service account's `...@...iam.gserviceaccount.com` email as Viewer** — CLAUDE.md's explicit setup step; this is a manual, one-time action taken in the Google Sheets UI by whoever owns the real spreadsheet (the coordenador), not something code can automate.
- **Never commit or client-expose the service-account JSON key; store as a Vercel server-only env var** — CLAUDE.md's "What NOT to Use" table is explicit and direct: "It's a long-lived credential with read access to the institution's real cash-flow sheet; leaking it is a real financial-data exposure." This is the single highest-severity credential this project has introduced so far — more sensitive than `RESEND_API_KEY` (email-send only) and comparable in blast radius to `SUPABASE_SERVICE_ROLE_KEY`.
- **Vercel + Supabase free tier only, zero/low budget** — the Google Sheets API itself has no paid tier relevant at this scale (see Environment Availability); no new paid service is introduced by this phase.
- **Accessible UX for elderly users** — carries into the minimal sync-status indicator (large text, high contrast, icon+label pairing, exactly matching `reminder-runs-panel.tsx`'s established convention) but this phase's UI footprint is deliberately tiny: FIN-03 asks only for "last synced, success or failure," not a data table or chart (that's Phase 10).
- **`zod`** — validates each raw Sheets row against an assumed/placeholder schema before it is trusted as a typed financial entry; this is the *first* phase in this project where genuinely untrusted external data (a human-editable spreadsheet, not a database row or an internally-generated AI JSON payload) flows into the system, making row-level validation a real security/data-integrity boundary, not a defensive nicety.
- **Migrations only as versioned SQL files under `supabase/migrations/`**, pushed via `npx supabase@latest db push` — next file is `0006_*.sql` (confirmed: `0001`-`0005` already exist, `0005_reminder_logs.sql` is Phase 7's).
- **"Fixed-format" spreadsheet** — PROJECT.md/CLAUDE.md both describe the source sheet as having a fixed/standardized layout, but this is a *description of the sheet's nature*, not a specification of its actual columns. No sample data, tab name, or column layout has been provided to this research session. See Item 3 below for how this genuine unknown is handled.

## Summary

Phase 9 is architecturally the closest thing to a "copy Phase 7, change the data source" phase this project has had. Every structural decision Phase 7 already made and proved live in production — a `CRON_SECRET`-gated Vercel Cron Route Handler, a service-role Supabase client for the trusted server-only write, a dedicated run-log table surfaced read-only on `/painel` via coordenador-only RLS — transfers directly. The only genuinely new technical surface is the *read* side: instead of querying this project's own Postgres database, the cron route must authenticate to an external, human-maintained Google Sheet and pull its current values.

That authentication is a solved, well-documented pattern: `googleapis` (currently `174.0.0`) plus `google-auth-library` (currently `11.0.0`) are Google's own official Node.js clients, both long-established (`googleapis` package name registered 2012, `google-auth-library` 2015, both maintained continuously by the `googleapis` GitHub org with tens of millions of weekly downloads) — the same "too-new-latest-version" false-positive pattern Phase 7's package-legitimacy check already hit and resolved for `resend`/`react-email` applies here too (see Package Legitimacy Audit). The `google-auth-library` `GoogleAuth`/`JWT` client accepts service-account credentials directly as a `{ client_email, private_key }` object (no key *file* needs to exist on disk in a serverless environment), and that credential shape is exactly what a downloaded service-account JSON key contains. The one real operational wrinkle — and it is a genuine, previously-undocumented-in-this-repo pitfall, not a hypothetical — is that a service-account private key is a multi-line PEM string, and Vercel's environment variable UI does not reliably preserve literal embedded newlines pasted directly into a plain-text field; the verified-safe pattern (confirmed via multiple independent sources) is to **base64-encode the entire downloaded JSON key file as a single line**, store that as one Vercel env var, and `Buffer.from(process.env.X, "base64").toString("utf-8")` + `JSON.parse()` it at runtime — sidestepping newline-escaping entirely rather than trying to get `\n`-escaping right by hand.

The second, and by far the most consequential, finding is a genuine research blocker this document must not paper over: **the actual column layout of the real spreadsheet is unknown to this research session.** PROJECT.md and CLAUDE.md both describe the sheet as "fixed-format," which is a claim about the sheet's *stability*, not a specification of its *shape* — no tab name, header row, column order, date format, or currency-formatting convention has ever been captured anywhere in this repository's planning artifacts. STATE.md's own Blockers/Concerns section already flags this explicitly ("Phase 9 (Sheets sync) — actual spreadsheet layout unknown until inspected; start planning with a discovery step against the live sheet"), confirming this is a known, previously-identified gap, not something this research is discovering for the first time. Unlike Phase 7/8's credential checkpoints (where the checkpoint unlocks already-written code — the reminder cron route was fully specified before `RESEND_API_KEY` was obtained), this checkpoint's *output* — the real column layout — is a required *input* to the one piece of code this phase cannot pre-write: the row-parsing/column-mapping layer. Item 3 and Item 4 below work through exactly how to sequence this so the phase is still plannable and mostly buildable now, with only the narrow column-mapping slice deferred to a point after a human supplies the real layout.

**Primary recommendation:** Build this phase in two structurally separate pieces, sequenced so the checkpoint blocking the unknown piece happens FIRST, not last. Piece A (buildable now, no spreadsheet needed): `supabase/migrations/0006_*.sql` creating `sheet_sync_runs` (mirroring `reminder_runs`'s exact shape) and a `financial_entries` table (schema informed by Phase 10's known consumption needs — `tipo`/`descricao`/`valor`/`data`/`categoria` — but explicitly a best-guess pending real-column confirmation); `src/lib/supabase/admin.ts` is already reusable as-is (zero changes needed — it is source-agnostic); a `createSheetsClient()` auth factory using `googleapis`+`google-auth-library`; the `app/api/cron/sync-sheets/route.ts` skeleton with the `CRON_SECRET` check, run-log lifecycle, and a **generic, swappable** "raw rows in → typed rows out" parsing function with a zod schema built against a *reasonable, clearly-labeled placeholder assumption* (see Item 4). Piece B (blocked on the human): a `checkpoint:human-action` early in the phase's task sequence asking the user to (1) create a Google Cloud service account and share the real spreadsheet with its `...@...iam.gserviceaccount.com` email as Viewer, and (2) describe or screenshot the sheet's actual tab name and column layout — after which the placeholder zod schema and column-index mapping (a small, isolated function) are corrected to match reality, with everything else (auth, cron shape, run-log, RLS, `/painel` panel) untouched.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Scheduling ("when does sync run") | CDN/Platform (Vercel Cron) | — | Identical to Phase 7 — a platform-level scheduling primitive invoking an HTTP endpoint; no application code decides "when" |
| External authentication (Sheets API) | API/Backend | — | The cron Route Handler builds a `google-auth-library` JWT/GoogleAuth client server-side; this credential and the resulting HTTP calls to `sheets.googleapis.com` never touch a browser tier |
| Raw row fetch (Sheets API read) | API/Backend | — | `sheets.spreadsheets.values.get()` is a server-to-server call inside the Route Handler; no client-side Sheets SDK usage anywhere in this project |
| Row validation / typed parsing | API/Backend | — | A zod schema applied server-side, inside the same Route Handler, before any row is trusted as a typed `financial_entries` insert — this is the boundary where untrusted external (human-edited spreadsheet) data becomes trusted internal data |
| Ingested-data persistence (`financial_entries`) | Database/Storage | API/Backend | The service-role client writes rows; Postgres is the system of record Phase 10 will read from — never re-fetched from Sheets at dashboard render time |
| Run-log persistence and retrieval (FIN-03) | Database/Storage | Frontend Server (SSR) | Identical split to Phase 7's `reminder_runs`: API/Backend writes it during the cron run, Server Component reads it for display |
| Coordinator-visible "last synced" status | Frontend Server (SSR) | Database/Storage | Same UX-gate-vs-RLS split Phase 6/7 established: a Server Component role branch for UX, RLS on the new tables as the real authorization boundary |
| Full financial dashboard (entradas/saídas/resultado/caixa) | **OUT OF SCOPE this phase** | — | Explicitly Phase 10's responsibility per the roadmap — this phase's only UI surface is the minimal sync-status indicator; `financial_entries` is written here but not rendered as a dashboard here |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `googleapis` | `174.0.0` [VERIFIED: npm registry — package name registered 2012-09-18, 10.08M weekly downloads, official `github.com/googleapis/google-api-nodejs-client`] | Google's official, all-APIs Node.js client; provides `google.sheets({version: "v4", auth})` and the `spreadsheets.values.get` method | This is CLAUDE.md's own named recommendation and the officially documented, Google-maintained way to call the Sheets REST API from Node.js without hand-building HTTP requests/auth headers |
| `google-auth-library` | `11.0.0` [VERIFIED: npm registry — package name registered 2015-02-24, 78.06M weekly downloads, official `github.com/googleapis/google-cloud-node`] | Builds the service-account `JWT`/`GoogleAuth` client from `{ client_email, private_key }` credentials, without any OAuth consent-screen flow | CLAUDE.md's explicit recommendation; a service account is the only auth mode with no human-in-the-loop and no refresh-token-expiry risk, matching this cron route's unattended, no-user-session context exactly (the same reasoning that already justified `SUPABASE_SERVICE_ROLE_KEY` in Phase 7) |
| `@supabase/supabase-js` | already installed (`^2.112.0`) | The service-role client writing `financial_entries`/`sheet_sync_runs`, via the EXISTING `src/lib/supabase/admin.ts` factory (zero changes needed — it is source-agnostic, already used by Phase 7's cron route) | No new package, no new file — Phase 7 already built and proved this factory in production |
| `zod` | already installed (`^4.4.3`) | Validates each raw Sheets row (an array of untrusted strings/numbers from `result.data.values`) against a typed row schema before any `financial_entries` insert | This is the first phase where genuinely untrusted EXTERNAL data (a human-editable spreadsheet, unlike a Postgres row or an internally-generated AI JSON payload already schema-enforced in Phase 8) enters the system — row-level validation is a real boundary here, matching CLAUDE.md's own framing of zod as "reused... for... Sheets-row parsing" |
| `date-fns` | already installed (`^4.4.0`) | Formatting `sheet_sync_runs.started_at`/`finished_at` for the `/painel` status panel (`dd/MM/yyyy HH:mm`, pt-BR), identical usage to `reminder-runs-panel.tsx` | Reused exactly as Phase 7 already established; no new date library |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | No additional supporting libraries needed — `googleapis` + `google-auth-library` + existing Supabase/zod/date-fns cover this phase completely |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `googleapis` (full package, recommended) | `@googleapis/sheets` (scoped, Sheets-only package) | `@googleapis/sheets` (`14.0.0` [VERIFIED: npm registry, registered 2021-03-18]) is smaller and would shave Vercel serverless function cold-start bundle size, exactly as CLAUDE.md's own Version Compatibility table flags as "worth knowing... unlikely to matter at this scale." Rejected for v1: `googleapis`'s bundle-size cost is a documented but explicitly de-prioritized concern in this project's own CLAUDE.md, and the full package's docs/examples are far more heavily represented in official Google documentation, reducing implementation risk for what is otherwise a from-scratch integration this session has zero prior art for in this repo |
| Service account (recommended) | OAuth 2.0 desktop/web consent flow | Explicitly rejected by CLAUDE.md itself: a consent flow requires a human to click through a browser authorization screen and produces a refresh token that can expire if the app goes unused for an extended period — both wrong for an unattended cron job with no human present at run time |
| Base64-encoded single-env-var JSON key (recommended) | Separate `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` (with `\n`-escaped newlines) as two env vars | Both work in principle, but splitting into two vars re-introduces the exact newline-mangling risk this research flags as the one real operational wrinkle — Vercel's env var UI does auto-convert *some* pasted `\n` sequences, but this behavior is inconsistent across paste methods (CLI vs. dashboard vs. `.env` file import) per multiple independently-corroborated reports; base64-encoding the WHOLE downloaded JSON key file sidesteps newline-escaping entirely, since a base64 string has no embedded newlines to mangle in the first place |
| Full-replace-on-each-sync (recommended, see Item 5) | Upsert-by-natural-key, or append-only log | See Common Pitfalls "Idempotency" discussion below — a "fixed-format cash-flow spreadsheet" most plausibly represents a periodically-updated snapshot of current financial state (rows can be edited/deleted/reordered by the bookkeeper between syncs), not an append-only transaction log; full-replace is the only strategy that correctly reflects a row being DELETED or CORRECTED in the source sheet, which upsert-by-key or append cannot express |

**Installation:**
```bash
npm install googleapis google-auth-library
```

**Version verification:** `npm view googleapis version` → `174.0.0`; `npm view google-auth-library version` → `11.0.0` — both confirmed current on the npm registry at research time [VERIFIED: npm registry]. Neither is currently installed in `package.json` (confirmed by direct read).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `googleapis` | npm | Package name registered 2012-09-18; actively republished continuously since, latest version 2026-08-03 | 10.08M/week | `github.com/googleapis/google-api-nodejs-client` | `[SUS]` (automated "too-new" signal — see note) | **Approved, flag overridden** — see justification below |
| `google-auth-library` | npm | Package name registered 2015-02-24; actively republished continuously since, latest version 2026-07-30 | 78.06M/week | `github.com/googleapis/google-cloud-node` | `[SUS]` (automated "too-new" signal — see note) | **Approved, flag overridden** — see justification below |

**Justification for overriding both `[SUS]` flags:** Identical false-positive shape to Phase 7's `resend`/`react-email` override — the automated legitimacy check's "too-new" signal fires on the *latest published version's* timestamp (both packages shipped a release within the last several days of this research, consistent with Google's normal high-frequency release cadence for its official API clients), not on package *registration age*. Direct registry queries this session (`npm view googleapis time.created` → `2012-09-18`, `npm view google-auth-library time.created` → `2015-02-24`) prove both package names have been continuously held and actively published by the same official `googleapis` GitHub organization for 10-14 years, carry tens of millions of weekly downloads each, link an official, matching source repository, and have zero `postinstall` script (`npm view <pkg> scripts.postinstall` returns empty for both) — the textbook profile of legitimate, heavily-used, actively-maintained official SDKs, not a slopsquat or hallucinated name. `googleapis` is also this project's OWN CLAUDE.md's explicitly named recommendation, written before this research session began, further corroborating it is not a hallucinated suggestion.

**Packages removed due to `[SLOP]` verdict:** none — neither package is a slopsquat.
**Packages flagged as suspicious `[SUS]` and requiring a `checkpoint:human-verify` before install per protocol:** `googleapis`, `google-auth-library` — the planner MUST insert a `checkpoint:human-verify` task before `npm install googleapis google-auth-library`, even though this research has already resolved the flag with direct registry evidence, per the Package Legitimacy Gate protocol's requirement that `[SUS]` verdicts always carry a human checkpoint regardless of research-time justification strength.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Vercel Platform — Cron Scheduler (SECOND cron entry, vercel.json)       │
│  { "path": "/api/cron/sync-sheets", "schedule": "0 7 * * *" }            │
│  Hobby plan: fires once/day, +/-59min precision window, UTC              │
│  Auto-injects Authorization: Bearer <CRON_SECRET> (same secret Phase 7   │
│  already added to Vercel Production — reused, not duplicated)            │
└───────────────────────────────────────────┬──────────────────────────────┘
                                             │ GET
┌────────────────────────────────────────────────────────────────────────────┐
│ Route Handler — app/api/cron/sync-sheets/route.ts (NEW)                 │
│                                                                            │
│  1. Verify CRON_SECRET Bearer header — 401 if mismatch (Phase 7 Pattern) │
│  2. INSERT sheet_sync_runs (status='running', started_at=now())          │
│     -- exists even if steps 3-6 crash (FIN-03 "failure visible")         │
└───────────────────────────────────────────┬────────────────────────────┘
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Route Handler — Google Sheets read (NEW code, no prior art in this repo) │
│                                                                            │
│  3. createSheetsClient(): decode base64 GOOGLE_SERVICE_ACCOUNT_KEY env   │
│     var -> JSON.parse -> google-auth-library JWT client                  │
│     (scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]) │
│  4. sheets.spreadsheets.values.get({ spreadsheetId, range,               │
│       valueRenderOption: "UNFORMATTED_VALUE" })                          │
│     -- UNFORMATTED_VALUE avoids currency-string parsing ("R$ 1.234,56")  │
│       and returns raw numbers/date-serials instead (see Pitfall 2)       │
└───────────────────────────────────────────┬────────────────────────────┘
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Route Handler — parseSheetRows() (NEW, GENERIC layer — see Item 4)      │
│                                                                            │
│  For each raw row (array of unknown cell values):                        │
│    - Map by COLUMN INDEX to a named object (placeholder mapping, see     │
│      Pitfall 1 / checkpoint below)                                       │
│    - Validate against financialEntryRowSchema (zod)                      │
│    - Valid row -> typed FinancialEntry                                   │
│    - Invalid row -> SKIPPED + logged with its row number + reason,       │
│      never throws, never aborts the whole sync (mirrors Phase 7's        │
│      per-recipient error isolation, Pitfall 4 there)                     │
└───────────────────────────────────────────┬────────────────────────────┘
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Supabase (Postgres) — service-role write, RLS bypassed by design         │
│                                                                            │
│  5. FULL REPLACE: DELETE FROM financial_entries; then bulk INSERT all    │
│     validated typed rows from this run (Item 5 — a snapshot resync, not  │
│     an append-only log; see Pattern 2 for the transaction-safety detail) │
└───────────────────────────────────────────┬────────────────────────────┘
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Route Handler — after the sync                                          │
│  6. UPDATE sheet_sync_runs SET status='success'|'partial_failure'|       │
│       'failed', finished_at=now(), rows_synced=N, rows_skipped=K,        │
│       error_message=...                                                  │
│  7. Return 200 JSON summary                                              │
└───────────────────────────────────────────┬────────────────────────────┘
                                             │
                                             ▼ (separate, later, user-triggered)
┌────────────────────────────────────────────────────────────────────────────┐
│ Browser — Coordenador/Financeiro visits /painel (EXTENDED, not new)     │
└───────────────────────────────────────────┬────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────┐
│ Server Component — app/(dashboard)/painel/page.tsx (EXTENDED)           │
│  Reads sheet_sync_runs (latest row) via ordinary ANON-key, RLS-scoped   │
│  client; new sheet-sync-status-panel.tsx renders "Última sincronização: │
│  {data/hora} — {sucesso|falha}", matching reminder-runs-panel.tsx's     │
│  icon+label convention exactly. NOT the financial dashboard (Phase 10). │
└────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── cron/
│   │       ├── reminders/route.ts        # UNCHANGED (Phase 7)
│   │       └── sync-sheets/
│   │           └── route.ts               # NEW — CRON_SECRET check, run-log
│   │                                         lifecycle, orchestrates fetch +
│   │                                         parse + full-replace write
│   └── (dashboard)/
│       └── painel/
│           ├── page.tsx                    # EXTENDED — one new query + one
│           │                                  new section import; existing
│           │                                  logic untouched
│           └── sheet-sync-status-panel.tsx # NEW — minimal "last synced"
│                                              indicator, same visual
│                                              convention as
│                                              reminder-runs-panel.tsx
├── lib/
│   ├── supabase/
│   │   └── admin.ts                        # UNCHANGED — already
│   │                                          source-agnostic, reused as-is
│   └── sheets/
│       ├── client.ts                       # NEW — createSheetsClient():
│       │                                      base64-decode service-account
│       │                                      key env var, build JWT client
│       ├── schema.ts                       # NEW — financialEntryRowSchema
│       │                                      (zod), PLACEHOLDER pending
│       │                                      real column layout (Item 4)
│       └── parse-rows.ts                   # NEW — parseSheetRows(): raw
│                                              values[][] -> { valid, skipped }
│                                              generic pass, column-index
│                                              mapping isolated in one place
└── vercel.json                             # EXTENDED — second cron entry
```

### Pattern 1: `createSheetsClient()` — service-account JWT auth, base64-decoded from a single env var

**What:** A single factory function, mirroring `src/lib/supabase/admin.ts`'s existing shape, that decodes a base64-encoded service-account JSON key from ONE env var and returns an authenticated `googleapis` Sheets client. No key file ever touches disk.
**When to use:** Called once per cron invocation, inside `app/api/cron/sync-sheets/route.ts`.
**Example:**
```typescript
// src/lib/sheets/client.ts
import { google } from "googleapis";
import { JWT } from "google-auth-library";

export function createSheetsClient() {
  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;
  if (!encoded) {
    throw new Error(
      "Falta variável de ambiente: GOOGLE_SERVICE_ACCOUNT_KEY_BASE64"
    );
  }

  // Base64-encoding the WHOLE downloaded JSON key file sidesteps the
  // multi-line PEM private-key newline-mangling risk entirely — a base64
  // string has no embedded newlines to survive Vercel's env var UI in the
  // first place (see Common Pitfalls).
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const keys = JSON.parse(decoded) as {
    client_email: string;
    private_key: string;
  };

  const authClient = new JWT({
    email: keys.client_email,
    key: keys.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return google.sheets({ version: "v4", auth: authClient });
}
```
**Source:** [CITED: github.com/googleapis/google-auth-library-nodejs README, "JSON Web Tokens" section] — `JWT` client constructed from `email`/`key` fields, matching a service-account JSON key's `client_email`/`private_key` fields exactly; [CITED: developers.google.com/sheets/api/quickstart/nodejs] — `google.sheets({version: "v4", auth})` client construction.
**Why `spreadsheets.readonly`, not the broader `spreadsheets` scope:** This phase only ever reads; requesting the narrower read-only scope is the standard least-privilege practice for a service account whose leaked key would otherwise also grant write access to the institution's real spreadsheet.

### Pattern 2: Full-replace-on-sync inside a single transaction-safe sequence

**What:** Each successful sync run DELETEs all existing `financial_entries` rows and INSERTs the freshly-parsed set, rather than upserting by a natural key or appending. This is the correct idempotency strategy specifically because a "fixed-format cash-flow spreadsheet" most plausibly represents the bookkeeper's current, editable snapshot of financial state — rows can be corrected or removed between syncs, and only a full replace correctly reflects a deletion (an upsert-by-key would leave a stale row forever if its source row is later removed from the sheet; a naive append would duplicate every row on every run).
**When to use:** The final write step of every cron invocation, only after ALL rows have been successfully parsed (never a partial delete followed by a failed insert, which would leave `financial_entries` empty until the next successful run).
**Example:**
```typescript
// Only delete-and-replace AFTER parsing succeeds for the whole sheet —
// never delete first "to be safe," since a mid-parse crash would then
// leave financial_entries empty rather than showing yesterday's
// still-valid data until the next successful sync.
const { valid: entries, skipped } = parseSheetRows(rawValues);

const { error: deleteError } = await supabase
  .from("financial_entries")
  .delete()
  .neq("id", 0); // delete-all idiom; financial_entries.id is never 0 (identity starts at 1)

if (deleteError) throw new Error(deleteError.message);

if (entries.length > 0) {
  const { error: insertError } = await supabase
    .from("financial_entries")
    .insert(entries);
  if (insertError) throw new Error(insertError.message);
}
```
**Why not a single SQL transaction wrapping both statements:** The Supabase JS client's `.from()` query builder does not expose multi-statement transactions directly (this mirrors the same constraint Phase 7 implicitly worked within — its dedup INSERT and reminder_runs UPDATE are also separate round trips, relying on Postgres's own per-statement atomicity rather than an app-level transaction wrapper). The mitigating design choice — parse-then-replace, never replace-then-parse — is what keeps a mid-run failure from ever leaving `financial_entries` in a worse state than "still showing the previous successful sync's data," which is an acceptable, arguably preferable, degradation for a nonprofit's financial dashboard (stale-but-present beats empty).
**A stricter alternative for the planner to consider:** If transactional atomicity is wanted, a Postgres function (`SECURITY DEFINER`, called via `.rpc()`) wrapping the delete+insert in one transaction is the standard Supabase pattern for this — flagged as an Open Question below since it adds complexity Phase 7's precedent didn't need at its data volume, and this project's financial-entries volume (a monthly-updated institutional cash-flow sheet) is small enough that the failure window between two round trips is likely an acceptable risk for v1.

### Pattern 3: `sheet_sync_runs` — mirrors `reminder_runs` exactly, one new field for row counts

**What:** A run-log table with the identical shape/lifecycle as Phase 7's `reminder_runs` (started_at/finished_at/status/error_message), swapping `sent_count`/`failed_count`/`skipped_count` for `rows_synced`/`rows_skipped` — the FIN-03-specific counts this phase needs instead.
**When to use:** One row created at cron-invocation start (status='running'), updated once at the end — or left 'running' forever on an unhandled crash, itself a visible, honest failure signal (identical reasoning to Phase 7 Pattern 3).
**Example:**
```sql
-- supabase/migrations/0006_sheet_sync.sql (recommended shape)
create table public.sheet_sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial_failure', 'failed')),
  rows_synced integer not null default 0,
  rows_skipped integer not null default 0,
  error_message text
);
```
**Why reuse the exact same lifecycle, not a novel design:** Phase 7's `reminder_runs` shape was already reasoned through (see 07-RESEARCH.md Pattern 3) and proven live in production — there is no new consideration here that would justify a different design, and consistency reduces the coordenador's cognitive load (the sync-status panel and the reminder-runs panel will visually rhyme).

### Pattern 4: Generic parse layer with an explicit, isolated, swappable column-mapping seam

**What:** `parseSheetRows()` is written as two composable pieces: (a) a GENERIC part — iterate raw rows, catch validation errors per-row, accumulate `valid`/`skipped` — that needs zero changes once the real layout is known, and (b) an ISOLATED, single-function column-mapping piece (`mapRowToRawEntry(row: unknown[]): RawFinancialEntry`) that is the ONLY code that must be rewritten once the real spreadsheet layout is confirmed.
**When to use:** Building this phase's parsing logic now, before the real layout checkpoint resolves.
**Example:**
```typescript
// src/lib/sheets/schema.ts — PLACEHOLDER pending real column layout
// (see checkpoint:human-action in Item 3). This schema encodes a
// REASONABLE GUESS at what "entradas, saídas, resultado do mês, caixa
// atual" (Phase 10's known consumption needs, per ROADMAP.md) implies
// about row shape, NOT a verified fact about the real sheet.
import { z } from "zod";

export const financialEntryRowSchema = z.object({
  data: z.string().min(1), // ISO date string after column-mapping normalizes it
  tipo: z.enum(["entrada", "saida"]),
  descricao: z.string().min(1),
  valor: z.number(), // always positive; sign is carried by `tipo`, not the number
  categoria: z.string().nullable(),
});

export type FinancialEntry = z.infer<typeof financialEntryRowSchema>;
```
```typescript
// src/lib/sheets/parse-rows.ts
import { financialEntryRowSchema, type FinancialEntry } from "./schema";

// THE ONE FUNCTION TO REWRITE once the real column layout is known.
// Placeholder assumes: col 0 = data, col 1 = tipo, col 2 = descrição,
// col 3 = valor, col 4 = categoria — an assumption, not a verified fact.
function mapRowToRawEntry(row: unknown[]): unknown {
  return {
    data: row[0],
    tipo: row[1],
    descricao: row[2],
    valor: row[3],
    categoria: row[4] ?? null,
  };
}

export function parseSheetRows(rawValues: unknown[][]): {
  valid: FinancialEntry[];
  skipped: { rowIndex: number; reason: string }[];
} {
  const valid: FinancialEntry[] = [];
  const skipped: { rowIndex: number; reason: string }[] = [];

  rawValues.forEach((row, index) => {
    const mapped = mapRowToRawEntry(row);
    const result = financialEntryRowSchema.safeParse(mapped);
    if (result.success) {
      valid.push(result.data);
    } else {
      // Never throws — a malformed row is skipped and logged, the sync
      // continues (mirrors Phase 7's per-recipient error isolation).
      skipped.push({
        rowIndex: index,
        reason: result.error.issues.map((i) => i.message).join("; "),
      });
    }
  });

  return { valid, skipped };
}
```
**Why build the placeholder now instead of waiting entirely for the checkpoint:** This project's own established iterative pattern (see Phase 4's `demandas_com_status` view added incrementally, Phase 5's `lider_areas` design superseding 05-RESEARCH's own assumption once the user's real requirement was known) favors building the SHAPE now and correcting the DETAIL later over blocking all work on the unknown. The generic pass (row iteration, per-row error isolation, run-log bookkeeping) is 90% of this phase's real engineering complexity and needs zero spreadsheet knowledge to build and unit-test correctly; only `mapRowToRawEntry`'s five-line body and `financialEntryRowSchema`'s field list depend on the real layout. Recommend against waiting to write ANY code until the checkpoint resolves — that wastes the exact isolation this design already provides.

### Anti-Patterns to Avoid

- **Waiting for the spreadsheet-layout checkpoint before writing ANY phase code:** See Pattern 4 — the generic parse/run-log/auth scaffolding is fully buildable and testable (with fixture data) without the real layout; only `mapRowToRawEntry` + the zod schema's field list are genuinely blocked.
- **Treating "fixed-format" as license to skip row validation:** "Fixed-format" describes the sheet's INTENDED stability, not a guarantee against a bookkeeper accidentally typing text into a currency column, leaving a row half-filled, or inserting a blank separator row — exactly the kind of human-editable-spreadsheet failure mode zod validation exists to catch per-row without crashing the whole sync.
- **Storing the service-account private key as separate `GOOGLE_CLIENT_EMAIL`/`GOOGLE_PRIVATE_KEY` env vars with manually escaped `\n` sequences:** See Alternatives Considered — base64-encoding the whole JSON key file is the verified-safe pattern; hand-escaping newlines is a documented, recurring source of "works locally, breaks in production" bugs across multiple independent reports.
- **Parsing currency-formatted strings (`"R$ 1.234,56"`) instead of requesting `valueRenderOption: "UNFORMATTED_VALUE"`:** The Sheets API's default `FORMATTED_VALUE` render option returns whatever display format the sheet's cell formatting applies (locale-dependent thousands/decimal separators, currency symbols) — parsing that string is fragile and locale-fragile; `UNFORMATTED_VALUE` returns the underlying number directly.
- **Deleting `financial_entries` BEFORE parsing succeeds:** See Pattern 2 — always parse-then-replace, never replace-then-parse, so a mid-run crash leaves the previous sync's data intact rather than an empty table.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authenticating to a Google API as a service account | Hand-built JWT signing (RS256, manually constructing the claim set and signing with the private key) or a raw `fetch()` to Google's OAuth token endpoint | `google-auth-library`'s `JWT`/`GoogleAuth` client | Google's own official library handles JWT construction, signing, token caching/refresh, and clock-skew tolerance — hand-rolling JWT signing is exactly the kind of deceptively complex, security-sensitive problem (a subtly wrong signature or expired token silently breaks the daily sync) this project's own CLAUDE.md already flags libraries for elsewhere |
| Calling the Sheets REST API | Raw `fetch()` to `sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}` with hand-built query params and auth headers | `googleapis`'s `sheets.spreadsheets.values.get()` | Same reasoning as `resend`'s SDK in Phase 7 — the SDK stays in sync with the API surface, handles response typing, and is the officially documented calling convention |
| Validating human-edited spreadsheet rows | Manual `if (typeof row[3] !== "number") throw ...` chains scattered through the parse function | A single `zod` schema (`financialEntryRowSchema`) with `.safeParse()` per row | Centralizes the "what does a valid row look like" definition in one place, produces structured, readable error messages for the skip-log, and is the same validation-library convention this project already uses everywhere else (forms, AI extraction output in Phase 8) |
| Multi-line private key storage across a plain-text env var UI | Ad-hoc string manipulation (regex-replacing literal `\n` at runtime, or a custom escape scheme) | Base64-encode the whole JSON key file once, decode with `Buffer.from(..., "base64")` at runtime | A well-known, verified-safe pattern (see Alternatives Considered) that avoids the newline-escaping problem class entirely rather than solving it cleverly |

**Key insight:** This phase's real hand-rolling temptation is treating "the spreadsheet layout is unknown" as license to write brittle, un-validated parsing code "just to get something working" — the correct response to genuine uncertainty about external data shape is MORE validation rigor (a zod schema that fails loudly and specifically per-row), not less.

## Runtime State Inventory

**Trigger check: this phase is not a rename/refactor of an existing identifier** — it adds new infrastructure (a second cron route, two new tables, two new npm packages, one new env var) without renaming or migrating any existing string, column, or config value. The Runtime State Inventory categories below are answered for completeness per the verification protocol, even though this is a greenfield-additive phase.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None renamed/migrated — no existing table is touched. Two new tables (`sheet_sync_runs`, `financial_entries`) are purely additive. `financial_entries` itself is designed to be REPLACED wholesale on every sync run (Pattern 2) — this is a deliberate design property of the new table, not a migration concern for existing data. | None — additive migration only. |
| Live service config | **The real Google Sheet itself is external, human-maintained state that does not exist in this repo at all.** No file, migration, or env var currently references it. This phase's entire premise depends on state that lives outside version control (the actual spreadsheet's tab name, column layout, and sharing permissions) — this is the genuine unknown flagged throughout this document (Item 3/Pattern 4), not a gap to silently work around. | New action: the `checkpoint:human-action` (Item 3) — the coordenador must share the real sheet with a new service account and describe its layout before column-mapping code can be finalized. |
| OS-registered state | None — the new cron entry lives in `vercel.json` (a tracked repo file), extending the array Phase 7 already added; no OS-level scheduler involvement in this Vercel-hosted architecture. | None. |
| Secrets/env vars | **`GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` does not exist anywhere yet** — it cannot, since the service account itself does not exist until the human-action checkpoint creates one. `CRON_SECRET` already exists in Vercel Production (Phase 7) and is directly reusable for this second cron route without any new secret — Vercel's cron mechanism injects the SAME `CRON_SECRET` header value for every cron job in the project, so no per-job secret is needed. | New action: generate a Google Cloud service account, download its JSON key, base64-encode it, and `vercel env add GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 production` — gated behind the same `checkpoint:human-verify` discipline Phase 7 established for `RESEND_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY`, since this key is a live, RLS-adjacent-severity credential with read access to real institutional financial data. |
| Build artifacts | None — no renamed packages, no stale installed artifacts; `googleapis`/`google-auth-library` are fresh installs with no prior version to reconcile. | None. |

**Nothing found in "Stored data," "OS-registered state," or "Build artifacts"** — verified by reading `package.json`, `vercel.json`, and `supabase/migrations/` directly. "Live service config" and "Secrets/env vars" both surfaced real, actionable gaps rather than clean nothing-to-report categories, documented above rather than left blank.

## Common Pitfalls

### Pitfall 1: Assuming a column-mapping schema can be written correctly without seeing the real spreadsheet

**What goes wrong:** An implementer (or an overconfident research/planning pass) invents a plausible-looking column layout (`data, tipo, descrição, valor, categoria` — exactly this document's own Pattern 4 placeholder) and ships code as if it were verified fact, only discovering the mismatch when the first real sync either crashes on every row or silently ingests garbage into `financial_entries` because the zod schema happened to be loose enough to accept the wrong columns.
**Why it happens:** "Fixed-format" (CLAUDE.md's own phrase) sounds like a specification, inviting the assumption that a reasonable guess is close enough — but it is a claim about the sheet's temporal stability, not its actual shape, and no artifact in this repository has ever captured the real columns.
**How to avoid:** Treat the placeholder schema in Pattern 4 as EXPLICITLY provisional (it is tagged `[ASSUMED]` throughout this document and in the Assumptions Log below); require the `checkpoint:human-action` (Item 3) to happen before the plan considers `mapRowToRawEntry`/`financialEntryRowSchema` "done" — only the generic scaffolding around them should be marked complete without that checkpoint.
**Warning signs:** A plan or PR that marks the column-mapping task complete without a corresponding note that the coordenador confirmed the real layout; a zod schema with no comment distinguishing "confirmed against the real sheet" from "placeholder guess."

### Pitfall 2: Parsing `FORMATTED_VALUE` currency strings instead of requesting `UNFORMATTED_VALUE`

**What goes wrong:** The Sheets API's default response format returns cell values as their DISPLAYED string (e.g., `"R$ 1.234,56"` for a Brazilian-locale currency cell, or a date as `"03/08/2026"` rather than an ISO string) — code that assumes `row[3]` is already a JavaScript number will either throw or, worse, silently coerce/truncate it incorrectly.
**Why it happens:** The Sheets API quickstart's own example code (widely copied in tutorials) does not always show the `valueRenderOption` parameter, since many use cases genuinely want the display string.
**How to avoid:** Always pass `valueRenderOption: "UNFORMATTED_VALUE"` in the `values.get()` call (Pattern 1's example); this returns the underlying numeric/serial value directly, sidestepping locale-dependent string parsing entirely. Dates still arrive as a Sheets-internal serial number in this mode — `date-fns` alone cannot convert this; a small helper (`sheetSerialToISODate()`) or the alternative `dateTimeRenderOption: "FORMATTED_STRING"` (paired with `valueRenderOption: "FORMATTED_VALUE"` for numbers only) may be needed once the real date-column format is confirmed — flagged as an Open Question below since it depends on the still-unknown real column layout.
**Warning signs:** A parsed `valor` field containing a currency symbol or thousands separator; a parsed `data` field that is neither a plausible ISO date string nor a small integer (Sheets date serials are typically in the 40000-50000 range for 2026-era dates).

### Pitfall 3: Google Sheets API quota exhaustion from an overly chatty sync

**What goes wrong:** A naive implementation that calls `values.get()` once per row, once per sheet tab, or repeatedly within a single run (e.g., a retry loop with no backoff) can approach the documented 300 reads/minute/project or 60 reads/minute/user limits, receiving a `429: Too many requests` response [VERIFIED: developers.google.com/workspace/sheets/api/limits, official docs, checked directly this session, page updated 2026-05-29].
**Why it happens:** At this project's actual scale (one spreadsheet, one daily sync, one tab), quota exhaustion is extremely unlikely with a single `values.get()` call per run — the real risk is a FUTURE change (e.g., syncing multiple tabs, or a manual-trigger "sync now" button added later) that multiplies the call count without anyone re-checking the quota.
**How to avoid:** Fetch the ENTIRE needed range in ONE `values.get()` call per sync run (never one call per row or per column); if a future need arises to read multiple tabs/ranges in one sync, prefer `spreadsheets.values.batchGet()` (a single HTTP call for multiple ranges) over multiple separate `values.get()` calls.
**Warning signs:** Any loop that calls `sheets.spreadsheets.values.get()` more than once per cron invocation.

### Pitfall 4: A malformed or partially-edited row crashing the entire sync instead of being skipped

**What goes wrong:** A bookkeeper leaves a row half-filled (a `valor` cell accidentally cleared, a stray comment row inserted between real data rows, a totals/summary row at the bottom of the range that isn't a real financial entry) — if the parsing code throws on the first invalid row instead of catching and skipping it, the ENTIRE sync run fails, `financial_entries` is never updated, and FIN-03's status indicator shows "falha" for what is really just one bad row out of many good ones.
**Why it happens:** The natural way to write "parse this row into a typed object" is a function that throws on invalid input — correct for a single value, wrong when applied naively across an array of rows from an inherently messier, human-edited source (unlike this project's own Postgres rows, which are already schema-enforced by the database itself).
**How to avoid:** `parseSheetRows()` (Pattern 4) MUST catch each row's validation failure independently via `zod`'s `.safeParse()` (never `.parse()`, which throws) and accumulate a `skipped` list with per-row reasons, exactly mirroring Phase 7's per-recipient error isolation (07-RESEARCH.md Pitfall 4) — a single bad row degrades the run to `partial_failure` with a specific skip reason, never a total `failed` run.
**Warning signs:** A `parseSheetRows()` implementation using `.parse()` instead of `.safeParse()`, or a `try/catch` wrapping the ENTIRE row-loop rather than each row individually.

### Pitfall 5: Idempotency mismatch — treating the sheet as an append-only log

**What goes wrong:** An upsert-by-natural-key or pure-append strategy (rather than full-replace, Pattern 2) leaves stale rows in `financial_entries` forever once the bookkeeper corrects or deletes a row in the source spreadsheet — the dashboard (Phase 10) would then show financial data that no longer matches the institution's real, current cash-flow sheet, a serious correctness problem for a nonprofit's financial reporting.
**Why it happens:** Append-only/upsert-by-key are the more commonly reached-for idempotency patterns (and are in fact the CORRECT pattern for Phase 7's reminder log, which genuinely IS an append-only history) — applying that same instinct here without re-examining what "fixed-format cash-flow SPREADSHEET" actually implies (a live, editable snapshot, not a transaction log) produces a subtly wrong design.
**How to avoid:** Full-replace on every successful sync (Pattern 2) — `financial_entries` always reflects EXACTLY what the sheet currently contains, with no historical accumulation of stale or corrected rows.
**Warning signs:** Any `ON CONFLICT DO UPDATE` clause on `financial_entries`, or any code path that inserts new rows without first clearing old ones.

### Pitfall 6: Reusing `RESEND_API_KEY`'s pattern of "add to `.env.local` and forget about Vercel Production" for the new Google credential

**What goes wrong:** Phase 7 already had one instance of "works locally, fails in production because the env var was never added to Vercel" (`SUPABASE_SERVICE_ROLE_KEY`) — this phase introduces a BRAND NEW credential (`GOOGLE_SERVICE_ACCOUNT_KEY_BASE64`) with the exact same risk, compounded by the fact that base64-encoding adds one more manual step (download JSON → encode → paste) where a mistake (encoding the wrong file, truncating the string when pasting) can silently produce a credential that decodes to invalid JSON.
**Why it happens:** Each new external credential this project adds is a genuinely new manual deployment step; nothing automates "did you remember to add this to Vercel Production" across phases.
**How to avoid:** Treat "add `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` to Vercel Production" as its own explicit, named plan task with its own checkpoint (mirroring Phase 7 Pattern 4), and have the cron route fail LOUDLY and SPECIFICALLY (a clear `error_message` in `sheet_sync_runs`, e.g. "GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 ausente ou inválida") rather than a generic unhandled exception, so the coordenador's FIN-03 status indicator immediately surfaces a diagnosable cause.
**Warning signs:** A plan that mentions "deploy the sync cron route" without explicitly listing the new env var as a distinct step; a `createSheetsClient()` implementation that doesn't validate the decoded JSON's shape before use (a truncated base64 paste produces a `JSON.parse()` error that should be caught and surfaced clearly, not left as an unhandled exception).

## Code Examples

### `sheets.spreadsheets.values.get()` — the exact read call

```typescript
// src/app/api/cron/sync-sheets/route.ts (excerpt)
const sheets = createSheetsClient();

const result = await sheets.spreadsheets.values.get({
  spreadsheetId: process.env.GOOGLE_SHEET_ID!, // sheet's own ID, from its URL — public, not secret; safe as a plain env var, unlike the service-account key
  range: "Fluxo de Caixa!A2:E", // PLACEHOLDER tab/range name pending real layout (Pitfall 1)
  valueRenderOption: "UNFORMATTED_VALUE", // avoids currency-string parsing (Pitfall 2)
});

const rawValues = result.data.values ?? [];
```
Source: [CITED: developers.google.com/sheets/api/quickstart/nodejs, developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get] — exact method signature and `valueRenderOption` parameter, fetched directly this session.

### `vercel.json` — extending the existing crons array

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/sync-sheets",
      "schedule": "0 7 * * *"
    }
  ]
}
```
Two separate cron jobs, each still capped at once/day on the Hobby plan (the 1-run/day cap is PER JOB, not per project — Vercel's Hobby plan allows up to 100 cron jobs per project, so adding a second daily job does not conflict with Phase 7's existing one) [VERIFIED: this repo's own `vercel.json`, cross-checked against Phase 7's own already-fetched official Vercel docs on Hobby cron limits]. Scheduled one hour apart from the reminders job purely to avoid both cold-starting simultaneously — not a hard requirement, since the two routes touch entirely disjoint tables and have no ordering dependency on each other.

### Minimal sync-status panel (FIN-03), matching `reminder-runs-panel.tsx`'s convention

```tsx
// src/app/(dashboard)/painel/sheet-sync-status-panel.tsx
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type SheetSyncStatus = "running" | "success" | "partial_failure" | "failed";

export type SheetSyncRunRow = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: SheetSyncStatus;
  rowsSynced: number;
  rowsSkipped: number;
  errorMessage: string | null;
};

const STATUS_CONFIG: Record<
  SheetSyncStatus,
  { label: string; Icon: typeof Clock; className: string }
> = {
  success: { label: "Sincronizado", Icon: CheckCircle2, className: "text-green-700" },
  partial_failure: { label: "Sincronizado com avisos", Icon: AlertTriangle, className: "text-amber-700" },
  failed: { label: "Falha na sincronização", Icon: XCircle, className: "text-red-700" },
  running: { label: "Sincronizando…", Icon: Clock, className: "text-zinc-700" },
};

export default function SheetSyncStatusPanel({ latestRun }: { latestRun: SheetSyncRunRow | null }) {
  if (!latestRun) {
    return (
      <p className="text-xl text-zinc-700">
        Nenhuma sincronização com a planilha registrada ainda.
      </p>
    );
  }

  const { label, Icon, className } = STATUS_CONFIG[latestRun.status];
  const startedAtFormatted = format(new Date(latestRun.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR });

  return (
    <section className="flex w-full max-w-4xl flex-col gap-2">
      <h2 className="text-2xl font-semibold text-zinc-900">Sincronização financeira</h2>
      <div className="flex items-center gap-2">
        <span className="text-xl text-zinc-900">{startedAtFormatted}</span>
        <span className={`flex items-center gap-1 text-xl font-semibold ${className}`}>
          <Icon size={20} aria-hidden="true" />
          {label}
        </span>
      </div>
      {latestRun.status === "failed" && latestRun.errorMessage && (
        <p className="text-base text-red-700">{latestRun.errorMessage}</p>
      )}
    </section>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| OAuth desktop-flow quickstart (the flow Google's own `sheets/api/quickstart/nodejs` guide historically demonstrates) | Service-account JWT auth for unattended server contexts | Not a recent change — service accounts have been the standard for server-to-server Google API auth for many years; flagged here only because CLAUDE.md itself notes "the quickstart itself demoed OAuth desktop flow rather than service accounts" — the quickstart's example code is not the pattern to copy for this project's cron context | Do not follow the quickstart's literal auth code; follow Pattern 1's service-account `JWT` construction instead |

**Deprecated/outdated:** None identified specific to this phase's stack — `googleapis`/`google-auth-library` are both actively maintained with no deprecation notices found.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `financial_entries`'s column shape (`data`, `tipo`, `descricao`, `valor`, `categoria`) and the placeholder `mapRowToRawEntry` column-index mapping (`row[0]`..`row[4]`) | Pattern 4, Code Examples | **High** — this is THE genuine unknown this document repeatedly flags; if the real sheet's columns differ in count, order, or meaning, `mapRowToRawEntry` and possibly `financialEntryRowSchema`'s field list must be rewritten. Explicitly isolated (Pattern 4) to make this a small, contained change, not a re-architecture. MUST be confirmed via the `checkpoint:human-action` (Item 3) before this phase is considered complete. |
| A2 | The sheet has exactly ONE relevant tab/range to sync (`"Fluxo de Caixa!A2:E"` placeholder) | Code Examples, Pattern 1 | Medium — if the real spreadsheet spreads entradas/saídas across multiple tabs, or has a summary tab plus a detail tab, the fetch step needs `batchGet()` or multiple calls; the checkpoint (Item 3) should explicitly ask the coordenador to confirm tab structure, not just column layout |
| A3 | Full-replace-on-sync (delete all + insert all) is the correct idempotency strategy, rather than upsert-by-key or append-only | Pattern 2, Alternatives Considered, Pitfall 5 | Medium — this is a reasoned inference from "fixed-format cash-flow spreadsheet" implying a live editable snapshot (per PROJECT.md's own framing), not a confirmed fact about how the bookkeeper actually maintains the sheet (e.g., if old months are never edited and only new rows are appended, an append-safe upsert-by-date+description key might be equally correct and slightly cheaper); low-cost to change later since it's isolated to Pattern 2's single write step |
| A4 | Daily cadence (once/day, ~07:00 UTC) is sufficient for FIN-01's "on a schedule" requirement | Item 5 (referenced, see Cadence below) | Low — PROJECT.md itself describes the source sheet as manually bookkept, implying updates happen at human/business cadence (likely far less than daily); a daily sync is almost certainly MORE frequent than the source data actually changes, so this errs safely toward "no useful update missed," not toward "syncing too rarely" |
| A5 | `googleapis`/`google-auth-library`'s `[SUS]` "too-new" flags are a false positive (same class of override as Phase 7's `resend`/`react-email`), not a genuine legitimacy concern | Package Legitimacy Audit | Low — based on direct registry evidence (10-14 year registration history, consistent official `googleapis` GitHub org, tens of millions of weekly downloads, zero postinstall script) gathered this session, not training-data recall alone; residual risk is negligible but the mandatory `checkpoint:human-verify` still applies per protocol |
| A6 | `GOOGLE_SHEET_ID` (the spreadsheet's own ID from its URL) is safe to store as a plain, non-secret env var, unlike the service-account key | Code Examples | Low — a Sheets spreadsheet ID alone grants no access without a credential also having Viewer permission on that specific sheet; this matches Google's own documented model where the ID is a locator, not a credential. If the coordenador considers even the sheet's existence/ID sensitive, this can trivially be treated as a secret env var too with no code change. |

## Sequencing Recommendation: the checkpoint must come FIRST, not last

This is the single most important process recommendation in this research, called out as its own section because it inverts Phase 7/8's own established checkpoint pattern.

**Phase 7's checkpoint pattern:** Write the full cron route, run-log schema, email template, and dedup logic FIRST (all buildable from known requirements) → THEN gate deployment behind a `checkpoint:human-verify` for `RESEND_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY`/`CRON_SECRET`. The checkpoint unlocks already-written code; nothing about the checkpoint's outcome could have changed what code needed to be written.

**Phase 9 is different, and must be sequenced differently:** The checkpoint's OUTPUT — the real spreadsheet's tab name and column layout — is a required INPUT to writing `mapRowToRawEntry()` and finalizing `financialEntryRowSchema`. Waiting until the end (Phase 7's ordering) would mean building the ENTIRE phase against a placeholder, discovering the mismatch only during final verification, and potentially reworking the one piece that most needed to be right.

**Recommended task sequencing for the planner:**

1. **EARLY** — `checkpoint:human-action`: "Crie uma conta de serviço do Google Cloud, compartilhe a planilha real de fluxo de caixa com o e-mail da conta de serviço (`...@...iam.gserviceaccount.com`) como Leitor, e descreva ou tire um print da aba e das colunas da planilha (nome da aba, ordem e significado de cada coluna, formato de data e valores)." This single checkpoint resolves BOTH the credential-acquisition need (Phase 7-style) AND the layout-unknown need (Phase 9-specific) in one human interaction, since both require the coordenador to go look at the real spreadsheet.
2. **CONCURRENT with waiting on the checkpoint** — build everything in Piece A (see Summary): migration, admin client reuse, `createSheetsClient()`, the generic half of `parseSheetRows()`, run-log lifecycle, `vercel.json` entry, the `/painel` status panel. All of this is fully specified by this research and needs zero spreadsheet knowledge.
3. **AFTER the checkpoint resolves** — finalize `mapRowToRawEntry()` and `financialEntryRowSchema`'s field list against the REAL layout (a small, isolated diff per Pattern 4's design), then run one real end-to-end sync against the live sheet as the phase's tracer/verification step.
4. **LATE** — `checkpoint:human-verify` (Phase 7-style): add `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` to Vercel Production before the sync route goes live in production, mirroring Phase 7's `RESEND_API_KEY`/`SUPABASE_SERVICE_ROLE_KEY` rollout discipline exactly.

This means the phase has TWO human checkpoints, not one — an early `checkpoint:human-action` (get access + layout info) and a late `checkpoint:human-verify` (add the production secret) — structurally distinct from Phase 7's single late checkpoint, and the planner should not collapse them into one step.

## Open Questions

1. **What are the real spreadsheet's tab name, column order, and column meanings?**
   - What we know: PROJECT.md/CLAUDE.md describe it as a "fixed-format cash-flow spreadsheet" with entradas/saídas/resultado/caixa-relevant data (per Phase 10's known consumption needs); STATE.md already flags this exact unknown.
   - What's unclear: Everything about the concrete shape — tab name, header row presence, column order, whether entradas/saídas are separate columns or a signed `valor` column, date format, whether a running "caixa atual" balance is itself a column or must be computed by summing entries.
   - Recommendation: Resolve via the early `checkpoint:human-action` above before finalizing `mapRowToRawEntry`/`financialEntryRowSchema`; everything else in this phase is buildable without this answer.

2. **Does the real sheet store dates as Sheets date-serial numbers, ISO strings, or locale-formatted strings (`dd/MM/yyyy`)?**
   - What we know: `valueRenderOption: "UNFORMATTED_VALUE"` (Pattern 1/Pitfall 2) returns numeric cells as raw numbers and DATE-formatted cells as Sheets' internal serial-number representation (days since December 30, 1899), not an ISO string.
   - What's unclear: Whether the real date column is actually cell-formatted as a Date in Sheets (→ serial number) or stored as plain text (→ a string in whatever format the bookkeeper typed).
   - Recommendation: Confirm during the checkpoint (ask the coordenador or inspect a screenshot); if serial numbers, a small `sheetSerialToISODate()` helper (`new Date(Date.UTC(1899, 11, 30) + serial * 86400000)`) converts them — flagged here rather than guessed at, since getting this wrong silently shifts every `data` value by a fixed offset.

3. **Should `financial_entries` also store a `raw_row_number` or `source_row_hash` for debugging a specific sync's output against the sheet?**
   - What we know: `sheet_sync_runs.rows_skipped` plus per-skip reasons (logged, per Pitfall 4, though not necessarily persisted per-row in a first version) gives run-level visibility; nothing currently ties a specific `financial_entries` row back to its exact source sheet row for manual troubleshooting.
   - What's unclear: Whether this level of traceability is needed for v1, given the institution's small scale and that "what changed since last sync" is not one of FIN-01/FIN-03's stated requirements.
   - Recommendation: Skip for v1 — not required by FIN-01/FIN-03; a full-replace design (Pattern 2) means the CURRENT sync's output is always fully reconstructable by re-running the sync, making per-row provenance a nice-to-have rather than a functional gap. Revisit if Phase 10 or a future debugging need surfaces a real requirement for it.

4. **Should the Postgres write (Pattern 2) use a `SECURITY DEFINER` RPC function for true transactional atomicity, or is the two-round-trip delete+insert acceptable?**
   - What we know: Pattern 2 already reasons through this — the Supabase JS client doesn't expose multi-statement transactions directly, and parse-then-replace ordering already bounds the failure window to "a crash between DELETE and INSERT leaves the table empty until the next successful sync."
   - What's unclear: Whether that failure window (small, given this project's data volume and once-daily cadence) is an acceptable risk for a nonprofit's financial data, or whether the added complexity of a `.rpc()`-wrapped transaction is worth it for a genuine correctness guarantee.
   - Recommendation: Ship the simpler two-round-trip version for v1 (matches Phase 7's own precedent of not reaching for transactions where per-statement atomicity is close enough); the `financial_entries` table being briefly empty mid-sync is a transient state a coordenador is extremely unlikely to observe in practice (sync runs during off-hours, dashboard reads happen independently), and `sheet_sync_runs`'s `partial_failure`/`failed` status would surface a genuine crash regardless.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `googleapis` npm package | FIN-01 Sheets read | ✗ (not yet installed) | — | None needed — install is the whole point of this phase; `npm install googleapis` |
| `google-auth-library` npm package | Service-account auth | ✗ (not yet installed) | — | None needed — `npm install google-auth-library` |
| Google Cloud service account (external, not an npm dependency) | Authenticating to the Sheets API at all | ✗ (does not exist yet) | — | Must be created by the coordenador in Google Cloud Console — no code-level fallback; this is the early `checkpoint:human-action` |
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` (Vercel Production env var) | `createSheetsClient()` | ✗ (does not exist yet — depends on the service account existing first) | — | Must be added via `vercel env add GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 production` once the service account's JSON key is downloaded and base64-encoded (late `checkpoint:human-verify`) |
| `CRON_SECRET` in Vercel Production | Securing the new cron route | ✓ (already added in Phase 7, directly reusable) | — | None needed — Vercel injects the same `CRON_SECRET` value for every cron job in the project |
| The real Google Sheet, shared with the service account as Viewer | Any successful sync | ✗ (sharing depends on the service account existing first) | — | Must be done manually by whoever owns the sheet (the coordenador) in the Google Sheets UI — no code-level fallback |
| `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production | The cron route's admin Supabase client | ✓ (already added in Phase 7) | — | None needed — directly reusable |
| Vercel Cron (platform feature) | Scheduling the daily sync | ✓ (Hobby plan; a SECOND cron job, still within the 100-jobs-per-project limit) | — | None needed at v1's once-daily cadence |
| Google Sheets API itself (Google Cloud service) | The entire sync mechanism | ✓ (no enablement blocker beyond the service account's project having the Sheets API enabled — a one-time Google Cloud Console toggle, part of the human-action checkpoint) | — | — |

**Missing dependencies with no fallback:**
- The Google Cloud service account, the real sheet's Viewer-sharing, and `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` all form a dependency chain that MUST be resolved via the early `checkpoint:human-action` before any real (non-fixture) sync can run — no code-level workaround exists for any of these three.

**Missing dependencies with fallback:**
- None beyond what's listed above — every missing dependency in this phase is a hard requirement gated by a human checkpoint, matching Phase 7's precedent that credentials of this sensitivity always require explicit human action.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 |
| Config file | `vitest.config.ts` (existing — `fileParallelism: false`, `include: ["tests/**/*.test.ts", "src/**/*.test.ts"]`) |
| Quick run command | `npx vitest run src/lib/sheets/` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIN-01 | `parseSheetRows()` correctly separates valid rows from invalid ones (missing `valor`, wrong `tipo` enum value, empty `descricao`) into `valid`/`skipped`, never throws on a single bad row | unit | `npx vitest run src/lib/sheets/parse-rows.test.ts` | ❌ Wave 0 |
| FIN-01 | A full sync-route integration test (fixture rows, mocked `googleapis` Sheets client, real Supabase test project) proves `financial_entries` is fully replaced (old rows gone, new rows present) after a successful run | integration | `npx vitest run tests/db/sheet-sync.test.ts` | ❌ Wave 0 |
| FIN-03 | A `sheet_sync_runs` row is created at the start of a run and updated with correct `rows_synced`/`rows_skipped` at the end; a simulated mid-run failure (e.g., a thrown Sheets API error) leaves a `status='failed'` row with `error_message` populated rather than an indefinitely `'running'` row | integration | `npx vitest run tests/db/sheet-sync-run-log.test.ts` | ❌ Wave 0 |
| FIN-03 | `SheetSyncStatusPanel` renders the correct label/icon for each of the four statuses (`success`/`partial_failure`/`failed`/`running`), and the "nenhuma sincronização" empty state when `latestRun` is `null` | component | `npx vitest run src/app/\(dashboard\)/painel/sheet-sync-status-panel.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` on the touched test file(s)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/sheets/parse-rows.test.ts` — pure-unit tests for `parseSheetRows()`'s per-row validation/skip logic, built against FIXTURE rows (not the real sheet) — exercises both the placeholder schema's happy path and its rejection cases (missing field, wrong type, empty string)
- [ ] `tests/db/sheet-sync.test.ts` — live-integration test (guarded by `describe.skipIf(!process.env.SUPABASE_SERVICE_ROLE_KEY)`, following `tests/db/demandas-rls.test.ts`'s established pattern) proving the full-replace write behavior against a real Supabase test project, with the Google Sheets client MOCKED (`vi.mock("googleapis")`, mirroring how `tests/db/reminder-dedup.test.ts` mocks `Resend`) — no real Google API calls in the automated test suite
- [ ] `tests/db/sheet-sync-run-log.test.ts` — live-integration test proving `sheet_sync_runs` rows are created/updated correctly across success, partial-failure, and thrown-exception scenarios, mirroring `tests/db/reminder-run-log.test.ts`'s structure exactly
- [ ] Migration file `supabase/migrations/0006_sheet_sync.sql` — creates `sheet_sync_runs` and `financial_entries` with RLS enabled (coordenador AND financeiro SELECT, per FIN-04's eventual role scope even though Phase 10 is the phase that actually builds the dashboard reading it — see Security Domain below for why financeiro is included now, not deferred)
- [ ] Component test for `sheet-sync-status-panel.tsx` — verifies all four status renders plus the empty state, following the same colocated-test convention as any Phase 8 component tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (reused shape) | Identical to Phase 7 — the cron route authenticates the REQUEST via `CRON_SECRET` Bearer-token comparison, not an end-user session; the NEW piece is the cron route itself authenticating OUTBOUND to Google as a service account (`google-auth-library`'s JWT client) — a second, distinct authentication relationship this route participates in |
| V3 Session Management | no | No session is created, read, or relevant to the cron route — stateless per invocation, same as Phase 7 |
| V4 Access Control | yes | The service-role Supabase client bypasses RLS by design for the WRITE path (same justification as Phase 7 — no untrusted external actor influences what this route writes, only Google Sheets API response data flowing through validated zod parsing first); the coordenador/financeiro-only READ of `sheet_sync_runs`/`financial_entries` on `/painel` IS RLS-gated (new SELECT policy) |
| V5 Input Validation | **yes — new for this phase** | Unlike Phase 7 (no untrusted payload reaches the cron route), THIS phase's cron route DOES ingest genuinely untrusted external data — a human-editable spreadsheet's cell values — and the `zod` `financialEntryRowSchema` (Pattern 4) is the actual input-validation boundary; this is the first cron-context phase in this project where V5 meaningfully applies |
| V6 Cryptography | no (delegated) | `CRON_SECRET` comparison is unchanged from Phase 7 (shared-secret string equality, not custom crypto); the service-account JWT signing (RS256) is entirely handled by `google-auth-library` — no custom cryptographic code is written in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` leaking via a logging statement, error message, or accidental client-bundle inclusion | Information Disclosure / Elevation of Privilege | Never log the decoded key or raw env var; `createSheetsClient()` (`src/lib/sheets/client.ts`) is the sole place this key is read, mirroring `admin.ts`'s existing "one place only" discipline; a negative grep (`grep -r GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 src/app` excluding the one cron route and `lib/sheets/client.ts`) should find zero other occurrences |
| A malicious or malformed spreadsheet row attempting a SQL-injection-style payload in a text cell (e.g., `descricao` containing `'; DROP TABLE...`) | Tampering | The Supabase JS client's `.insert()` uses parameterized queries under the hood (PostgREST), not string-concatenated SQL — no custom SQL-string building exists anywhere in this phase's write path, so this class of injection is structurally not reachable; `zod`'s `z.string()` validation additionally bounds what reaches the insert at all |
| An external attacker discovering `/api/cron/sync-sheets` and repeatedly triggering it, attempting to exhaust the Google Sheets API quota (300 reads/min/project) or cause repeated unnecessary full-table replaces | Denial of Service | Identical mitigation to Phase 7 — `CRON_SECRET` Bearer-token check rejects any request without the exact matching header (401) before any Google or Supabase call is made |
| The service-account JSON key granting broader access than intended (e.g., if a human accidentally uses a key with write/edit-level Google Drive scopes rather than a narrowly-scoped read-only Sheets credential) | Elevation of Privilege | Explicit `scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]` in the JWT client construction (Pattern 1) — even if the service account's Google Cloud IAM role were broader than needed, the JWT request itself only asks for read-only Sheets access, and Google's OAuth scope-narrowing means the resulting token cannot exceed what was requested |
| A future edit accidentally imports `createAdminClient()` (service-role) or `createSheetsClient()` into a user-facing Server Component or Server Action | Elevation of Privilege | Same convention Phase 7 established — restrict both factories, by code-review convention, to files under `src/app/api/cron/` only |

## Sources

### Primary (HIGH confidence)
- `package.json`, `vercel.json`, `supabase/migrations/0001-0005_*.sql`, `src/lib/supabase/admin.ts`, `src/app/api/cron/reminders/route.ts`, `src/app/(dashboard)/painel/page.tsx`, `src/app/(dashboard)/painel/reminder-runs-panel.tsx`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/07-email-reminders/07-RESEARCH.md` — read directly, this repo — confirms `googleapis`/`google-auth-library` not yet installed, next migration is `0006_*.sql`, `financeiro` role exists in `app_role` enum but has no dedicated RLS predicate yet, `CRON_SECRET` already live in Vercel Production and reusable, STATE.md's own explicit "Phase 9 spreadsheet layout unknown" flag corroborating this research's central finding
- `npm view googleapis version/time.created/scripts.postinstall`, `npm view google-auth-library version/time.created/scripts.postinstall`, `npm view @googleapis/sheets version/time.created` — registry lookups performed directly this session [VERIFIED: npm registry]
- `gsd-tools query package-legitimacy check --ecosystem npm googleapis google-auth-library` — legitimacy seam output, both flagged `[SUS]` on the same "too-new-latest-version" automated heuristic Phase 7 already documented and overrode for `resend`/`react-email`
- https://developers.google.com/sheets/api/quickstart/nodejs, https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get, https://developers.google.com/workspace/sheets/api/limits — official Google Sheets API docs, fetched directly this session — exact `values.get()` call shape, `valueRenderOption`/`majorDimension` parameters, 300/min/project + 60/min/user quota confirmed current (page updated 2026-05-29)
- https://github.com/googleapis/google-auth-library-nodejs (README, service-account JWT section) — official repo docs, fetched directly this session — `JWT`/`GoogleAuth` client construction from `email`/`key` credential fields, `GoogleAuth.fromJSON()` for env-var-sourced credentials

### Secondary (MEDIUM confidence)
- WebSearch (multiple independent sources) — Vercel env var multiline-PEM handling: base64-encoding the whole key file as the verified-safe pattern, vs. `\n`-escaping's documented inconsistency across paste methods
- WebSearch — Google Sheets API quota numbers cross-checked against CLAUDE.md's own already-documented figures (300/min/project, 60/min/user) — consistent, no drift found

### Tertiary (LOW confidence)
- The actual spreadsheet column layout, tab name, and date-format convention — this is NOT a research gap that could have been closed with more searching; it is a genuine unknown requiring a human to inspect a specific institutional document that exists outside any documentation this research had access to. Explicitly flagged throughout (Pattern 4, Pitfall 1, Assumptions Log A1/A2, Sequencing Recommendation) rather than guessed at and presented as fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `googleapis`/`google-auth-library` current versions, registration dates, and absence of postinstall scripts are all confirmed via direct npm registry queries, not training-data recall
- Architecture: HIGH — the cron+service-role+run-log+RLS+`/painel`-panel shape is verified by reading Phase 7's own production implementation directly in this repo, not inferred from general Vercel/Supabase knowledge
- Pitfalls: HIGH for the generic/infrastructure pitfalls (quota, idempotency, credential rollout — all traceable to official docs or this repo's own Phase 7 precedent); **LOW for anything touching the real column layout** (Pitfall 1's whole premise is that this is currently unknown, not merely under-researched)

**Research date:** 2026-08-04
**Valid until:** 2026-09-03 (30 days for the architectural/library findings — stable, official Google SDKs with no deprecation signals. However, the column-layout placeholder (Pattern 4, Assumptions Log A1) has NO validity window in the normal sense — it remains provisional indefinitely until the `checkpoint:human-action` resolves it, regardless of how much time passes.)

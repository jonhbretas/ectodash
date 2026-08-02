# Stack Research

**Domain:** Lightweight internal web app for a nonprofit — task/demand management with roles, email reminders, AI meeting-summary ingestion, and a financial dashboard synced from Google Sheets. Must run entirely on Vercel + Supabase free tiers, with an elderly-heavy volunteer user base requiring simple, accessible UX.
**Researched:** 2026-08-02
**Confidence:** MEDIUM (web-search-verified across multiple independent sources and official pricing/docs pages; no Context7 MCP available in this environment, so treat exact numeric limits as "verify at build time" rather than gospel — free-tier numbers do shift)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x (16.2+) | Full-stack React framework, App Router, API routes/Server Actions, Vercel-native | Zero-config deploy on Vercel, Server Components minimize client JS shipped to older/slower devices, Server Actions give a simple mutation model (create/update demanda without hand-rolled API+fetch), Turbopack is stable by default for fast local iteration. This is the de-facto default for anything deploying to Vercel in 2026. |
| React | 19.x (bundled with Next 16) | UI runtime | Ships with Next 16; `useActionState` + Server Actions give a clean form-submit-with-server-validation loop without extra client state libraries — important for keeping the codebase small and maintainable by a small/volunteer dev team. |
| TypeScript | 5.x | Type safety across DB rows, Server Actions, email payloads, Sheets sync | With Supabase's generated types + Zod schemas shared client/server, TypeScript catches "wrong shape passed to email template" or "role string typo in RLS check" at compile time — valuable given this is unpaid/volunteer-maintained software with no dedicated QA. |
| Supabase (Postgres + Auth + Storage) | Supabase JS client v2.x | Database, authentication, row-level authorization, (optional) file storage | Single free-tier backend covering DB, auth, and RLS-based authorization in one service — avoids standing up a separate auth provider. Postgres also gives real relational integrity for demandas/responsáveis/prazos, which a NoSQL free tier (e.g. Firestore) would make harder to query for the coordinator's "who's late" view. |
| Vercel (Hobby/free) | — | Hosting, deployment, cron scheduling | Pairs natively with Next.js (same company), free SSL/CDN, built-in Cron Jobs cover the reminder-check trigger without a separate scheduler service. Explicitly allowed for non-commercial/internal tools (see "What NOT to Use" for the licensing caveat). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/ssr` | ^0.x (latest) | Cookie-based session handling for Next.js App Router + Supabase Auth | Always — this is the current supported replacement for the deprecated `@supabase/auth-helpers-nextjs`; use it for both Server Components (read session) and Server Actions/Route Handlers (mutate). |
| `resend` | ^4.x | Transactional/reminder email sending | Whenever a demanda reminder needs to be emailed. Use with a verified sending domain (see Pitfalls) and `scheduledAt` only for near-term (<30 day) scheduling — for recurring "check what's due" logic, trigger from Vercel Cron instead of relying on Resend's own scheduler. |
| `react-email` + `@react-email/components` | ^4.x / latest | Email templates as React components | Any time you're building the reminder/overdue-task email — keeps the visual design (large text, high contrast, per elderly-UX constraint) consistent and testable in isolation from the main app. |
| `zod` | ^3.x / ^4.x | Schema validation shared between client forms, Server Actions, Sheets-row parsing, and AI JSON output | Everywhere structured data crosses a boundary: form input, Server Action input, Google Sheets row → typed record, and validating the AI's extracted-task JSON before inserting into the DB. This is the single highest-leverage library in this stack because it's reused across 4 of the 5 core features. |
| `react-hook-form` + `@hookform/resolvers` | ^7.x / ^3.x | Client-side form state + Zod integration | For any form with more than 2-3 fields (demanda creation/edit, financial dashboard filters) — gives inline validation messages, which matters for the elderly-user requirement of "does this form field look right before I submit." For 1-2 field forms (e.g. login), skip it — a plain Server Action is simpler. |
| `googleapis` (official Google API Node.js client) | ^144.x (latest) | Read the cash-flow Google Sheet server-side | Use only the `sheets.spreadsheets.values.get` surface with a **service account** (not OAuth desktop flow) — service accounts don't require a human to click through a consent screen and don't expire the way user OAuth refresh tokens can if unused. Share the spreadsheet with the service account's `...@...iam.gserviceaccount.com` email as Viewer. |
| `google-auth-library` | ^9.x | JWT auth for the service account | Pulled in alongside `googleapis`; used to build the authenticated client from the service-account JSON key stored as a Vercel env var (never commit the key file). |
| `@google/genai` (Gemini SDK) or plain `fetch` to Gemini REST API | latest | AI summarization + structured task extraction from pasted meeting transcripts | Primary AI provider recommendation (see rationale below). Use `responseSchema`/function-calling to force JSON shape (title, responsible, deadline) matching your Zod schema. |
| Recharts | ^3.x | Financial dashboard charts (cash flow line/bar, monthly result) | Default charting choice — see Alternatives Considered for when Tremor is better. |
| date-fns | ^4.x | Date math for "prazo próximo/atrasado" (due-soon/overdue) logic and formatting deadlines in reminder emails | Anywhere you compute "is this deadline within N days" or format a date for a non-technical user (`dd/MM/yyyy`, Portuguese locale) — lighter and more tree-shakeable than Moment/Luxon for this scope. |
| shadcn/ui (+ Radix UI primitives, Tailwind CSS) | latest CLI | Accessible UI components (dialog, dropdown, table, form, alert) | Use for every interactive component. It's not an npm dependency — the CLI copies component source into your repo, so you can directly increase font sizes, touch-target padding, and contrast ratios per the elderly-user requirement without fighting a black-box library's theming API. |
| Tailwind CSS | ^4.x | Styling (required by shadcn/ui) | Comes bundled with the shadcn/ui setup; use utility classes for the accessibility-driven design tokens (larger `text-lg`/`text-xl` base sizes, generous `p-4`/`gap-4` spacing for tap targets). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Supabase CLI | Local Postgres, migrations, type generation (`supabase gen types typescript`) | Run migrations as versioned SQL files in the repo (not through the dashboard UI) so RLS policies are code-reviewed and reproducible — critical since RLS is your only authorization layer. |
| Vercel CLI (`vercel dev`) | Local dev matching production runtime | Use to test Cron-triggered API routes locally (`vercel dev` respects `vercel.json` cron config for manual invocation) before relying on the once-daily production schedule. |
| ESLint + `eslint-config-next` | Lint | Ships with `create-next-app`; keep default rules, add `eslint-plugin-jsx-a11y` explicitly since accessibility is a hard project requirement, not just nice-to-have. |

## Installation

```bash
# Core
npx create-next-app@latest ectodash --typescript --tailwind --eslint --app
cd ectodash
npm install @supabase/supabase-js @supabase/ssr

# Supporting
npm install zod react-hook-form @hookform/resolvers date-fns recharts
npm install resend react-email @react-email/components
npm install googleapis google-auth-library
npm install @google/genai

# shadcn/ui (adds components as source files, not a runtime dependency)
npx shadcn@latest init
npx shadcn@latest add button input dialog dropdown-menu table form alert card badge

# Dev dependencies
npm install -D eslint-plugin-jsx-a11y
npm install -D supabase --save-dev   # or install Supabase CLI globally
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Supabase (Postgres) | Firebase/Firestore | If the team is more comfortable with document-model NoSQL and doesn't need relational reporting (the "who's late across all demandas/áreas" coordinator view is much harder to express well in Firestore queries) — not recommended here. |
| Recharts (direct) | Tremor | If the team wants a faster path to a good-looking dashboard and is fine with less customization and a bundle ~50kB heavier; Tremor is Recharts-based and pairs visually with shadcn/ui, so it's a reasonable swap if development speed matters more than fine control. |
| Gemini 2.5 Flash / Flash-Lite | OpenAI GPT-4o mini / GPT-5.x mini | Use OpenAI if you need the strongest JSON-schema enforcement guarantee (OpenAI's Structured Outputs mode has stricter, more mature schema adherence than Gemini's function-calling-based schema mode) and the marginal cost difference (a few cents/month at this volume) is irrelevant. |
| Email/password (Supabase Auth) | Magic link (passwordless OTP) | If institutional email inboxes are reliably checked in real time and password-reset support requests are a bigger worry than "switch to email app to log in" friction — magic link removes password-related support tickets entirely at the cost of an extra step every login. |
| react-hook-form + Zod | Plain Server Actions + `useActionState` only | For very short forms (1-2 fields, e.g. login, quick status toggle) — skip react-hook-form entirely; it adds unneeded complexity for trivial forms. |
| Vercel Cron (daily) | GitHub Actions scheduled workflow calling your API route | If you need reminder checks more than once per day, since Hobby-tier Vercel Cron is capped at one run/day per job — a free GitHub Actions cron (as frequent as every 5-15 min in practice) calling a protected Next.js API route is a common, free workaround. |
| `googleapis` service account | Third-party Sheets sync tool (e.g. Zapier, Make, SheetDB) | If the team wants zero custom code for the sync and is willing to accept a paid tier once free automation-run quotas are exceeded — not recommended given the "zero/low budget" constraint. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Vercel Hobby plan for anything resembling a paid/commercial product | Vercel's Hobby ToS explicitly prohibits commercial use (SaaS, e-commerce, client work); this project is an internal nonprofit tool so it's fine, but don't let scope creep turn it into a product sold to other nonprofits without upgrading to Pro. | Vercel Pro if the project ever needs to serve external paying customers. |
| `@supabase/auth-helpers-nextjs` | Deprecated in favor of `@supabase/ssr`; older tutorials still reference it and it will silently mis-handle session cookies in newer Next.js App Router versions. | `@supabase/ssr` |
| Relying solely on client-side role checks (hiding UI buttons) for authorization | Anyone can call your Server Actions/API routes directly, bypassing hidden UI — this is a real security hole for the Financeiro-only financial data. | Supabase RLS policies as the actual authorization boundary; client-side hiding is UX polish only. |
| Storing the Google service-account JSON key in the repo or client-exposed env vars | It's a long-lived credential with read access to the institution's real cash-flow sheet; leaking it is a real financial-data exposure. | Store as a Vercel **server-only** environment variable (never `NEXT_PUBLIC_*`), read only inside Server Actions/Route Handlers/Cron routes. |
| Building a custom meeting-transcription/audio pipeline for v1 | Explicitly out of scope per PROJECT.md — reuse of Fireflies/tl;dv pasted text is deliberate to avoid audio-processing complexity and cost. | Plain textarea paste of exported transcript text, sent to Gemini/OpenAI for summarization + extraction. |
| Un-styled default browser form controls / low-contrast component themes | Fails the explicit elderly-accessibility requirement — default shadcn theme is fine as a base but default font sizes (14-16px) and low-contrast muted grays are too small/low-contrast for this audience. | shadcn/ui customized with a larger base font size (e.g. 18px body), AA/AAA contrast-checked palette, and `eslint-plugin-jsx-a11y` enforced. |
| A generic Kanban/PM tool (Trello/Asana/Monday) instead of building this | Would require a paid tier at real usage levels, doesn't natively support the financial-dashboard + Sheets-sync + AI-ingestion combination this project needs, and adds a second login/UX surface for an already accessibility-sensitive user base. | The custom Next.js + Supabase app described here. |

## Stack Patterns by Variant

**If reminder timing must be more granular than "once per day":**
- Use a free external scheduler (GitHub Actions cron, or a free tier of cron-job.org/EasyCron) to call a protected Next.js API route every 15-60 minutes.
- Because Vercel Hobby Cron Jobs are hard-capped at one run per day per job — a documented, official platform limit, not a bug to work around later.

**If the Supabase project risk of "auto-pause after 1 week idle" becomes a problem (e.g. during low-activity periods for a volunteer org):**
- Use the same daily Vercel Cron job (or the reminder-check job) to also perform a trivial read query against Supabase, which counts as API activity and resets the inactivity clock.
- Because free-tier Supabase projects pause after 7 days with zero API requests, and a paused project would silently break both the reminder emails and the coordinator dashboard until someone manually resumes it.

**If the AI extraction needs to be very cheap/high-volume (many meetings/month):**
- Use Gemini 2.5 Flash-Lite with a strict `responseSchema` (function-calling style) for structured task extraction, reserving Flash (non-Lite) or GPT-4o mini only for the free-text summary paragraph if quality there is unsatisfying with Lite.
- Because per-meeting summarization+extraction cost is trivially small at Flash-Lite pricing, and a nonprofit with true zero AI budget can likely stay within Google's free API tier at weekly-meeting volume.

**If the financial dashboard needs richer, pre-styled components fast (e.g. a volunteer developer with limited time):**
- Use Tremor instead of raw Recharts for the KPI cards + charts.
- Because Tremor trades ~50kB and some chart-type flexibility for dramatically less time spent hand-styling axes/legends/tooltips — reasonable given limited dev bandwidth on a volunteer project.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| Next.js 16.x | React 19.x (bundled), Node.js 20.9+ | Next.js 16 requires a current Node LTS; confirm your Vercel project's Node version setting matches (Vercel defaults to a current LTS automatically for new projects). |
| `@supabase/ssr` | Next.js App Router (13.4+), including 16.x | This is the only supported SSR session-handling path for current Next.js versions; do not mix with the old `auth-helpers` package. |
| shadcn/ui CLI | Tailwind CSS v4.x, React 19 | Recent shadcn/ui versions target Tailwind v4 by default; if you scaffold with `create-next-app`'s default Tailwind version, let the shadcn `init` step configure/upgrade Tailwind config rather than hand-merging configs. |
| react-hook-form v7.x | `@hookform/resolvers` v3.x + Zod v3.x/v4.x | Confirm resolver package major version matches your Zod major version at install time — resolver releases track Zod's breaking changes. |
| `googleapis` npm package | Node.js 20+ | Large package (bundles all Google API clients); consider importing only `googleapis/build/src/apis/sheets` or the smaller `@googleapis/sheets` scoped package if Vercel function cold-start size becomes a concern (unlikely at this scale, but worth knowing). |

## Sources

- https://nextjs.org/docs, https://nextjs.org/blog/next-16, https://nextjs.org/blog/next-16-2 — verified Next.js 16.x current stable, App Router default, React 19 base (MEDIUM confidence, cross-checked across official blog + docs + independent search)
- https://supabase.com/pricing — official free-tier limits: 500MB DB, 1GB storage, 50k MAU, 5GB egress, 500k edge function invocations, 2 active projects, 7-day inactivity auto-pause (MEDIUM, official page + independent search cross-check)
- https://supabase.com/docs/guides/auth/row-level-security — RLS RBAC pattern guidance: roles table + SECURITY DEFINER function vs JWT app_metadata claims (LOW-MEDIUM, official docs fetched directly but not cross-verified against a second independent source)
- https://vercel.com/docs/limits, https://vercel.com/docs/cron-jobs — official Hobby plan limits: 60s max function duration, 1M invocations/mo, 100 cron jobs/project capped at 1 run/day (LOW-MEDIUM, official docs, cron frequency cap cross-checked via independent search)
- https://resend.com/pricing, https://resend.com/docs/send-with-nextjs — free tier 3,000 emails/mo / 100/day / 1 domain, Next.js SDK integration pattern (LOW-MEDIUM, official docs)
- https://ui.shadcn.com/docs — shadcn/ui as a code-distribution model over Radix UI primitives (LOW-MEDIUM, official docs)
- https://developers.google.com/sheets/api/quickstart/nodejs, https://developers.google.com/workspace/sheets/api/limits — Sheets API Node.js pattern and quota: 300 reads/min/project, 60 reads/min/user (MEDIUM, official quickstart + independent quota search cross-check; quickstart itself demoed OAuth desktop flow rather than service accounts, service-account pattern is standard industry knowledge cross-checked via search)
- Web search (multiple independent sources, Aug 2026) — AI pricing comparison Gemini Flash/Flash-Lite vs GPT-4o mini/GPT-5 mini vs Claude Haiku 4.5, and OpenAI Structured Outputs vs Gemini schema enforcement (MEDIUM)
- Web search (multiple independent sources) — Recharts v3 vs Tremor bundle size/flexibility tradeoff (MEDIUM)
- Web search (multiple independent sources) — elderly-user accessible UI patterns: font size, contrast, touch targets, shallow navigation (MEDIUM)

---
*Stack research for: Nonprofit volunteer/demand management internal web app (EctoDash)*
*Researched: 2026-08-02*

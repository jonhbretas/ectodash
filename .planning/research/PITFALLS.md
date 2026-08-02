# Pitfalls Research

**Domain:** Nonprofit volunteer/demand management system — scheduled email reminders (Vercel + Resend + Supabase free tier), AI extraction of tasks from meeting-summary text, Google Sheets-synced financial dashboard, elderly-heavy accessible UX
**Researched:** 2026-08-02
**Confidence:** MEDIUM (cross-referenced multiple independent sources per topic; no official-vendor primary docs consulted directly — treat exact numeric limits as directional and re-verify against Vercel/Resend/Supabase docs before build)

## Critical Pitfalls

### Pitfall 1: Supabase free-tier project auto-pause silently kills all reminders and syncs

**What goes wrong:**
Supabase pauses free-tier projects after 7 days with no real database activity (not just a connection — an actual query/write). Once paused, `pg_cron` jobs stop firing and Edge Functions become unreachable. Because EctoDash's core value proposition is "coordinator never has to chase people manually," a paused project means reminder emails silently stop going out and the financial sync silently stops updating — with no error surfaced to anyone, because there's no user actively hitting the app to notice. If left paused too long, Supabase permanently deletes the project and its data.

**Why it happens:**
Nonprofit usage is bursty — weekly meetings, monthly financial checks — so genuine idle periods of 7+ days are plausible, especially between milestone/holiday breaks or during quiet stretches for a volunteer org. Developers assume "the cron job running" counts as activity, but if the job's own query doesn't touch the DB with a write, the pause clock isn't reset by the job itself in all cases — the safest read is that any project relying purely on `pg_cron` to keep itself alive is fragile.

**How to avoid:**
- Schedule a lightweight external keep-alive request (e.g., Vercel cron hitting a Supabase Edge Function or a trivial `UPDATE` on a heartbeat row) at least every 5–6 days, independent of the reminder logic.
- Treat the reminder cron job itself as suspect for keep-alive purposes — verify it performs a real write (e.g., logging a "reminder sent" row) rather than a pure read.
- Add a simple uptime/health-check monitor (even a free one like UptimeRobot or a Vercel cron that pings an admin webhook) that alerts if the app hasn't executed a scheduled job successfully in N days.

**Warning signs:**
- Reminder emails stop arriving with no error in Resend logs (because the function never ran).
- Financial dashboard numbers appear frozen/stale despite the Google Sheet being updated.
- Supabase dashboard shows project status as "Paused" when the coordinator logs in after a quiet week.

**Phase to address:**
Foundational/infrastructure phase (whichever phase sets up Supabase + Vercel cron) — build the keep-alive heartbeat and a failure-visible health check before the reminder feature is considered "done," not as a bolt-on later.

---

### Pitfall 2: Vercel cron's "fire and forget" model means reminder failures go unnoticed

**What goes wrong:**
Vercel Hobby (free) cron jobs have no automatic retries on failure, no built-in alerting, a hard 10-second execution ceiling, only hourly timing precision (not exact-minute), UTC-only scheduling, and no protection against overlapping runs if a job occasionally runs long. If the reminder-sending function throws (e.g., Resend API hiccup, a malformed row, a timeout fetching due-soon demandas), the job is logged as failed and nothing retries it and nobody is told — reminders for that day simply don't go out, and there's no automatic catch-up.

**Why it happens:**
Free-tier serverless cron products are built for lightweight housekeeping, not mission-critical notification pipelines. Teams building an MVP on zero budget correctly pick Vercel cron for cost reasons but then implicitly treat it like a reliable job queue, which it isn't at the Hobby tier.

**How to avoid:**
- Keep the reminder cron function's actual work under a few seconds — do heavy lifting (querying overdue demandas, formatting emails) efficiently, batch-send via Resend, and log outcomes to a table.
- Make the job idempotent and re-runnable: track "last reminder sent" per demanda/date so a manual or delayed re-trigger doesn't double-send.
- Log every run's outcome (success/fail, count sent) to a Supabase table, and add a lightweight secondary check (e.g., the coordinator's dashboard shows "last reminder run: [timestamp], N sent" prominently) so silent failure is visually obvious rather than invisible.
- Because Hobby-tier cron cannot run more than once/day, design the reminder cadence around a single daily run rather than assuming intraday precision; if a daily digest doesn't suffice, budget for Pro tier before promising more granular reminders.

**Warning signs:**
- Coordinator or volunteers report "I never got a reminder" with no corresponding error visible anywhere.
- Vercel deployment logs show scattered 500s on the cron endpoint with no follow-up action taken.
- Reminders arrive inconsistently at different times of day (expected — hourly precision only — but should not be mistaken for a bug).

**Phase to address:**
Reminder/notification phase — build the run-log table and dashboard status indicator as part of the initial reminder feature, not deferred to a "monitoring" phase that may never arrive.

---

### Pitfall 3: Resend free-tier quota exhaustion or a policy strike silences all email at once

**What goes wrong:**
Resend's free tier caps out at a low daily/monthly volume (order of 100/day, 3,000/month). A volunteer org with dozens of active demandas each generating reminder emails (plus any account-related or financial-alert emails) can plausibly hit that ceiling faster than expected once the system is fully adopted, especially if reminders are sent per-demanda rather than batched per-person. Separately, if transactional reminders share the same sending domain/account as anything that looks like bulk or promotional mail, a spam complaint or policy flag can suspend sending entirely — silently breaking every notification the app relies on.

**Why it happens:**
Volume is easy to underestimate at design time ("just a few reminders a day") but scales with number of active demandas × number of overdue-day thresholds × recipients per demanda. Nobody notices the ceiling until it's hit, because free-tier email limits don't typically produce loud, visible errors to end users — they show up in Resend's own dashboard/logs, which nobody but the developer checks routinely.

**How to avoid:**
- Batch reminders: one digest email per volunteer per day covering all their overdue/upcoming demandas, rather than one email per demanda. This is also better UX for an elderly-heavy audience (fewer emails to parse) and dramatically cuts volume.
- Track sent-email counts against the free-tier ceiling and alert the coordinator (in-app banner, not just email — since email is the thing that might be broken) as usage approaches the cap.
- Keep the sending domain/account dedicated purely to this app's transactional mail; never route any bulk/newsletter-style sends through the same Resend account or domain.
- Plan a clear, cheap upgrade path (Resend's paid tier is inexpensive) as a fallback the coordinator can trigger manually if the free cap becomes a real constraint — flag this as a likely near-term cost even under the "zero-budget" constraint.

**Warning signs:**
- Resend dashboard shows daily send count creeping toward the cap.
- Some volunteers report receiving reminders while others (who joined more demandas later that day) do not.
- Sending suddenly stops entirely across the whole app with no application-level error — check Resend's account status/logs, not just the app's own logs.

**Phase to address:**
Reminder/notification phase — design the batching strategy (digest, not per-item) from the start; add usage-ceiling visibility in the same phase, not as an afterthought.

---

### Pitfall 4: LLM extraction of demandas from meeting text silently fabricates or misses owners/deadlines

**What goes wrong:**
When asking an LLM to turn pasted meeting-summary text into structured tasks (owner + deadline), common failure modes include: hallucinating an owner or deadline that wasn't actually stated (e.g., inferring "next week" as a hard date, or attributing an action item to the wrong person when multiple names appear near it); returning empty or partial results when the summary is unusually formatted; echoing placeholder/example values from the prompt's few-shot examples instead of real extracted values; and producing a plausible-looking but wrong JSON structure that passes schema validation while being factually incorrect. Because the whole point of this feature is to save the coordinator from manually re-entering tasks, a wrong owner or deadline that goes unnoticed creates a demanda nobody actually owns or a false due date — arguably worse than not automating at all, since it creates false confidence in the system's accuracy.

**Why it happens:**
Meeting-summary text from tools like Fireflies/tl;dv is informal, conversational, and often ambiguous about exactly who owns what ("Maria vai ver isso" vs. "alguém precisa verificar isso até sexta") and dates are frequently relative ("até semana que vem", "até o fim do mês") rather than absolute. LLMs are good at producing confident, well-formatted output even when the underlying extraction is uncertain — the failure is invisible unless someone checks.

**How to avoid:**
- Never auto-commit AI-extracted demandas directly into the live task list. Always route extraction output through a review/confirm screen where the coordinator or meeting owner sees each proposed demanda (title, owner, deadline) with the exact source snippet it came from, and must approve/edit/reject before it's created.
- Force relative dates to be resolved against the meeting's actual date (pass the meeting date into the prompt explicitly so "semana que vem" resolves correctly) rather than letting the model guess an absolute date.
- If the model cannot confidently identify an owner or deadline, it should return that field as null/uncertain rather than guessing — design the prompt and schema to allow "unknown" rather than forcing every field to be filled, and surface unknowns to the reviewer explicitly rather than silently defaulting.
- Log the raw source paragraph alongside each generated demanda so a human can always trace an extraction back to what was actually said.

**Warning signs:**
- Demandas appear with owners who deny ever agreeing to them, or deadlines that don't match what was discussed.
- The review screen is being rubber-stamped (coordinator clicking "approve all" without reading) — this is a process risk, not a technical one, but should be watched for since it defeats the safeguard.
- Extraction consistently fails or returns malformed output on certain meeting formats (e.g., very long transcripts, bilingual text, heavy use of nicknames).

**Phase to address:**
AI extraction/demanda-generation phase — the human-in-the-loop review step is not optional polish, it is the core safety mechanism for this feature and must ship in the same phase as the extraction itself, not as a "trust the AI" v1 with review added later.

---

### Pitfall 5: Google Sheets sync breaks silently due to sheet structure changes outside the app's control

**What goes wrong:**
Because the existing cash-flow spreadsheet is maintained manually and the app must adapt to it (not replace it), the sync is fragile to anything a human does in the sheet: inserting a new column, adding formulas that recompute on every read, leaving stray empty rows (causing new entries to land after the last "visible" row and be missed by range-based reads), applying a filter view that makes edits look saved but not actually persisted for other viewers/API reads, or renaming a header the parser keys off of. None of these are "bugs" from the spreadsheet maintainer's point of view — they're normal spreadsheet usage — but they can silently desynchronize the dashboard from reality, showing stale or wrong financial numbers to the financial role and coordinator without any visible error.

**Why it happens:**
The sheet is owned and edited by a human who is not thinking about the app's parsing assumptions. A fixed format today can drift over time (someone adds a "Notas" column, someone applies a filter to review last month, someone deletes what looks like a blank row). The app has no way to distinguish "the sheet's data actually changed" from "the sheet's data is unreadable/misread."

**How to avoid:**
- Parse by header name/named ranges, never by fixed column index or row number, so column reordering doesn't silently corrupt the mapping.
- Validate on every sync: check expected headers exist, check row types are parseable (dates are dates, amounts are numbers), and if validation fails, do NOT silently fall back to stale/partial data — surface a clear "sync failed, sheet format changed" state in the dashboard rather than quietly showing old numbers as if current.
- Read using the Sheets API rather than assuming a filter-free, formula-free range; be aware that filter views applied by a human can make the API read data that looks saved but isn't reflected for others — test this scenario explicitly.
- Show a visible "last successfully synced at [timestamp]" indicator on the financial dashboard at all times, so a stale sync is self-evident rather than requiring investigation.
- Establish (even informally) a lightweight contract with whoever maintains the sheet: which columns/headers must never be renamed or reordered, and log/alert when that contract appears violated.

**Warning signs:**
- Dashboard totals don't match what's visibly in the sheet when someone opens it directly.
- "Last synced" timestamp is stale but nobody notices because there's no indicator, or the indicator exists but is easy to miss.
- Sync job errors appear in logs but don't propagate to any user-facing signal.

**Phase to address:**
Financial dashboard/sync phase — header-based parsing, validation-before-display, and the visible last-synced indicator should be built together as the sync's initial implementation, not added after a data-quality incident.

---

### Pitfall 6: Accessible-by-checklist UX still fails elderly volunteers in practice

**What goes wrong:**
Teams often treat "accessibility for elderly users" as a checklist (big font, high contrast, done) while still shipping interfaces with real friction: multi-step flows without clear progress, no confirmation before destructive actions, unclear feedback after an action ("did that save or not?"), trendy UI patterns (swipe gestures, collapsing menus, icon-only buttons without labels, auto-advancing carousels) that are unfamiliar and anxiety-inducing, and jargon ("dashboard", "sync status", "backlog") that assumes technical fluency. The deeper failure mode is emotional, not just visual: older users disengage from software they don't trust, even if it's technically legible, because they're afraid of "breaking something" or being unable to undo a mistake.

**Why it happens:**
Designers and developers default to patterns that are second nature to them (icon buttons, modal-based confirmations that flash briefly, dense multi-field forms) without testing with the actual audience. Accessibility is treated as a set of CSS/contrast values rather than a set of interaction and trust guarantees.

**How to avoid:**
- Default body text to 16px+ with generous line-height; ensure all critical labels/buttons/errors remain legible when the user increases system-level text size (support dynamic scaling, don't hardcode pixel sizes that break zoom).
- Every destructive or hard-to-reverse action (deleting a demanda, marking something as paid, editing financial data) needs an explicit confirmation step and, where feasible, an undo window — not a silent save.
- Every user action needs visible, unambiguous feedback (a save confirmation, a success state) — never rely on the user inferring success from the absence of an error.
- Avoid icon-only buttons; pair icons with text labels. Avoid gesture-based interactions (swipe-to-delete, long-press menus) as the only way to perform an action.
- Break multi-field forms (e.g., creating a demanda) into short, single-purpose steps rather than one long form, and use plain Portuguese language over technical/anglicized terms in the UI.
- Test with real target users (actual volunteers, not just internal team) before considering a flow "done" — this is the only reliable way to catch trust/confidence issues that a design checklist misses.

**Warning signs:**
- Volunteers ask for help via WhatsApp/phone to do things the interface was supposed to make self-service.
- Low adoption or avoidance of certain features (e.g., people keep asking the coordinator to update things manually instead of using the system) despite the feature existing.
- User testing sessions show hesitation, re-reading, or asking "did it work?" after routine actions.

**Phase to address:**
Cross-cutting — should be a UI/UX design contract established early (ideally before or alongside the first feature-building phase) and re-validated at each phase touching a user-facing flow, especially demanda creation/editing and any financial data entry.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|-----------------|
| Auto-committing AI-extracted demandas without review | Faster demo of "AI magic" | Wrong owners/deadlines silently corrupt the task list; erodes trust in the whole system | Never — even in MVP, keep a lightweight review/confirm step |
| Sending one reminder email per demanda instead of a daily digest | Simpler send logic | Burns through Resend free-tier quota fast; floods elderly users' inboxes | Only acceptable at very low demanda volume (single digits); revisit before broader rollout |
| Parsing Google Sheet by column index/position | Faster initial integration | Breaks silently the moment the sheet's structure shifts | Never — use header-based parsing from day one |
| No keep-alive/heartbeat for Supabase | One less thing to build initially | Project can pause/be deleted during a quiet week, silently breaking everything | Never — cheap to build, catastrophic if skipped |
| Skipping a run-log table for the reminder cron | Simpler cron function | No way to know reminders failed until a volunteer complains | Acceptable only for a throwaway prototype, not for anything a coordinator will rely on |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Vercel Cron (Hobby) | Assuming per-minute precision or built-in retry/alerting | Design for once-daily cadence, hourly precision, build your own logging + alerting |
| Resend | Sharing one account/domain across transactional and any bulk-style sends | Keep a dedicated domain/account solely for this app's transactional reminders |
| Supabase (free tier) | Assuming any connection or cron execution counts as "activity" | Ensure a real write happens periodically; add an independent keep-alive job |
| Google Sheets API | Reading by fixed row/column position | Read by header name; validate structure on every sync; handle filter-view edge cases |
| LLM extraction (meeting text → tasks) | Trusting model output as final | Require human review/confirm before any demanda is created from AI output |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| One reminder email per demanda per recipient | Resend quota exhausted, inbox flooding | Batch into a daily per-person digest | Breaks once total demandas × recipients exceeds ~100/day (free-tier ceiling) |
| Formula-heavy Google Sheet being read on every sync | Sync latency grows, occasional timeouts | Read raw values, avoid triggering recalculation-heavy ranges; consider caching last-good read | Noticeable once the sheet has many cross-sheet aggregate formulas |
| Long transcripts sent whole to the LLM in one extraction call | Extraction quality degrades, cost/latency rises, more hallucination risk | Chunk very long meeting summaries or pre-summarize before extraction; keep prompts focused | Becomes noticeable on meetings longer than a typical 1-hour weekly sync |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing financial data with the same access level as general demandas | Volunteers without financial role see sensitive cash-flow data | Enforce the 4-role access control (Coordenador, Líder, Voluntário, Financeiro) at the query/API layer, not just hidden in the UI |
| Trusting institutional-email login without verifying domain/allowlist | Anyone with any email could self-register as a "volunteer" | Restrict signup/login to verified institutional email domain or an explicit invite/allowlist flow |
| Logging full meeting transcripts or financial sheet contents in third-party LLM/logging services without review | Sensitive institutional/financial data leaves the org's control | Review what's sent to the LLM provider and any logging pipeline; avoid sending full financial rows through the extraction pipeline (it's for demandas/tasks, not needed there) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Icon-only navigation/buttons | Elderly volunteers can't tell what an icon does, avoid the feature | Always pair icons with text labels |
| Long multi-field forms for creating a demanda | Users abandon or make errors partway through | Break into short steps with clear progress indication |
| No confirmation on destructive actions (delete, mark paid) | Accidental data loss, fear of using the system | Confirm dialogs + undo window for anything hard to reverse |
| Silent success (no visible feedback after save) | Users repeat the action or assume it failed | Explicit, visible success confirmation after every action |
| Dense financial dashboard with jargon/abbreviations | Coordinator/financeiro misreads numbers, low trust in dashboard | Plain-language labels, generous spacing, visual hierarchy via size/contrast not just color |

## "Looks Done But Isn't" Checklist

- [ ] **Reminder emails:** Often missing a run-log/history — verify there's a place to see "last run: [time], N sent, N failed" rather than just trusting the cron fired
- [ ] **AI-generated demandas:** Often missing a review/approve step — verify no AI-extracted task can reach the live list without explicit human confirmation
- [ ] **Google Sheets sync:** Often missing a "last synced at" indicator and validation-failure state — verify the dashboard visibly distinguishes "current data" from "stale/broken sync," not just showing whatever was last successfully parsed as if it's current
- [ ] **Supabase/Vercel infra:** Often missing a keep-alive mechanism — verify a scheduled job independent of feature logic keeps the free-tier project from pausing
- [ ] **Role-based access control:** Often implemented only in the UI (hiding buttons/menus) — verify permissions are enforced at the API/query layer for all 4 roles, especially financial data
- [ ] **Accessible UX:** Often verified only against a contrast-ratio/font-size checklist — verify it was actually tested with a real elderly volunteer completing a real task end-to-end

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Supabase project paused/data at risk | MEDIUM | Reactivate project promptly via dashboard; if within Supabase's recovery window data is typically restorable, but do not delay — deletion risk grows with time; add keep-alive immediately after recovery |
| Reminder emails silently stopped for a period | LOW | Manually notify affected volunteers of missed deadlines once discovered; backfill the run-log going forward; add alerting so this can't recur silently |
| Bad AI-extracted demandas already created in the live list | LOW–MEDIUM | Audit demandas created via AI extraction against source transcripts; correct/delete incorrect ones; retroactively add the review-gate if it was skipped |
| Google Sheets sync silently desynced for a period | MEDIUM | Reconcile dashboard against the sheet manually for the affected period; add header validation and last-synced indicator to prevent recurrence |
| Elderly users disengaging from a confusing flow | MEDIUM–HIGH | Run a focused usability session with actual volunteers, simplify the specific flow, and personally re-onboard affected users — rebuilding trust takes more than a bug fix |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|---------------|
| Supabase free-tier pause silently breaks everything | Infra/foundation setup phase | Confirm a keep-alive job exists and is independent of feature-specific cron jobs; simulate 7+ days idle in staging if feasible |
| Vercel cron failures go unnoticed | Reminder/notification phase | Confirm every cron run writes a log row with success/fail + count; confirm dashboard surfaces "last run" status |
| Resend quota exhaustion / policy strike silences all mail | Reminder/notification phase | Confirm reminders are batched into per-person digests; confirm usage-vs-cap visibility exists |
| LLM extraction fabricates owners/deadlines | AI extraction/demanda-generation phase | Confirm no demanda reaches the live list without a human-confirm step; confirm source snippet is shown alongside each proposed demanda |
| Google Sheets sync breaks silently on structural drift | Financial dashboard/sync phase | Confirm header-based parsing, validation-before-display, and a visible last-synced timestamp all exist |
| Elderly UX fails despite checklist-level accessibility | Cross-cutting UX contract, re-checked each user-facing phase | Confirm at least one real target-user test occurred on core flows (demanda creation, reminder settings, financial dashboard viewing) before considering the phase done |

## Sources

- [Vercel Cron Jobs: The Definitive Guide to Scheduling Tasks (with Gotchas & Solutions)](https://tisankan.dev/vercel-cron-jobs/)
- [Vercel cron jobs limit: Hobby plan caps and how to beat them](https://crontap.com/blog/vercel-cron-hourly-limit-and-how-to-beat-it)
- [Vercel Cron Jobs for SaaS: A Complete Guide](https://www.superfa.st/blog/vercel-cron-jobs-saas)
- [What are Resend account quotas and limits? - Resend](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- [Resend vs Amazon SES vs Postmark Transactional Email 2026](https://www.buildmvpfast.com/blog/resend-vs-ses-vs-postmark-transactional-email-deliverability-saas-2026)
- [Resend Review 2026: Pricing, Deliverability, and Limits](https://wpmailsmtp.com/resend-review/)
- [Prevent Supabase Free Tier Pausing (2026 Guide)](https://shadhujan.medium.com/how-to-keep-supabase-free-tier-projects-active-d60fd4a17263)
- [Prevent Supabase free tier pauses using a cron job · Natt](https://natt.so/writing/prevent-supabase-free-tier-pause)
- [Why Supabase Pauses Your Project (and How to Stop It) · Tell Me When Down](https://tellmewhendown.com/blog/why-supabase-pauses-your-project)
- [I'd like to know how Supabase chooses the project which will be inactivated (GitHub Discussion)](https://github.com/orgs/supabase/discussions/13121)
- [Stop Supabase projects from pausing due to inactivity! (GitHub)](https://github.com/travisvn/supabase-pause-prevention)
- [Structured information extraction from complex scientific text with fine-tuned large language models](https://arxiv.org/pdf/2212.05238)
- [Structured Data Extraction with Zero Hallucinations for .NET, LM-Kit](https://lm-kit.com/solutions/document-intelligence/structured-data-extraction/)
- [Why LLMs Hallucinate More on Enterprise Documents, And What to Do About It](https://www.adlibsoftware.com/news/why-llms-hallucinate-more-on-enterprise-documents)
- [How to use Google Sheets as a database | Whalesync](https://www.whalesync.com/blog/how-to-use-google-sheets-as-a-database)
- [Errors and warnings during Sync - AppSheet Help](https://support.google.com/appsheet/answer/10105777?hl=en)
- [Improve the speed of Sync with database updates - AppSheet Help](https://support.google.com/appsheet/answer/10104494?hl=en)
- [App changes are not captured in the spreadsheet or the app - AppSheet Help](https://support.google.com/appsheet/answer/10105403?hl=en)
- [UX/UI Design for Elderly Users: A Comprehensive Guide](https://medium.com/design-bootcamp/ux-ui-design-for-elderly-users-a-comprehensive-guide-ee49d1870099)
- [UX Design for Older Adults | Building Digital Confidence](https://www.aufaitux.com/blog/ux-design-older-adults-digital-confidence/)
- [Essential UX for Elderly: Tips for Designing User-Friendly Interfaces](https://cadabra.studio/blog/ux-for-elderly/)
- [A Guide To Interface Design for Older Adults – Adchitects](https://adchitects.co/blog/guide-to-interface-design-for-older-adults)

---
*Pitfalls research for: nonprofit volunteer/demand management system (EctoDash)*
*Researched: 2026-08-02*

---
phase: 08-ai-task-extraction-review
plan: 01
subsystem: ai
tags: [gemini, google-genai, zod, server-actions, structured-output, responsavel-matching]

# Dependency graph
requires:
  - phase: 04-demandas-crud
    provides: demandaSchema, createDemanda Server Action (unchanged, reused unmodified by Wave 2)
  - phase: 01-project-scaffold-institutional-login
    provides: profiles table (id, email only), session-bound Supabase client (src/lib/supabase/server.ts)
provides:
  - matchResponsavel() pure function for AI-extracted-name-to-profile-id resolution
  - extractionResponseSchema Zod re-validation of untrusted Gemini JSON output
  - extractDemandas Server Action — Gemini call + validation + matching, zero database writes
  - @google/genai installed and verified as the legitimate current Gemini SDK
  - GEMINI_API_KEY documented in .env.local.example
affects: [08-02 (Wave 2 paste/review UI), 08-03 (Wave 3 production env var + e2e verification)]

# Tech tracking
tech-stack:
  added: ["@google/genai@^2.15.0"]
  patterns:
    - "Server Action calls an external LLM with responseSchema/responseMimeType enforcement as the structural prompt-injection mitigation, not prompt wording alone"
    - "Untrusted external-service output (Gemini's JSON) re-validated with a dedicated, deliberately looser Zod schema, distinct from the strict schema applied later at human-confirm time"
    - "Deterministic, non-fuzzy substring matching (no library) for a narrow, small-roster name-resolution problem, with a null (never-guess) fallback"
    - "vi.mock() of an external SDK module (@google/genai) mirrors this repo's existing resend-SDK-mock pattern (tests/db/reminder-run-log.test.ts) for cost-free, deterministic, non-flaky tests"

key-files:
  created:
    - src/lib/ai/match-responsavel.ts
    - src/lib/ai/match-responsavel.test.ts
    - src/app/(dashboard)/demandas/extrair/extraction-schema.ts
    - src/app/(dashboard)/demandas/extrair/extraction-schema.test.ts
    - src/app/(dashboard)/demandas/extrair/actions.ts
    - tests/ai/extract-demandas-no-write.test.ts
  modified:
    - package.json
    - package-lock.json
    - .env.local.example

key-decisions:
  - "Task 1's @google/genai package-legitimacy checkpoint was approved by the human in the orchestrating conversation (not typed directly into this execution run) — see 'Human Approval Record' section below for the full audit trail."
  - "Verified gemini-3.1-flash-lite live against ai.google.dev/gemini-api/docs/models and its dedicated model page on 2026-08-04 (GA/non-preview listing, Structured output + Function calling support confirmed, no deprecation notice found) rather than copying CLAUDE.md's older gemini-2.5-flash-lite (announced shutdown ~October 2026) or blindly trusting 08-RESEARCH.md's own flagged-LOW-confidence guess."
  - "Reworded a code comment in actions.ts that referenced 'createAdminClient' by name (documenting its non-use) after the plan's own negative-grep acceptance criterion for that literal string flagged it — the comment now describes the restriction without naming the identifier, preserving intent without tripping the grep."

requirements-completed: [IA-01, IA-03, IA-04]

coverage:
  - id: D1
    description: "matchResponsavel() resolves an AI-extracted name string to a real profile.id via case/accent-insensitive substring match against the email local-part, or returns null when no confident match exists — never a fabricated UUID"
    requirement: "IA-03"
    verification:
      - kind: unit
        ref: "src/lib/ai/match-responsavel.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "extractionResponseSchema re-validates Gemini's own JSON output as untrusted data — accepts a valid empty array as a legitimate outcome, rejects missing fields, wrong top-level type, and over-50-length arrays"
    requirement: "IA-03"
    verification:
      - kind: unit
        ref: "src/app/(dashboard)/demandas/extrair/extraction-schema.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "extractDemandas Server Action calls Gemini with responseSchema/responseMimeType enforcement, re-validates the response, matches responsáveis, and returns suggestions[] — never writing to demandas or demanda_responsaveis under any input, including adversarial/prompt-injection mocked content"
    requirement: "IA-04"
    verification:
      - kind: integration
        ref: "tests/ai/extract-demandas-no-write.test.ts"
        status: pass
      - kind: unit
        ref: "grep acceptance criteria — no insert() call anywhere in actions.ts (see plan 08-01 acceptance_criteria)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Empty/whitespace-only pasted text is rejected by pasteSchema before Gemini is ever called (IA-01's validation boundary)"
    requirement: "IA-01"
    verification:
      - kind: integration
        ref: "tests/ai/extract-demandas-no-write.test.ts#rejects an empty/whitespace-only paste without ever invoking Gemini or insert"
        status: pass
    human_judgment: false
  - id: D5
    description: "@google/genai package legitimacy override reviewed and approved by a human before install"
    human_judgment: true
    rationale: "Package-legitimacy approval is an explicit human decision per the Package Legitimacy Gate protocol — not something a test can prove. Approval was given in the orchestrating conversation (see Human Approval Record); this coverage entry documents that the gate was honored, not automated."

duration: 1h
completed: 2026-08-04
status: complete
---

# Phase 8 Plan 1: Gemini Extraction Foundation Summary

**extractDemandas Server Action calling Gemini 3.1 Flash-Lite with structural responseSchema enforcement, deterministic email-local-part responsável matching, and a dedicated adversarial-input integration test proving zero database writes**

## Performance

- **Duration:** ~1h
- **Started:** 2026-08-04
- **Completed:** 2026-08-04
- **Tasks:** 2 (Task 1: package-legitimacy checkpoint; Task 2: install + implementation)
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- `@google/genai@^2.15.0` installed following an explicit human-approved package-legitimacy override — never `@google/generative-ai`
- `matchResponsavel()` — pure, deterministic responsável-name-to-profile-id resolver: case/accent-insensitive substring match against the email local-part, returns a real `profiles.id` or `null`, never a guessed UUID
- `extractionResponseSchema` — Zod re-validation of Gemini's own JSON output, deliberately looser than `demandaSchema`, correctly treats an empty array as a legitimate "no suggestions" outcome
- `extractDemandas` Server Action — auth check, pasted-text validation, `profiles` read via the ordinary session-bound client, Gemini call with `responseSchema`/`responseMimeType: "application/json"` enforcement, re-validation, per-suggestion responsável matching — returns `suggestions[]` with **zero database writes**
- `tests/ai/extract-demandas-no-write.test.ts` — the phase's most important test, proving the zero-write invariant holds across a normal response, an empty response, a thrown/network error, a malformed shape, invalid JSON, and adversarial prompt-injection content in suggestion fields
- Current Gemini model name (`gemini-3.1-flash-lite`) verified live against `ai.google.dev/gemini-api/docs/models`, not copied blindly from CLAUDE.md's older recommendation or 08-RESEARCH.md's own flagged-LOW-confidence guess
- `.env.local.example` extended with a `GEMINI_API_KEY` placeholder (no real value)

## Task Commits

Each task was committed atomically:

1. **Task 1 (checkpoint): Confirm @google/genai package-legitimacy override** — no code change; approval recorded below (see Human Approval Record)
2. **Task 2: Install @google/genai, responsável-matching, extraction schema, and extractDemandas with zero-write proof** — split into two commits for clarity:
   - `88a0787` — `feat(08-01): install @google/genai for Gemini structured-output extraction`
   - `43fe147` — `feat(08-01): extractDemandas Server Action with zero-write proof`

**Plan metadata:** (this commit, following SUMMARY/STATE/ROADMAP/REQUIREMENTS updates)

## Files Created/Modified

- `src/lib/ai/match-responsavel.ts` - pure `normalize()`/`matchResponsavel()` functions
- `src/lib/ai/match-responsavel.test.ts` - unit tests for every matching case (first-name, accent, case, no-match, empty, full-email, duplicate-first-name)
- `src/app/(dashboard)/demandas/extrair/extraction-schema.ts` - `extractionResponseSchema` Zod schema + `ExtractedSuggestion` type
- `src/app/(dashboard)/demandas/extrair/extraction-schema.test.ts` - schema boundary tests (valid, empty, missing field, wrong type, over-50-length)
- `src/app/(dashboard)/demandas/extrair/actions.ts` - `extractDemandas` Server Action and `ExtractDemandasState` type
- `tests/ai/extract-demandas-no-write.test.ts` - integration test proving the zero-write invariant under 7 scenarios
- `package.json` / `package-lock.json` - adds `@google/genai@^2.15.0`
- `.env.local.example` - adds `GEMINI_API_KEY` placeholder entry

## Human Approval Record (Task 1 checkpoint)

Task 1 (`checkpoint:human-verify`, `gate="blocking-human"`) required explicit human confirmation of the `@google/genai` package-legitimacy override before any install could run.

**This approval was given by the human in the orchestrating conversation** (not typed directly into this execution run) — the human responded "Aprovado" to the exact override justification reproduced verbatim in Task 1's `<how-to-verify>` block: package registered 2025-03-11 by the official `googleapis` GitHub organization (`github.com/googleapis/js-genai`), 17.9M weekly downloads, no deprecation flag, `[SUS]` auto-flag confirmed as a false positive from a "latest version too new" heuristic (the checker looked at the 2026-07-30 latest-publish timestamp, not the 2025-03-11 registration date). The human also explicitly confirmed `@google/generative-ai` (the older, superseded package name) would NOT be installed.

Independent verification performed directly against the live npm registry during this execution, before installing:
```
npm view @google/genai version        -> 2.15.0
npm view @google/genai deprecated     -> (empty — not deprecated)
npm view @google/genai repository.url -> git+https://github.com/googleapis/js-genai.git
```

This matches 08-RESEARCH.md's own registry findings exactly. Task 2 proceeded immediately after this record was established, per the orchestrator's explicit instruction — Task 1 was not re-asked or re-blocked.

## Gemini Model Verification Record

The current, non-deprecated Gemini model name was verified live, not copied from a written document, per Task 2's explicit instruction:

- Fetched `https://ai.google.dev/gemini-api/docs/models` directly (2026-08-04) and confirmed `gemini-3.1-flash-lite` appears as a distinct, non-preview model listing (separate from `gemini-3.1-flash-lite-preview`), alongside `gemini-3.5-flash-lite` and `gemini-3.6-flash`.
- Fetched the dedicated model page `https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite` directly and confirmed "Structured output" and "Function calling" support are listed, with no deprecation/shutdown notice found anywhere on the page.
- Chose `gemini-3.1-flash-lite` over `gemini-3.5-flash-lite`/`gemini-3.6-flash` as the more conservative, longer-proven GA option (matching 08-RESEARCH.md's own starting-point recommendation, re-verified fresh rather than trusted blindly per Pitfall 2/Open Question 1).
- **Did not use** `gemini-2.5-flash-lite` (CLAUDE.md's older literal recommendation, announced shutdown ~October 2026).
- Recorded in `src/app/(dashboard)/demandas/extrair/actions.ts` as a one-line comment directly above the `EXTRACTION_MODEL` constant, per the plan's instruction to mirror 08-RESEARCH.md's own "re-verify at implementation time" comment convention.

## Decisions Made

- **@google/genai approved via human checkpoint in the orchestrating conversation** — see Human Approval Record above.
- **gemini-3.1-flash-lite verified live** rather than trusting any written document's model-name string — see Gemini Model Verification Record above.
- **Reworded a code comment** that literally contained the string `createAdminClient` (documenting its deliberate non-use) after the plan's own negative-grep acceptance criterion flagged the substring match against the comment text, not an actual import. The comment now conveys the same restriction ("the service-role factory... is never imported here") without naming the identifier literally, satisfying both the grep and the documentation intent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Comment text tripped a negative-grep acceptance criterion**
- **Found during:** Task 2, running the plan's own acceptance-criteria grep checks
- **Issue:** `grep -c 'createAdminClient' actions.ts` returned `1` because a code comment documented "never `createAdminClient`" by name, even though no actual call/import existed — the grep is a literal substring match, not comment-aware.
- **Fix:** Reworded the comment to describe the restriction ("the service-role factory in src/lib/supabase/admin.ts is never imported here") without literally naming the `createAdminClient` identifier.
- **Files modified:** `src/app/(dashboard)/demandas/extrair/actions.ts`
- **Verification:** Re-ran `grep -c 'createAdminClient' actions.ts` -> `0`; re-ran `npx tsc --noEmit` (clean) and the full test suite (still 92 passed/2 skipped) to confirm no behavior changed.
- **Committed in:** `43fe147` (folded into Task 2's single commit, made before the commit — no separate fix-up commit needed)

---

**Total deviations:** 1 auto-fixed (1 blocking — a documentation/grep-compliance wording fix, no logic or behavior change)
**Impact on plan:** Purely cosmetic (comment wording). No scope creep, no functional change.

## Issues Encountered

None beyond the deviation above. `npx tsc --noEmit` was clean on the first pass; all new test files passed on first run.

## User Setup Required

None yet for this plan. `.env.local.example` documents `GEMINI_API_KEY`'s existence and purpose only — no real value is required until Wave 3 (08-03)'s Vercel Production checkpoint, and this Server Action is not yet reachable from any UI (Wave 2 builds that).

## Next Phase Readiness

- `extractDemandas` is ready for Wave 2 (`08-02`) to call directly via `useActionState` from `import-form.tsx` — its `ExtractDemandasState` shape (`{ ok, message, suggestions: Array<{ key, titulo, responsavelId, responsavelTexto, prazoTexto }> }`) is the complete, stable contract Wave 2 consumes with no further server-side transformation needed.
- `responsavelId` is either a real `profiles.id` or exactly `null` — Wave 2's review card can render matched/unmatched states from a pure null check.
- `responsavelTexto` is always present so Wave 2 can render the "IA identificou o nome '{X}'..." hint even when `responsavelId` is `null`.
- Zero database writes happen inside `extractDemandas` — Wave 2's "Confirmar" button must call the existing, unmodified `createDemanda` per-card, never a new insert path. This plan adds no new insert path anywhere, verified by both grep and the dedicated integration test.
- `@google/genai` is already installed — Wave 2 does not repeat the install or re-trigger a legitimacy checkpoint.
- A local dev/test `GEMINI_API_KEY` value has not yet been set — Wave 2's manual/live verification of the paste-to-review flow (if any) will need one added to a local, git-ignored `.env.local`; production provisioning is explicitly Wave 3's (08-03) concern.
- No blockers identified for Wave 2.

---
*Phase: 08-ai-task-extraction-review*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 6 created source files, `.env.local.example`, and this SUMMARY.md were confirmed present on disk. Both task commits (`88a0787`, `43fe147`) were confirmed present in git history.

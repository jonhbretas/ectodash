# Phase 4: Demandas CRUD & Overdue Tracking - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Volunteers can create, edit, and conclude demandas (tasks), and a demanda whose prazo has passed is flagged as atrasada automatically without anyone marking it. This is the first phase that ships real, user-facing screens — the demandas list, a create form, and an edit form.

Explicitly NOT in this phase: role-scoped visibility and filtering (Phase 5 owns those — every authenticated user sees every demanda here), the coordinator's aggregate dashboard (Phase 6), email reminders (Phase 7), and the formal accessible design system (Phase 3, deferred to run after this phase).

</domain>

<decisions>
## Implementation Decisions

### Data Model
- **A demanda can have MULTIPLE responsáveis.** This is a user decision made explicitly during this phase's questioning, overriding the simpler single-FK assumption in 04-RESEARCH.md (Assumption A2). It means responsáveis is a many-to-many link table (`demanda_responsaveis` joining `demandas` to `profiles`), not a `responsavel_id` column on `demandas`.
  - The form must let the user pick one or more people, and the list/detail views must render multiple names gracefully (including the "many names on a phone card" case).
  - Phase 5's filtering ("demandas by responsável") and Phase 7's reminder targeting both consume this relationship — getting the join right here avoids a migration later.
- **Status has exactly three values**: `pendente`, `em_andamento`, `concluida`. Postgres enum, mirroring the `app_role` enum pattern established in Phase 2. No `cancelada` state in v1.
- **área/projeto is free text** for this phase, per 04-RESEARCH.md's recommendation — no `areas` table and no enum, since no área-management surface exists anywhere in the roadmap. 04-RESEARCH.md's open question about normalization (a lowercase shadow column for reliable grouping) is carried forward to Phase 5, which owns filtering.

### Overdue ("atrasada") Derivation
- Derived at read time, never stored. Per 04-RESEARCH.md this is a hard Postgres constraint, not a preference: a `GENERATED ALWAYS AS ... STORED` column requires an `IMMUTABLE` expression and `now()`/`current_date` are `STABLE`, so a stored `atrasada` column cannot be created at all.
- Implementation: a view computing `prazo < current_date and status <> 'concluida'`.
- `date-fns` is used only for human-readable display copy (pt-BR formatting, "há N dias"), never as the source of truth for whether something is late.

### Screens and Forms
- **Create and edit each get their own route** (e.g. `/demandas/nova`, `/demandas/[id]/editar`) — not a modal overlay. Chosen for the elderly-inclusive audience on phones: no overlay/scroll/keyboard conflicts, the browser back button behaves as expected, and there is room for the large fields the UI-SPEC requires.
- Visual contract is already locked in `04-UI-SPEC.md` (cards on mobile / table on desktop, non-color-alone status and overdue indicators, native date and select inputs, explicit pt-BR copy). The planner and executor follow that file — do not re-litigate visual decisions here.

### RLS Scope for This Phase
- Every authenticated user can see every demanda (`using (true)` for SELECT); write policies are scoped so users can edit demandas they created or are responsável for.
- Role-scoped visibility is deliberately Phase 5's job. 04-RESEARCH.md carries a forward-looking note: when Phase 5 narrows SELECT, it MUST re-verify the UPDATE policies still resolve — Phase 2 already got bitten by exactly this (RLS resolves an UPDATE's target rows through SELECT policies first, so a correct UPDATE policy silently becomes unreachable when SELECT hides the row).

### Claude's Discretion
- Exact table/column naming, migration file naming, whether to introduce shadcn/ui now (04-RESEARCH.md recommends yes; 04-UI-SPEC.md defers it to Phase 3 — planner resolves this conflict and documents the call), and the precise multi-select control used for responsáveis.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/0001_profiles.sql` + `0002_profiles_role.sql` — the `profiles` table demandas link to, and the `app_role` enum + `has_role()` helper pattern to mirror for the new status enum and any role-aware policy.
- `src/lib/supabase/server.ts` / `client.ts` — the Supabase client factories every new Server Action and page uses.
- `src/app/(auth)/login/actions.ts` — the established Server Action shape (`'use server'`, zod validation, typed state object returned to `useActionState`).
- `src/app/(auth)/login/login-form.tsx` — the accessibility floor to extend (text-xl base, min-h-14 controls, labels above fields, aria-live errors, pt-BR copy).
- `tests/db/role-rls.test.ts` — the live-integration RLS test pattern, including the critical service-role re-read discipline.

### Established Patterns
- Versioned SQL migrations pushed with `npx supabase@latest db push`; never Dashboard SQL edits.
- Integration tests hit the real hosted Supabase project (no Docker available); RLS assertions must re-read with the service-role client because a denied write returns success-with-zero-rows.
- `revalidatePath` (not `updateTag`/`cacheTag`) is the correct mutation-revalidation API here — this project does not enable `cacheComponents` (verified in `next.config.ts`).

### Integration Points
- `src/app/(dashboard)/page.tsx` currently renders only a greeting and a placeholder line; the demandas list replaces that placeholder.
- Phase 5 (filtering, role-scoping), Phase 6 (coordinator dashboard aggregates), and Phase 7 (reminder targeting) all read from the schema created here.

</code_context>

<specifics>
## Specific Ideas

The user's stated priority for this phase is seeing the system actually work on screen — Phase 3 was deliberately resequenced to run afterward for that reason. Prioritize a working, visibly-correct demandas flow over visual polish; Phase 3 will do the polish pass across all surfaces at once.

</specifics>

<deferred>
## Deferred Ideas

- `cancelada` status — not in v1; add only if real usage shows demandas being abandoned rather than completed.
- Normalizing área/projeto into a managed list or lookup table — carried to Phase 5, which owns filtering and will surface any data-quality pain.
- Role-scoped visibility of demandas — Phase 5.
- Formal accessible design system (shadcn/ui adoption, token formalization) — Phase 3, now running after this phase.

</deferred>

# Phase 2: Role-Based Access Control - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Every account gets exactly one of 4 fixed institutional roles (Coordenador geral, Líder de área/projeto, Voluntário comum, Financeiro), enforced at the database level via RLS — not just hidden in the UI. This phase builds the role model and the reusable `has_role()` enforcement pattern; it does NOT build a role-management UI (no role data model to manage visually yet — that belongs with a future admin surface) and does NOT create any financial tables (those arrive in Phase 10, once the real Google Sheets schema is known).

</domain>

<decisions>
## Implementation Decisions

### Role Storage Model
- Add a `role` column (Postgres enum type) directly to the existing `public.profiles` table from Phase 1 — no separate `user_roles` table.
- Enum values: `coordenador_geral`, `lider_area`, `voluntario_comum`, `financeiro` (exactly 4, fixed, one per user).
- Rationale: the project requires exactly one fixed role per person (not multi-role), so a join table would add complexity with no real benefit; a column keeps `has_role()` a simple, fast lookup.

### Role Assignment
- Role is assigned as a parameter at invite/seed time (extending `scripts/seed-coordinator.ts` or its successor to accept a role argument), not through a UI — Phase 2 has no admin screen.
- New accounts default to `voluntario_comum` unless a role is explicitly specified at invite time.
- Changing an existing user's role, until an admin UI exists in a later phase, is a direct database update (documented, not built as a feature here).

### Enforcement Scope for This Phase
- Build a reusable `public.has_role(role)` SQL helper function (SECURITY DEFINER pattern, following the same pinned-`search_path` discipline as Phase 1's `handle_new_user`).
- Apply RLS using `has_role()` to the `profiles.role` column itself: only `coordenador_geral` can update another user's role; every user can read their own row (already true from Phase 1); prove this pattern works end-to-end with a real integration test against the live hosted project (same style as Phase 1's `profiles-trigger.test.ts`).
- Do NOT create a financial data table now — Success Criterion 2 ("cannot retrieve financial data") is proven at the level of the reusable `has_role()` pattern and RLS policy shape in this phase; the actual financial table in Phase 10 applies the same proven pattern, it does not re-invent it.

### Claude's Discretion
- Exact enum value spelling/casing, migration file naming, and the seed-script CLI argument shape (e.g. `--role=financeiro` vs positional) are left to the planner/executor to decide following Phase 1's established conventions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/0001_profiles.sql` (Phase 1) — the `public.profiles` table this phase extends with a `role` column via a new migration `0002_...`.
- `scripts/seed-coordinator.ts` (Phase 1) — the invite-only onboarding script this phase likely extends or forks to accept a role parameter.
- Phase 1's `handle_new_user()` trigger pattern (SECURITY DEFINER + pinned `search_path`) is the template to follow for the new `has_role()` function.

### Established Patterns
- All schema changes ship as versioned migrations under `supabase/migrations/`, pushed via `npx supabase@latest db push` — never hand-edited via the Dashboard SQL editor.
- Integration tests hit the live hosted Supabase project directly (service-role admin client + anon client for RLS negative cases), following `tests/db/profiles-trigger.test.ts`'s pattern.

### Integration Points
- `public.profiles.role` will be read by every future phase that needs role-scoped visibility (Phase 4 demandas ownership, Phase 6 coordinator dashboard, Phase 10 financial dashboard) via the same `has_role()` helper — get this contract right now since it's the foundation everything else joins against.

</code_context>

<specifics>
## Specific Ideas

No specific UI or workflow requests — this is a backend/database-only phase per Claude's Discretion above.

</specifics>

<deferred>
## Deferred Ideas

- Role-management UI (assign/change a volunteer's role visually) — deferred to whichever future phase adds an admin/coordinator management surface; not in scope for Phase 2 or the current roadmap.
- Real financial data table and its RLS policy — deferred to Phase 10, once the Google Sheets schema is known (Phase 9 discovery).

</deferred>

# Phase 1: Project Scaffold & Institutional Login - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Bootstraps the Next.js + Supabase project and delivers institutional-email login with a persistent session. Covers AUTH-01 (login with institutional e-mail) and AUTH-04 (session persists across access). Does NOT cover role definitions/RLS enforcement (Phase 2) or any UI polish beyond a minimal accessible login screen (Phase 3 owns the full accessible design system).

</domain>

<decisions>
## Implementation Decisions

### Login Method
- **D-01:** Login is via magic link (e-mail only, no password) — no password field, no password-reset flow needed. Chosen for the elderly-heavy volunteer audience, who are prone to forgetting passwords.

### Onboarding
- **D-02:** No self-signup. Coordenador geral manually registers/invites each volunteer's institutional e-mail; the volunteer receives an invite and logs in via magic link from then on. There is no public registration screen. — **Reversibility:** costly — switching to self-signup later means adding a public signup flow and deciding how to retroactively validate existing manually-added accounts.

### Session Persistence
- **D-03:** Session does not expire on its own — user stays logged in until they explicitly click "sair" (logout). No idle timeout, no forced re-login after N days.

### Claude's Discretion
- Exact Supabase Auth configuration (magic link template copy, invite e-mail template, session/cookie implementation details) — implementer's call, as long as it satisfies D-01/D-02/D-03.
- Whether coordinator invite UI ships in this phase or is a minimal seed/admin script — Phase 1 only requires that a coordinator account can get in; a full "invite volunteer" UI screen can be part of Phase 2 (roles) if it's more natural there, since Phase 1 has no role model yet.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — core value, constraints (Vercel+Supabase free tier, elderly-accessible UX)
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-04 (this phase's requirements)
- `.planning/ROADMAP.md` §Phase 1 — phase goal and success criteria

### Research
- `.planning/research/STACK.md` — Next.js 16 + Supabase + Vercel recommendation, Supabase free-tier auto-pause gotcha
- `.planning/research/ARCHITECTURE.md` — RLS/roles pattern (profiles table + SECURITY DEFINER helper) referenced by later phases, relevant to not painting Phase 1 into a corner
- `.planning/research/PITFALLS.md` — Supabase 7-day idle auto-pause; keep-alive heartbeat should be considered as part of this phase's foundation work

No external specs beyond the above — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield project — no existing code. No reusable assets or established patterns yet; this phase establishes them.

### Integration Points
- This phase's Supabase Auth setup and `profiles` table (if created here) becomes the foundation Phase 2 (RBAC/RLS) builds its `has_role()` helper and 4-role model on top of.

</code_context>

<specifics>
## Specific Ideas

No specific UI/visual references given — Phase 3 (Accessible UI Foundation) owns the full design system. This phase just needs a minimal, working, accessible-enough login screen (magic link input + submit).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Project Scaffold & Institutional Login*
*Context gathered: 2026-08-03*

---
phase: 01-project-scaffold-institutional-login
plan: 01
subsystem: infra
tags: [nextjs, react, typescript, tailwind, eslint, vitest, supabase, ssr]

# Dependency graph
requires: []
provides:
  - "Buildable, lintable, type-checked Next.js 16 App Router repo at repository root"
  - "Vitest test harness (Wave 0 infrastructure) with one passing smoke test"
  - "Three @supabase/ssr client factories: src/lib/supabase/{server,client,middleware}.ts"
  - "Committed env-var contract (.env.local.example) naming all 5 env vars later plans depend on"
affects: [01-02, 01-03, 01-04]

# Tech tracking
tech-stack:
  added:
    - "next@16.2.12, react@19.2.8, react-dom@19.2.8, typescript@7.0.2, tailwindcss@4.3.3"
    - "@supabase/supabase-js@2.112.0, @supabase/ssr@0.12.4, zod"
    - "vitest, eslint-plugin-jsx-a11y (dev)"
  patterns:
    - "createClient() factory pattern per @supabase/ssr official docs — server (cookie-bound), client (browser), middleware (updateSession with double cookie write)"
    - "auth.getUser() only, never the non-validating session-read alternative, at every server-side session check point"

key-files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - next.config.ts
    - eslint.config.mjs
    - vitest.config.ts
    - .gitignore
    - .env.local.example
    - src/app/layout.tsx
    - src/app/page.tsx
    - tests/smoke.test.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/client.ts
    - src/lib/supabase/middleware.ts
  modified: []

key-decisions:
  - "Pinned typescript@7.0.2 (the researched/latest version) rather than downgrading to appease tooling that hasn't caught up yet"
  - "Hand-assembled eslint.config.mjs from eslint-config-next's constituent plugins instead of importing eslint-config-next directly, because that package's shared bootstrap module unconditionally requires typescript-eslint, which hard-throws on TS >=7.0"
  - "Enabled experimental.useTypeScriptCli in next.config.ts so next build shells out to the tsc CLI instead of relying on the TypeScript compiler API that TS 7.0.2 doesn't yet expose"
  - "Tightened .gitignore from create-next-app's default '.env*' to '.env*.local' so the tracked .env.local.example template isn't itself gitignored"

patterns-established:
  - "Pattern: Any new server-side Supabase call site must use src/lib/supabase/server.ts's createClient() (Server Components/Actions) and call auth.getUser(), never the non-validating alternative"
  - "Pattern: Browser-side Supabase access always goes through src/lib/supabase/client.ts, which reads only the two NEXT_PUBLIC_* vars and must never import SERVICE_ROLE"

requirements-completed: [AUTH-01]

coverage:
  - id: D1
    description: "Next.js 16 App Router repo scaffolded at repository root, builds/lints/type-checks/tests clean"
    requirement: "AUTH-01"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npm run lint && npm run build && npm test"
        status: pass
    human_judgment: false
  - id: D2
    description: "Three @supabase/ssr client factories (server, client, middleware) created per PATTERNS.md contract"
    requirement: "AUTH-01"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npm run lint (Task 3 verify line) + grep-based acceptance criteria (createServerClient/createBrowserClient/auth.getUser present; no getSession; no SERVICE_ROLE in client.ts or NEXT_PUBLIC_*SERVICE_ROLE anywhere)"
        status: pass
    human_judgment: false
  - id: D3
    description: ".env.local.example documents all 5 env vars; .env.local itself stays git-ignored"
    requirement: "AUTH-01"
    verification:
      - kind: other
        ref: "git check-ignore -q .env.local; all 5 var names present in .env.local.example"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-08-03
status: complete
---

# Phase 01 Plan 01: Project Scaffold & Supabase Client Plumbing Summary

**Next.js 16 App Router scaffold (TS 7.0.2, Tailwind 4, Vitest) with three @supabase/ssr client factories (server/client/middleware) and a committed 5-variable env contract — zero application behavior, pure toolchain substrate.**

## Performance

- **Duration:** ~13 min (Tasks 2-3; Task 1 checkpoint approved in a prior session)
- **Started:** 2026-08-03T10:40:00 (local, scaffold creation)
- **Completed:** 2026-08-03T10:53:29Z
- **Tasks:** 3 (1 checkpoint approved previously, 2 auto tasks executed this session)
- **Files modified:** 25 (21 in Task 2 commit + 4 in Task 3 commit)

## Accomplishments
- Next.js 16.2.12 App Router repo scaffolded in place (via sibling-directory hoist since repo root was non-empty), builds, lints, type-checks, and tests clean
- Vitest harness (Wave 0 test infrastructure) established with a passing smoke test, `test` script pinned to non-watching `vitest run`
- Three `@supabase/ssr` client factories created exactly per PATTERNS.md contract: cookie-bound server client, browser client, and middleware session-refresh helper using `auth.getUser()`
- `.env.local.example` committed, documenting all 5 env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_PROJECT_REF`) that every later plan in this phase depends on

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy sanity check** — no commit (gate-only checkpoint, approved by human in prior session)
2. **Task 2: Scaffold Next.js 16 in-place with toolchain and Vitest harness** - `0f47a35` (feat)
3. **Task 3: Supabase client factories and environment-variable contract** - `ee8b906` (feat)

**Plan metadata:** _(pending — this commit)_

## Files Created/Modified
- `package.json` / `package-lock.json` - project manifest, pinned Core versions, `test`/`test:watch` scripts
- `tsconfig.json` - create-next-app default TS config (`@/*` alias, strict mode)
- `next.config.ts` - `experimental.useTypeScriptCli: true` to work around TS 7.0.2's missing compiler API
- `eslint.config.mjs` - hand-assembled flat config (react/react-hooks/@next/next/import/jsx-a11y plugins) replacing `eslint-config-next`, which cannot load under TypeScript 7.0.2
- `vitest.config.ts` / `tests/smoke.test.ts` - Wave 0 test harness
- `.gitignore` - tightened `.env*` → `.env*.local` so the tracked example file isn't ignored
- `.env.local.example` - committed template for all 5 env vars
- `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/favicon.ico` - create-next-app defaults
- `src/lib/supabase/server.ts` - `createClient()` bound to `next/headers` cookies
- `src/lib/supabase/client.ts` - `createClient()` for browser, URL + anon key only
- `src/lib/supabase/middleware.ts` - `updateSession(request)` with double cookie write + `auth.getUser()`

## Decisions Made
- Kept TypeScript pinned at 7.0.2 (the researched, latest-published version) rather than downgrading to satisfy tooling that hasn't caught up — type safety itself (`tsc --noEmit`) is unaffected; only the surrounding tool integrations needed adjusting.
- Replaced `eslint-config-next` with an equivalent hand-assembled flat config sourced from the same underlying plugins, because the package's shared bootstrap module unconditionally `require`s `typescript-eslint`, which throws under TS >=7.0 (tracked upstream: typescript-eslint/typescript-eslint#10940). Re-adopt the official package once that ships.
- Enabled `experimental.useTypeScriptCli` in `next.config.ts` since Next's build-time type-checker needs a compiler API TS 7.0.2 doesn't expose by default; Next.js's own error message named this exact flag as the fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] eslint-config-next cannot load under TypeScript 7.0.2**
- **Found during:** Task 2 (`npm run lint` verification step)
- **Issue:** `eslint-config-next`'s shared `dist/index.js` (used by all three of its entry points: default, `/core-web-vitals`, `/typescript`) unconditionally requires `typescript-eslint`, which hard-throws `"typescript-eslint does not support TS 7.0"` at require time — a complete crash, not a lint warning.
- **Fix:** Rewrote `eslint.config.mjs` to assemble the same rule set directly from `@next/eslint-plugin-next`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import`, and `eslint-config-next/parser` (which has no typescript-eslint dependency), plus `eslint-plugin-jsx-a11y`'s flat recommended config. The TS-aware `@typescript-eslint` rule layer is omitted; type safety is still fully enforced by `npx tsc --noEmit`, which passes clean.
- **Files modified:** eslint.config.mjs
- **Verification:** `npm run lint` exits 0; `grep -q 'jsx-a11y' eslint.config.mjs` passes
- **Committed in:** 0f47a35 (Task 2 commit)

**2. [Rule 3 - Blocking] Next.js build-time type-checker incompatible with TypeScript 7.0.2's compiler API**
- **Found during:** Task 2 (`npm run build` verification step)
- **Issue:** `next build` failed with `"TypeScript 7.0.2 does not provide the compiler API required by Next.js."`, directly naming `experimental.useTypeScriptCli` as the documented workaround.
- **Fix:** Added `experimental: { useTypeScriptCli: true }` to `next.config.ts`, which shells out to the `tsc` CLI instead of the missing compiler API.
- **Files modified:** next.config.ts
- **Verification:** `npm run build` exits 0, produces `.next/`
- **Committed in:** 0f47a35 (Task 2 commit)

**3. [Rule 3 - Blocking] Generated .gitignore too broad for the committed env-var template**
- **Found during:** Task 2 (step 10, gitignore confirmation)
- **Issue:** create-next-app's default `.gitignore` uses `.env*`, which would also gitignore `.env.local.example` — a file Task 3 explicitly requires to be tracked/committed. This also failed the plan's literal acceptance-criteria grep for `env\*\.local`.
- **Fix:** Changed the pattern to `.env*.local`, which still ignores `.env.local` and any `.env.<name>.local` variant while leaving `.env.local.example` trackable.
- **Files modified:** .gitignore
- **Verification:** `git check-ignore -q .env.local` exits 0; `git add .env.local.example` succeeded (not silently ignored)
- **Committed in:** 0f47a35 (Task 2 commit)

**4. [Rule 1 - Wording] Middleware comment triggered the plan's literal getSession() exclusion grep**
- **Found during:** Task 3 acceptance criteria verification
- **Issue:** A code comment explaining why `getUser()` is used (mentioning the non-validating alternative by name) matched the acceptance criterion's `grep -rn 'getSession' ... | grep -v '^\s*//'` check, because `grep -rn`'s `file:line:` prefix defeats the `^\s*//`-anchored exclusion pattern.
- **Fix:** Reworded the comment to describe the non-validating alternative without naming it literally, preserving the same explanation.
- **Files modified:** src/lib/supabase/middleware.ts
- **Verification:** `grep -rn 'getSession' src/lib/supabase/ | grep -v '^\s*//'` returns no matches
- **Committed in:** ee8b906 (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (3 blocking upstream/tooling incompatibilities, 1 wording adjustment)
**Impact on plan:** All four were necessary to satisfy the plan's own stated acceptance criteria without reverting the deliberately researched TypeScript 7.0.2 pin. No scope creep — no application behavior was added or changed beyond what Tasks 2-3 specified.

## Issues Encountered
- TypeScript 7.0.2 (major version jump flagged as Pitfall 7 in RESEARCH.md) surfaced two real upstream compatibility gaps in the surrounding tooling (ESLint's `eslint-config-next` and Next.js's build-time type-checker) rather than in TypeScript itself — `tsc --noEmit` was clean throughout. Both gaps have documented workarounds and were resolved without downgrading the pinned version. See Deviations #1-2.

## User Setup Required

None for this plan. `.env.local.example` documents the 5 env vars needed for plans 01-02/01-03, but creating `.env.local` with real Supabase values is explicitly out of scope here (per plan frontmatter `user_setup`) — it's a precondition for later plans in this phase.

## Next Phase Readiness
- Repository substrate (buildable/lintable/type-clean/testable) is ready for plan 01-02 (Supabase project setup/migrations) and 01-03 (login tracer slice), both of which import `src/lib/supabase/*`.
- No blockers. The two TS 7.0.2 tooling workarounds (eslint config, useTypeScriptCli) should be revisited and potentially removed once `typescript-eslint` and Next.js ship official TS 7.x support upstream — not urgent, purely a future cleanup.

---
*Phase: 01-project-scaffold-institutional-login*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 10 claimed created files found on disk; both task commit hashes (`0f47a35`, `ee8b906`) found in git log.

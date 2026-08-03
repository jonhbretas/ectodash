---
phase: 1
slug: project-scaffold-institutional-login
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed yet — greenfield project, no `package.json` exists. Recommend Vitest for unit tests. |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npx vitest run` (once installed in Wave 0) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run` full suite + manual magic-link smoke test against the deployed Vercel URL
- **Before `/gsd-verify-work`:** Full suite green + successful manual login (magic link) + successful manual "close browser, reopen, still logged in" check
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-XX | 01 | 0 | AUTH-01 | — | Login form rejects a non-invited email (no account created) | unit | `vitest run tests/auth/signInWithOtp.test.ts` (mock Supabase client, assert `shouldCreateUser: false` is passed) | ❌ W0 | ⬜ pending |
| 01-01-XX | 01 | 0 | AUTH-01 | — | Invited user completes magic-link login end-to-end | manual-only | N/A — requires real institutional inbox, Docker unavailable so no local Inbucket | N/A | ⬜ pending |
| 01-01-XX | 01 | 0 | AUTH-04 | — | Session cookie survives a simulated browser restart (no re-auth prompt) | integration | `vitest run tests/auth/session-persistence.test.ts` (assert middleware refreshes/re-issues cookie given valid refresh token) | ❌ W0 | ⬜ pending |
| 01-01-XX | 01 | 0 | AUTH-04 | — | Redirect URL allow-list matches deployed Vercel domain | manual-only | N/A — Supabase Dashboard config check, not code | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Install and configure Vitest (`npm install -D vitest`) — no test framework exists yet
- [ ] `tests/auth/signInWithOtp.test.ts` — covers AUTH-01 (`shouldCreateUser: false` lockdown, prevents self-signup)
- [ ] `tests/auth/session-persistence.test.ts` — covers AUTH-04 (middleware refresh behavior)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Invited user completes magic-link login end-to-end | AUTH-01 | Docker unavailable locally — no local Inbucket/email-inbox tooling; must hit a real institutional inbox | Invite a real test e-mail, request magic link, click link from real inbox, confirm login succeeds |
| Redirect URL allow-list matches deployed Vercel domain | AUTH-04 | Supabase Dashboard configuration, not code | In Supabase Dashboard → Auth → URL Configuration, confirm the deployed Vercel domain is in the allow-list |
| Session survives real browser restart | AUTH-04 | Requires a real browser close/reopen cycle, not simulable in a unit test | Log in, fully close the browser, reopen and navigate to the app, confirm still logged in |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

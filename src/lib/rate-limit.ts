// src/lib/rate-limit.ts
// V-003/V-013: In-memory sliding-window rate limiter + account lockout tracker.
// No external dependencies — pure Map-based, auto-cleans stale entries every 60s.
// IMPORTANT: This runs per-serverless-function instance. On Vercel cold starts
// the Map resets, which is acceptable (fails open). For distributed enforcement,
// swap to Redis/Upstash later.

type RateLimitEntry = { count: number; resetAt: number };
type LockoutEntry = { fails: number; lockedUntil: number };

const loginAttempts = new Map<string, RateLimitEntry>();
const accountLockouts = new Map<string, LockoutEntry>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of loginAttempts) {
    if (entry.resetAt < now) loginAttempts.delete(key);
  }
  for (const [key, entry] of accountLockouts) {
    if (entry.lockedUntil < now) accountLockouts.delete(key);
  }
}

// ── Rate Limiter ───────────────────────────────────────────────────────

/**
 * Check + increment a sliding-window counter.
 * Returns { allowed: true } if the request is within limits,
 * or { allowed: false, retryAfterMs } when rate-limited.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: true } | { allowed: false; retryAfterMs: number } {
  maybeCleanup();
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > maxAttempts) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  return { allowed: true };
}

// ── Account Lockout ────────────────────────────────────────────────────

const MAX_FAILS = 10;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function recordLoginFailure(email: string): boolean {
  maybeCleanup();
  const now = Date.now();
  const entry = accountLockouts.get(email);

  if (!entry || entry.lockedUntil < now) {
    accountLockouts.set(email, { fails: 1, lockedUntil: 0 });
    return false; // not locked yet
  }

  entry.fails++;
  if (entry.fails >= MAX_FAILS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    return true; // now locked
  }
  return false;
}

export function resetLoginFailures(email: string): void {
  accountLockouts.delete(email);
}

export function isAccountLocked(email: string): {
  locked: boolean;
  retryAfterMs: number;
} {
  maybeCleanup();
  const now = Date.now();
  const entry = accountLockouts.get(email);
  if (!entry || entry.lockedUntil < now) {
    return { locked: false, retryAfterMs: 0 };
  }
  return { locked: true, retryAfterMs: entry.lockedUntil - now };
}

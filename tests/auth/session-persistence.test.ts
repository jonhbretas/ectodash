import { describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// .env.local is git-ignored and holds real project credentials. Load it here
// so the live integration cases below can run locally with `npm test` without
// extra setup, mirroring tests/auth/signInWithOtp.test.ts. In CI (or any
// environment where the file is absent) this is a silent no-op — the suite
// falls back to real process env vars and skips visibly if they are missing.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — rely on real environment variables (e.g. CI secrets).
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The Coordenador geral account seeded directly in the hosted project (see
// plan 01-03 / STATE.md "Blockers/Concerns" — created via `admin.createUser`
// while the invite-email path is investigated separately).
const COORDINATOR_EMAIL = "jonathanbretas@gmail.com";

const canRunLive = Boolean(supabaseUrl && anonKey && serviceRoleKey);

type LiveSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: unknown;
};

// Obtains a genuine access/refresh token pair for the seeded coordinator
// without needing an inbox: an admin-generated magic link is redeemed
// directly against the real Auth server via verifyOtp. Every call mints a
// fresh session with its own single-use refresh token, so tests never step
// on each other's tokens.
async function obtainLiveSession(): Promise<LiveSession> {
  const admin = createSupabaseClient(supabaseUrl!, serviceRoleKey!);
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: COORDINATOR_EMAIL,
    });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    throw new Error(
      `generateLink failed for ${COORDINATOR_EMAIL}: ${linkError?.message ?? "no hashed_token in response"}`
    );
  }

  const anon = createSupabaseClient(supabaseUrl!, anonKey!);
  const { data: verifyData, error: verifyError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verifyError || !verifyData.session) {
    throw new Error(
      `verifyOtp failed for ${COORDINATOR_EMAIL}: ${verifyError?.message ?? "no session returned"}`
    );
  }

  return verifyData.session as LiveSession;
}

// `@supabase/ssr` stores the session under `sb-<project-ref>-auth-token`,
// where the project ref is the first hostname label of the Supabase URL
// (`@supabase/supabase-js`'s `defaultStorageKey`). The cookie value is a
// `base64-` prefixed, base64url-encoded JSON session — round-trip verified
// against the installed `@supabase/ssr` decoder while writing this test.
const projectRef = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "";
const AUTH_COOKIE_NAME = `sb-${projectRef}-auth-token`;

// Encodes a session cookie value with a caller-chosen `expires_at`, so tests
// can force the middleware's refresh path (RESEARCH.md Pitfall 3) without
// waiting out a real ~1 hour access-token lifetime. `expiresInSeconds` only
// overrides the *stored* expiry metadata that `updateSession` reads to decide
// whether to refresh — it never touches the real, still-valid access/refresh
// tokens issued by Supabase, so the subsequent refresh call is genuine.
function encodeAuthCookie(
  session: LiveSession,
  expiresInSeconds: number
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: session.token_type,
    user: session.user,
    expires_in: expiresInSeconds,
    expires_at: nowSeconds + expiresInSeconds,
  };
  return "base64-" + Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function requestWithAuthCookie(cookieValue?: string): NextRequest {
  return new NextRequest("http://localhost:3000/", {
    headers: cookieValue
      ? { cookie: `${AUTH_COOKIE_NAME}=${cookieValue}` }
      : {},
  });
}

describe.skipIf(!canRunLive)(
  "session persistence (AUTH-04, live Supabase project)",
  () => {
    // Test 1: a real session issued for the seeded coordinator can be
    // exchanged via its refresh token for a new, different access token —
    // the exact mechanism that keeps a volunteer signed in past
    // access-token expiry.
    it("test 1: exchanges the refresh token for a new, different access token", async () => {
      const session = await obtainLiveSession();
      const anon = createSupabaseClient(supabaseUrl!, anonKey!);

      const { data, error } = await anon.auth.refreshSession({
        refresh_token: session.refresh_token,
      });

      expect(error).toBeNull();
      expect(data.session).not.toBeNull();
      expect(data.session?.access_token).not.toBe(session.access_token);
    });

    // Test 2: `updateSession` given a NextRequest carrying valid Supabase
    // auth cookies returns a NextResponse that resolves a user and writes
    // auth cookies back onto the response — proving the middleware persists
    // the refreshed session, which Server Components cannot do (RESEARCH.md
    // Pitfall 3). The cookie is deliberately encoded as near-expiry (well
    // inside auth-js's internal refresh margin) so `updateSession` actually
    // exercises the refresh-and-rewrite path instead of merely round-tripping
    // an already-fresh cookie.
    it("test 2: resolves a user and rewrites auth cookies when the session needs refreshing", async () => {
      const session = await obtainLiveSession();
      const cookieValue = encodeAuthCookie(session, 30);
      const request = requestWithAuthCookie(cookieValue);

      const { response, user } = await updateSession(request);

      expect(user).not.toBeNull();
      expect(user?.email?.toLowerCase()).toBe(COORDINATOR_EMAIL.toLowerCase());

      const authCookies = response.cookies
        .getAll()
        .filter((cookie) => cookie.name.startsWith(AUTH_COOKIE_NAME));
      expect(authCookies.length).toBeGreaterThan(0);
    });

    // Test 3: every auth cookie written by `updateSession` carries a maxAge
    // of at least 180 days (15552000 seconds), asserting nobody has
    // shortened the `@supabase/ssr` default and quietly broken D-03.
    it("test 3: every rewritten auth cookie carries a maxAge of at least 180 days", async () => {
      const session = await obtainLiveSession();
      const cookieValue = encodeAuthCookie(session, 30);
      const request = requestWithAuthCookie(cookieValue);

      const { response, user } = await updateSession(request);

      expect(user).not.toBeNull();

      const authCookies = response.cookies
        .getAll()
        .filter((cookie) => cookie.name.startsWith(AUTH_COOKIE_NAME));
      expect(authCookies.length).toBeGreaterThan(0);
      for (const cookie of authCookies) {
        expect(cookie.maxAge ?? 0).toBeGreaterThanOrEqual(15552000);
      }
    });
  }
);

if (!canRunLive) {
  describe("session persistence (AUTH-04, live Supabase project)", () => {
    it.skip("SUPABASE_SERVICE_ROLE_KEY (or other required project env vars) not set — skipping live session tests", () => {
      // Intentionally empty: surfaces a visible skip message when
      // hosted-project credentials are unavailable.
    });
  });
}

// Test 4: `updateSession` given a NextRequest with no auth cookies resolves
// no user, so the middleware guard in plan 01-03 has something real to act
// on. Runs unconditionally — it needs only the public Supabase URL/anon key
// that every environment already has, not the service-role key.
describe("updateSession with no auth cookies", () => {
  it("test 4: resolves no user when the request carries no auth cookies", async () => {
    const request = requestWithAuthCookie();

    const { user } = await updateSession(request);

    expect(user).toBeNull();
  });
});

// Test 5: the `signOut` Server Action invokes Supabase sign-out and
// redirects to `/login` — asserted against a mocked server client, since the
// redirect throws by design in Next.js.
const signOutMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { signOut: signOutMock } })),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("signOut Server Action (D-03 — the only control that ends a session)", () => {
  it("test 5: calls Supabase sign-out and redirects to /login", async () => {
    signOutMock.mockReset().mockResolvedValue({ error: null });
    redirectMock.mockClear();

    const { signOut } = await import("@/app/(dashboard)/actions");

    await expect(signOut()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});

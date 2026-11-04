import { generateKeyPairSync, sign, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "./middleware";

// Use the real Supabase SDK with a signed fixture JWT. Only the HTTP
// boundary is mocked, so signature verification and cookie refresh run.
const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const kid = "navigation-performance-test";
const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" };
const userId = "a43db34a-6132-41b3-b926-e37e82ee0210";
const email = "performance@example.invalid";
const cookieName = "sb-navigation-test-auth-token";
const fetchMock = vi.fn();

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function token(symmetric = false) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, email, aud: "authenticated", role: "authenticated", iat: now, exp: now + 3600 };
  const input = `${encode({ alg: symmetric ? "HS256" : "ES256", typ: "JWT", kid })}.${encode(payload)}`;
  const signature = symmetric
    ? createHmac("sha256", "test-secret").update(input).digest()
    : sign("sha256", Buffer.from(input), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${input}.${signature.toString("base64url")}`;
}

function request(accessToken: string, expiresIn = 3600) {
  const session = {
    access_token: accessToken, refresh_token: "fixture-refresh-token", token_type: "bearer",
    expires_in: expiresIn, expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    // Deliberately forged cookie user: identity must come from the verified JWT.
    user: { id: "forged-cookie-user", email: "forged@example.invalid" },
  };
  return new NextRequest("https://app.example.invalid/demandas", {
    headers: { cookie: `${cookieName}=base64-${encode(session)}` },
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://navigation-test.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fixture-anon-key");
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/.well-known/jwks.json")) return Response.json({ keys: [jwk] });
    throw new Error(`Unexpected Auth call: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("session verification on navigation", () => {
  it("verifies signatures and reuses public keys without a user lookup on each navigation", async () => {
    const jwt = token();
    expect((await updateSession(request(jwt))).user).toEqual({ id: userId, email });
    expect((await updateSession(request(jwt))).user).toEqual({ id: userId, email });
    expect(fetchMock.mock.calls.every(([url]) => String(url).endsWith("/.well-known/jwks.json"))).toBe(true);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("rejects a token whose identity was changed without resigning", async () => {
    const parts = token().split(".");
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    parts[1] = encode({ ...payload, sub: "forged-user" });
    expect((await updateSession(request(parts.join(".")))).user).toBeNull();
  });

  it("refreshes an expiring session and preserves cookies and private response headers", async () => {
    const refreshedToken = token();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/token?grant_type=refresh_token")) return Response.json({
        access_token: refreshedToken, refresh_token: "rotated-refresh-token", expires_in: 3600,
        token_type: "bearer", user: { id: userId, email, app_metadata: {}, user_metadata: {} },
      });
      if (url.endsWith("/.well-known/jwks.json")) return Response.json({ keys: [jwk] });
      throw new Error(`Unexpected Auth call: ${url}`);
    });
    const nextRequest = request(token(), 30);
    const { response, user } = await updateSession(nextRequest);
    expect(user).toEqual({ id: userId, email });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/token?grant_type=refresh_token"))).toBe(true);
    expect(response.cookies.getAll().some((cookie) => cookie.name.startsWith(cookieName))).toBe(true);
    const storedSession = JSON.parse(Buffer.from(
      nextRequest.cookies.get(cookieName)!.value.slice("base64-".length), "base64url"
    ).toString());
    expect(storedSession.refresh_token).toBe("rotated-refresh-token");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("keeps the Auth server verification fallback for projects with symmetric signing keys", async () => {
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith("/user")) return Response.json({ id: userId, email });
      throw new Error(`Unexpected Auth call: ${input}`);
    });
    expect((await updateSession(request(token(true)))).user).toEqual({ id: userId, email });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/user"))).toBe(true);
  });

  it("does not authenticate a request without a session cookie", async () => {
    expect((await updateSession(new NextRequest("https://app.example.invalid/"))).user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

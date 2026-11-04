import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { unstable_doesMiddlewareMatch as doesProxyMatch } from "next/experimental/testing/server";
import { config, proxy } from "./proxy";

const updateSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/middleware", () => ({ updateSession }));
beforeEach(() => vi.clearAllMocks());

describe("navigation proxy", () => {
  it.each(["/favicon.png", "/logo-ectolab.png", "/file.svg", "/_next/static/app.js", "/_next/image?url=logo.png"])(
    "does not run session checks for the public asset %s", (url) => {
      expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
    }
  );

  it.each(["/demandas", "/voluntarios", "/api/contratos/123/pdf", "/api/financeiro/ledger"])(
    "keeps session checks on the protected route %s", (url) => {
      expect(doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
    }
  );

  it("preserves auth cookies and private cache headers when redirecting to login", async () => {
    const response = NextResponse.next();
    response.cookies.set("sb-test-auth-token", "", { maxAge: 0 });
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("pragma", "no-cache");
    response.headers.set("expires", "0");
    updateSession.mockResolvedValue({ response, user: null });
    const result = await proxy(new NextRequest("https://painel.ectolab.org/demandas"));
    expect(result.headers.get("location")).toBe("https://painel.ectolab.org/login");
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(result.headers.get("pragma")).toBe("no-cache");
    expect(result.headers.get("expires")).toBe("0");
    expect(result.cookies.get("sb-test-auth-token")?.maxAge).toBe(0);
  });
});

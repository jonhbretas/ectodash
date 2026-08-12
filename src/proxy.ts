import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Redirect do domínio antigo para o novo
const OLD_DOMAIN = "ectodash.vercel.app";
const NEW_DOMAIN = "painel.ectolab.org";

function isPublicPath(pathname: string): boolean {
  // /api/cron/* has NO end-user session by construction (a Vercel Cron
  // invocation, not a browser request) — it authenticates the REQUEST
  // itself via its own CRON_SECRET Bearer-token check inside the route
  // handler (07-RESEARCH.md Security Domain V2). Without this exemption,
  // this proxy would redirect every cron invocation to /login with a 307
  // before the route's own 401 check ever runs, since no `user` session
  // exists for a cron-triggered request.
  return (
    pathname === "/login" ||
    pathname === "/cadastro" ||
    pathname === "/recuperar-senha" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/cron")
  );
}

// Next.js 16 renamed the middleware.ts/middleware() convention to
// proxy.ts/proxy() (functionality unchanged) — see
// node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md. This
// project uses --src-dir, so the file must live alongside src/app, not at
// the repository root (confirmed experimentally: a root-level file was
// registered in the dev middleware manifest but never actually intercepted
// requests under either Turbopack or webpack).
export async function proxy(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;

  // Redirecionar domínio antigo para o novo (301 = permanente)
  if (hostname === OLD_DOMAIN) {
    const url = request.nextUrl.clone();
    url.hostname = NEW_DOMAIN;
    return NextResponse.redirect(url, 301);
  }

  const { response, user } = await updateSession(request);

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    const redirectResponse = NextResponse.redirect(loginUrl);

    // Preserve any cookies already refreshed onto `response` by
    // updateSession() so a redirected request doesn't drop a just-rotated
    // session cookie.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

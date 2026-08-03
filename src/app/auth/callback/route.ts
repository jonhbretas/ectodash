import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Shared by both the magic-link e-mail and the invite e-mail. Both link
// types redirect here with a PKCE `?code=` query parameter; exchanging it
// for a session and redirecting straight into the app is what keeps the
// invite path free of any credential-setting screen (RESEARCH.md Pitfall 2,
// D-01). URL-fragment tokens are never sent to the server, so this handler
// only ever reads the query string (RESEARCH.md Pitfall 4).
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    console.error("auth callback: exchangeCodeForSession failed", error);
  }

  return NextResponse.redirect(
    new URL("/login?erro=link_invalido", request.url)
  );
}

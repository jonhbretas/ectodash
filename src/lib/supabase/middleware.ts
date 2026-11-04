import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

export type SessionUpdate = {
  response: NextResponse;
  user: Pick<User, "id" | "email"> | null;
};

export async function updateSession(
  request: NextRequest
): Promise<SessionUpdate> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers ?? {}).forEach(([name, value]) => {
            supabaseResponse.headers.set(name, value);
          });
        },
      },
    }
  );

  // Verify the token's signature using cached public keys. getClaims also
  // refreshes expiring sessions and falls back to Auth for symmetric keys.
  // Page/action authorization still uses getUser and database permissions.
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims;
  const user = claims?.sub
    ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined }
    : null;

  return { response: supabaseResponse, user };
}

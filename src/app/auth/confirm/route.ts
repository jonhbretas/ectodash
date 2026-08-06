import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "signup";
  const next = searchParams.get("next") ?? "/";

  if (token_hash) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "magiclink" | "recovery",
    });

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("auth confirm: verifyOtp failed", error);
  }

  return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
}

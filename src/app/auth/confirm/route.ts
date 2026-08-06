import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL("/login?erro=conta_confirmada", request.url));
    }

    console.error("auth confirm: exchangeCodeForSession failed", error);
  }

  return NextResponse.redirect(new URL("/login?erro=link_invalido", request.url));
}

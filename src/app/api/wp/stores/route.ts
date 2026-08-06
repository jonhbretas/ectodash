// src/app/api/wp/stores/route.ts
// GET/POST /api/wp/stores — CRUD for WooCommerce store configuration.
// Session-bound via createClient(); RLS gates read access.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("wp_stores")
    .select("id, name, url, vendor_id, is_active, last_sync_at, created_at")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

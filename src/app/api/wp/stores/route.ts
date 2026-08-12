// src/app/api/wp/stores/route.ts
// GET/POST /api/wp/stores — CRUD for WooCommerce store configuration.
// Session-bound via createClient(); RLS gates read access.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceiro } from "@/lib/role-gates";

export async function GET() {
  try { await requireFinanceiro(); } catch {
    return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
  }
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
    console.error("[wp/stores]", error.message);
    return NextResponse.json({ error: "Erro ao consultar lojas." }, { status: 500 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

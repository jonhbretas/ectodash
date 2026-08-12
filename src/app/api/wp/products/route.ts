// src/app/api/wp/products/route.ts
// GET /api/wp/products — list synced WooCommerce products with filters.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceiro } from "@/lib/role-gates";
import { sanitizeSearch } from "@/lib/utils";

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const search = sanitizeSearch(searchParams.get("search") ?? "");
  const status = searchParams.get("status")?.trim() ?? "";

  let query = supabase
    .from("wp_products")
    .select("*")
    .order("synced_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[wp/products]", error.message);
    return NextResponse.json({ error: "Erro ao consultar produtos." }, { status: 500 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

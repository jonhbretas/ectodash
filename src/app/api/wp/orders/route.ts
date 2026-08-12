// src/app/api/wp/orders/route.ts
// GET /api/wp/orders — list synced WooCommerce orders with filters.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceiro } from "@/lib/role-gates";
import { sanitizeSearch } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  const since = searchParams.get("since")?.trim() ?? "";
  const until = searchParams.get("until")?.trim() ?? "";
  const coupon = searchParams.get("coupon")?.trim().slice(0, 100) ?? "";

  let query = supabase
    .from("wp_orders")
    .select("*")
    .order("date_created", { ascending: false });

  if (search) {
    query = query.or(
      `customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`
    );
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (since && DATE_RE.test(since)) {
    query = query.gte("date_created", since);
  }
  if (until && DATE_RE.test(until)) {
    query = query.lte("date_created", until);
  }
  if (coupon) {
    query = query.contains("coupon_codes", [coupon]);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[wp/orders]", error.message);
    return NextResponse.json({ error: "Erro ao consultar pedidos." }, { status: 500 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

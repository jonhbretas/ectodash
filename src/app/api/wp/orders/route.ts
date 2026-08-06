// src/app/api/wp/orders/route.ts
// GET /api/wp/orders — list synced WooCommerce orders with filters.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const since = searchParams.get("since")?.trim() ?? "";
  const until = searchParams.get("until")?.trim() ?? "";
  const coupon = searchParams.get("coupon")?.trim() ?? "";

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
  if (since) {
    query = query.gte("date_created", since);
  }
  if (until) {
    query = query.lte("date_created", until);
  }
  if (coupon) {
    query = query.contains("coupon_codes", [coupon]);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

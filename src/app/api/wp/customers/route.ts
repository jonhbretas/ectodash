// src/app/api/wp/customers/route.ts
// GET /api/wp/customers — list synced WooCommerce customers.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = sanitizeSearch(searchParams.get("search") ?? "");

  let query = supabase
    .from("wp_customers")
    .select("*")
    .order("total_spent", { ascending: false });

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("[wp/customers]", error.message);
    return NextResponse.json({ error: "Erro ao consultar clientes." }, { status: 500 });
  }
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

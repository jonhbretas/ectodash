// GET /api/wp/debug/orders — returns raw WCFM orders for inspection.
// Shows the first 2 orders with full vendor_order_details to debug the filter.
// Auditoria 0063: endpoint de debug desativado em produção (ou sem a flag
// ECTODASH_DEBUG_ENABLED=true) e com gate de role centralizado.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireFinanceiro } from "@/lib/role-gates";

export async function GET() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ECTODASH_DEBUG_ENABLED !== "true"
  ) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  try {
    await requireFinanceiro();
  } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: store } = await admin
    .from("wp_stores")
    .select("url, auth_user, auth_password, vendor_id")
    .eq("is_active", true)
    .single();

  if (!store) {
    return NextResponse.json({ error: "Nenhuma loja ativa" }, { status: 500 });
  }

  const auth = Buffer.from(`${store.auth_user}:${store.auth_password}`).toString("base64");
  const url = `${store.url}/wp-json/wcfmmp/v1/orders?per_page=5`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    cache: "no-store",
  });

  const raw = await res.json();

  // Return: raw response, plus analysis of vendor_order_details per order.
  const analysis = Array.isArray(raw)
    ? raw.slice(0, 2).map((o: Record<string, unknown>) => ({
        id: o.id,
        commission_head: o.commission_head,
        order_meta_data: o.meta_data,
        first_line_item: (o.line_items as Array<Record<string, unknown>>)?.[0]
          ? {
              name: (o.line_items as Array<Record<string, unknown>>)[0].name,
              product_id: (o.line_items as Array<Record<string, unknown>>)[0].product_id,
              meta_data: (o.line_items as Array<Record<string, unknown>>)[0].meta_data,
            }
          : null,
      }))
    : null;

  return NextResponse.json({
    total_orders: Array.isArray(raw) ? raw.length : 0,
    status: res.status,
    ok: res.ok,
    store_vendor_id: store.vendor_id,
    analysis,
  });
}

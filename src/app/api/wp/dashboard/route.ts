// src/app/api/wp/dashboard/route.ts
// GET /api/wp/dashboard — aggregated KPIs for the WooCommerce dashboard.
// Returns: total revenue, total orders, unique customers, avg ticket,
// top products, recent orders, and sync status.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Fetch all data in parallel — independent reads.
  const [ordersResult, customersResult, productsResult, syncResult] =
    await Promise.all([
      supabase
        .from("wp_orders")
        .select("id, total, customer_email, customer_name, date_created, status, items_summary, coupon_codes"),
      supabase
        .from("wp_customers")
        .select("id, email, first_name, last_name, orders_count, total_spent"),
      supabase
        .from("wp_products")
        .select("id, name, price, image_url, categories")
        .order("price", { ascending: false }),
      supabase
        .from("wp_sync_log")
        .select("id, status, trigger_source, started_at, finished_at, products_synced, orders_synced, customers_synced, error")
        .order("started_at", { ascending: false })
        .limit(5),
    ]);

  const orders = ordersResult.data ?? [];
  const customers = customersResult.data ?? [];
  const products = productsResult.data ?? [];
  const syncLogs = syncResult.data ?? [];

  // ── KPIs ──────────────────────────────────────────────────────────
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const totalOrders = orders.length;
  const uniqueCustomers = new Set(
    orders.filter((o) => o.customer_email).map((o) => o.customer_email)
  ).size;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // ── Top products by order count (from items_summary) ──────────────
  const productCountMap = new Map<string, { name: string; count: number; revenue: number }>();
  for (const order of orders) {
    const items = (order.items_summary as Array<{ name: string; qty: number; subtotal: number }>) ?? [];
    for (const item of items) {
      const existing = productCountMap.get(item.name) ?? {
        name: item.name,
        count: 0,
        revenue: 0,
      };
      existing.count += item.qty;
      existing.revenue += item.subtotal;
      productCountMap.set(item.name, existing);
    }
  }
  const topProducts = [...productCountMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // ── Recent orders (last 10) ───────────────────────────────────────
  const recentOrders = orders
    .sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    )
    .slice(0, 10);

  return NextResponse.json({
    kpis: {
      totalRevenue,
      totalOrders,
      uniqueCustomers,
      avgTicket,
    },
    topProducts,
    recentOrders,
    syncLogs,
    productsCount: products.length,
    customersCount: customers.length,
  });
}

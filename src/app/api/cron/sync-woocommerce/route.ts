// src/app/api/cron/sync-woocommerce/route.ts
// GET /api/cron/sync-woocommerce — Vercel Cron-triggered, CRON_SECRET-gated.
// Optimized: parallel fetch + parallel upsert, per_page=1000, 200ms rate limit.
import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchProducts,
  fetchOrders,
} from "@/lib/woocommerce/client";
import {
  validateProducts,
  validateOrders,
} from "@/lib/woocommerce/schemas";
import { linkStoreToProep } from "@/lib/woocommerce/proep-link";

type StoreRow = {
  id: string;
  url: string;
  auth_user: string;
  auth_password: string;
  vendor_id: number | null;
  last_sync_at: string | null;
};

function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!authHeader || !constantTimeEqual(authHeader, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: run, error: runInsertError } = await supabase
    .from("wp_sync_log")
    .insert({ status: "running", trigger_source: "cron" })
    .select("id")
    .single();

  if (runInsertError || !run) {
    return Response.json(
      { error: "failed to start sync run" },
      { status: 500 }
    );
  }

  const runId = run.id as string;
  const startedAt = Date.now();

  async function finalize(
    status: "success" | "failed",
    counts: { products: number; orders: number; customers: number },
    errorMessage?: string
  ) {
    await supabase
      .from("wp_sync_log")
      .update({
        status,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        products_synced: counts.products,
        orders_synced: counts.orders,
        customers_synced: counts.customers,
        error_message: errorMessage,
      })
      .eq("id", runId);
  }

  try {
    const { data: stores, error: storesError } = await supabase
      .from("wp_stores")
      .select("id, url, auth_user, auth_password, vendor_id, last_sync_at")
      .eq("is_active", true);

    if (storesError || !stores || stores.length === 0) {
      throw new Error(
        storesError?.message ?? "Nenhuma loja WooCommerce ativa encontrada"
      );
    }

    const totals = { products: 0, orders: 0, customers: 0 };

    for (const store of stores as StoreRow[]) {
      const storeCredentials = {
        id: store.id,
        url: store.url,
        auth_user: store.auth_user,
        auth_password: store.auth_password,
        vendor_id: store.vendor_id,
      };

      // Products sync: use last_sync_at (or 30 days for first sync).
      const productsModifiedAfter = store.last_sync_at
        ? new Date(store.last_sync_at).toISOString()
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Orders sync: incremental — fetch only since the most recent order we have.
      // First sync: last7 days only.
      const { data: lastOrder } = await supabase
        .from("wp_orders")
        .select("date_created")
        .eq("store_id", store.id)
        .order("date_created", { ascending: false })
        .limit(1)
        .maybeSingle();

      const ordersAfter = lastOrder?.date_created
        ? new Date(lastOrder.date_created).toISOString()
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch products and orders in parallel.
      const [rawProducts, rawOrders] = await Promise.all([
        fetchProducts(storeCredentials, productsModifiedAfter),
        fetchOrders(storeCredentials, ordersAfter),
      ]);

      const products = validateProducts(rawProducts);
      if (products === null) throw new Error("Dados de produto inválidos");

      const orders = validateOrders(rawOrders);
      if (orders === null) throw new Error("Dados de pedido inválidos");

      // Filter orders: keep only those containing products from THIS vendor.
      // This is more reliable than _vendor_id meta (which may be missing).
      const vendorProductIds = new Set(products.map((p) => p.id));
      const vendorOrders = orders.filter((o) =>
        o.line_items?.some((item) => vendorProductIds.has(item.product_id))
      );

      // Deduplicate by ID (WCFM can return duplicates in pagination).
      const uniqueOrders = [...new Map(vendorOrders.map((o) => [o.id, o])).values()];
      const uniqueProducts = [...new Map(products.map((p) => [p.id, p])).values()];

      // Extract unique customers from orders (vendor-scoped).
      const customerMap = new Map<number, {
        wp_customer_id: number;
        email: string;
        first_name: string;
        last_name: string;
        orders_count: number;
        total_spent: number;
        billing: Record<string, string>;
        shipping: Record<string, string>;
        courses: Set<string>;
      }>();

      for (const order of uniqueOrders) {
        if (!order.customer_id) continue;
        const existing = customerMap.get(order.customer_id);
        const itemNames = (order.line_items ?? []).map((li) => li.name).filter(Boolean);
        if (existing) {
          existing.orders_count += 1;
          existing.total_spent += order.total;
          for (const n of itemNames) existing.courses.add(n);
        } else {
          customerMap.set(order.customer_id, {
            wp_customer_id: order.customer_id,
            email: order.billing.email,
            first_name: order.billing.first_name,
            last_name: order.billing.last_name,
            orders_count: 1,
            total_spent: order.total,
            billing: order.billing,
            shipping: order.shipping,
            courses: new Set(itemNames),
          });
        }
      }

      const customers = [...customerMap.values()];

      totals.products += uniqueProducts.length;
      totals.orders += uniqueOrders.length;
      totals.customers += customers.length;

      // Upsert products, orders, and customers in parallel.
      await Promise.all([
        uniqueProducts.length > 0
          ? supabase
              .from("wp_products")
              .upsert(
                uniqueProducts.map((p) => ({
                  store_id: store.id,
                  wp_product_id: p.id,
                  name: p.name,
                  sku: p.sku,
                  price: p.price,
                  regular_price: p.regular_price,
                  sale_price: p.sale_price,
                  stock_quantity: p.stock_quantity,
                  status: p.status,
                  categories: JSON.parse(JSON.stringify(p.categories)),
                  image_url: p.images?.[0]?.src ?? null,
                  date_created: p.date_created,
                  date_modified: p.date_modified,
                  synced_at: new Date().toISOString(),
                })),
                { onConflict: "store_id,wp_product_id" }
              )
              .then(({ error }) => {
                if (error) throw new Error(`wp_products: ${error.message}`);
              })
          : null,
        uniqueOrders.length > 0
          ? supabase
              .from("wp_orders")
              .upsert(
                uniqueOrders.map((o) => ({
                  store_id: store.id,
                  wp_order_id: o.id,
                  status: o.status,
                  total: o.total,
                  total_tax: o.total_tax,
                  discount_total: o.discount_total,
                  currency: o.currency,
                  payment_method: o.payment_method,
                  commission_amount: o.vendor_order_details
                    ? parseFloat(o.vendor_order_details.commission_amount) || null
                    : null,
                  commission_status: o.vendor_order_details?.commission_status ?? null,
                  customer_id: o.customer_id,
                  customer_email: o.billing.email,
                  customer_name: `${o.billing.first_name} ${o.billing.last_name}`.trim(),
                  items_summary: JSON.parse(
                    JSON.stringify(
                      o.line_items.map((li) => ({
                        name: li.name,
                        qty: li.quantity,
                        subtotal: parseFloat(li.total) || 0,
                      }))
                    )
                  ),
                  coupon_codes: o.coupon_lines.map((c) => c.code),
                  date_created: o.date_created,
                  date_modified: o.date_modified,
                  synced_at: new Date().toISOString(),
                })),
                { onConflict: "store_id,wp_order_id" }
              )
              .then(({ error }) => {
                if (error) throw new Error(`wp_orders: ${error.message}`);
              })
          : null,
        customers.length > 0
          ? supabase
              .from("wp_customers")
              .upsert(
                customers.map((c) => ({
                  store_id: store.id,
                  wp_customer_id: c.wp_customer_id,
                  email: c.email,
                  first_name: c.first_name,
                  last_name: c.last_name,
                  billing: JSON.parse(JSON.stringify(c.billing || {})),
                  shipping: JSON.parse(JSON.stringify(c.shipping || {})),
                  orders_count: c.orders_count,
                  total_spent: c.total_spent,
                  courses: [...c.courses],
                  date_created: null,
                  synced_at: new Date().toISOString(),
                })),
                { onConflict: "store_id,wp_customer_id" }
              )
              .then(({ error }) => {
                if (error) throw new Error(`wp_customers: ${error.message}`);
              })
          : null,
      ]);

      await supabase
        .from("wp_stores")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", store.id);

      // Vínculo com o PROEP: cursos dos clientes + participantes por turma
      try {
        await linkStoreToProep(supabase, store.id);
      } catch (e: any) {
        console.error(`[cron] vínculo PROEP falhou (store ${store.id}):`, e.message);
      }
    }

    await finalize("success", totals);
    return Response.json(totals);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    await finalize("failed", { products: 0, orders: 0, customers: 0 }, message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}

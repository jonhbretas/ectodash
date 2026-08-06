// src/app/api/cron/sync-woocommerce/route.ts
// GET /api/cron/sync-woocommerce — Vercel Cron-triggered, CRON_SECRET-gated.
// Optimized: parallel fetch + parallel upsert, per_page=1000, 200ms rate limit.
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchProducts,
  fetchOrders,
  fetchCustomers,
} from "@/lib/woocommerce/client";
import {
  validateProducts,
  validateOrders,
  validateCustomers,
} from "@/lib/woocommerce/schemas";

type StoreRow = {
  id: string;
  url: string;
  auth_user: string;
  auth_password: string;
  vendor_id: number | null;
  last_sync_at: string | null;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

      const modifiedAfter = store.last_sync_at
        ? new Date(store.last_sync_at).toISOString()
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all three in parallel
      const [rawProducts, rawOrders, rawCustomers] = await Promise.all([
        fetchProducts(storeCredentials, modifiedAfter),
        fetchOrders(storeCredentials, modifiedAfter),
        fetchCustomers(storeCredentials),
      ]);

      const products = validateProducts(rawProducts);
      if (products === null) throw new Error("Dados de produto inválidos");

      const orders = validateOrders(rawOrders);
      if (orders === null) throw new Error("Dados de pedido inválidos");

      const customers = validateCustomers(rawCustomers);
      if (customers === null) throw new Error("Dados de cliente inválidos");

      // Upsert all three in parallel
      const upserts: Promise<void>[] = [];

      if (products.length > 0) {
        upserts.push(
          supabase
            .from("wp_products")
            .upsert(
              products.map((p) => ({
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
        );
        totals.products += products.length;
      }

      if (orders.length > 0) {
        upserts.push(
          supabase
            .from("wp_orders")
            .upsert(
              orders.map((o) => ({
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
        );
        totals.orders += orders.length;
      }

      if (customers.length > 0) {
        upserts.push(
          supabase
            .from("wp_customers")
            .upsert(
              customers.map((c) => ({
                store_id: store.id,
                wp_customer_id: c.id,
                email: c.email,
                first_name: c.first_name,
                last_name: c.last_name,
                billing: JSON.parse(JSON.stringify(c.billing)),
                shipping: JSON.parse(JSON.stringify(c.shipping)),
                orders_count: c.orders_count,
                total_spent: c.total_spent,
                date_created: c.date_created,
                synced_at: new Date().toISOString(),
              })),
              { onConflict: "store_id,wp_customer_id" }
            )
            .then(({ error }) => {
              if (error) throw new Error(`wp_customers: ${error.message}`);
            })
        );
        totals.customers += customers.length;
      }

      await Promise.all(upserts);

      await supabase
        .from("wp_stores")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", store.id);
    }

    await finalize("success", totals);
    return Response.json(totals);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    await finalize("failed", { products: 0, orders: 0, customers: 0 }, message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}

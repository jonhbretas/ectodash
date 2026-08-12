// src/lib/woocommerce/client.ts
// WooCommerce WCFM REST API client — read-only, server-side only.
// Optimized for speed: per_page=1000, 200ms rate limit, 30s timeout.
const RATE_LIMIT_MS = 50;
const PER_PAGE = "100";
const REQUEST_TIMEOUT_MS = 30_000;

type WpStore = {
  id: string;
  url: string;
  auth_user: string;
  auth_password: string;
  vendor_id: number | null;
};

let lastRequestAt = 0;

async function wpFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

async function wpGet<T>(
  store: WpStore,
  path: string,
  params?: Record<string, string>,
  maxPages?: number
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;

  while (true) {
    const qs = new URLSearchParams({ per_page: PER_PAGE, page: String(page), ...params });
    const url = `${store.url}${path}?${qs}`;
    const res = await wpFetch(url, {
      headers: {
        Authorization: basicAuth(store.auth_user, store.auth_password),
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[woocommerce] API ${res.status}:`, body.slice(0, 200));
      throw new Error(`WooCommerce API error: ${res.status}`);
    }

    const data = (await res.json()) as T[];
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...data);
    if (data.length < Number(PER_PAGE)) break;
    if (maxPages && page >= maxPages) break;
    page++;
  }

  return out;
}

// ── Products ──────────────────────────────────────────────────────────
export type WpProduct = {
  id: number;
  name: string;
  sku: string | null;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  status: string;
  categories: Array<{ id: number; name: string }>;
  images: Array<{ src: string }>;
  date_created: string;
  date_modified: string;
};

export async function fetchProducts(
  store: WpStore,
  modifiedAfter?: string,
  modifiedBefore?: string,
  maxPages?: number
): Promise<WpProduct[]> {
  const params: Record<string, string> = {};
  if (modifiedAfter) params.modified_after = modifiedAfter;
  if (modifiedBefore) params.modified_before = modifiedBefore;
  // Use vendor-specific endpoint to ensure ONLY this vendor's products.
  const vendorId = store.vendor_id;
  if (!vendorId) throw new Error("vendor_id não configurado na loja");
  return wpGet<WpProduct>(store, `/wp-json/wcfmmp/v1/store-vendors/${vendorId}/products`, params, maxPages);
}

// ── Orders ────────────────────────────────────────────────────────────
export type WpOrder = {
  id: number;
  status: string;
  total: string;
  total_tax: string;
  discount_total: string;
  currency: string;
  payment_method: string;
  customer_id: number | null;
  customer_note: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  line_items: Array<{
    id: number;
    product_id: number;
    name: string;
    quantity: number;
    total: string;
    meta_data: Array<{ key: string; value: unknown }>;
  }>;
  coupon_lines: Array<{ code: string }>;
  date_created: string;
  date_created_gmt?: string;
  date_modified: string;
  vendor_order_details?: {
    vendor_id: string;
    commission_amount: string;
    commission_status: string;
  };
};

// The WCFM orders endpoint (wcfmmp/v1/orders) IGNORES date filters
// (before/after/date_min/date_max) and always returns the newest orders
// first — so it cannot walk back in history. The native WooCommerce
// endpoint honors before/after, so backfill goes through it.
// date_created_gmt is stored as the order date so the cutoff math stays
// in UTC (dates_are_gmt=true) and never drifts.
export async function fetchOrders(
  store: WpStore,
  after?: string,
  before?: string
): Promise<WpOrder[]> {
  const params: Record<string, string> = {};
  if (after) params.after = after;
  if (before) params.before = before;
  // Limit to 5 pages (500 orders) to avoid Vercel timeout.
  // WCFM /orders returns ALL marketplace orders — we filter by vendor product IDs after.
  return wpGet<WpOrder>(store, "/wp-json/wcfmmp/v1/orders", params, 5);
}

// History: fetches orders inside a date window (after..before, both
// optional, UTC) walking FORWARD from the oldest record
// (orderby=date&order=asc), so each page is immediately usable history.
// Backfill uses only `before` (walk further back one click at a time);
// period fetches pass both `after` and `before` (custom date range).
export async function fetchOrdersHistory(
  store: WpStore,
  after?: string,
  before?: string,
  maxPages?: number
): Promise<WpOrder[]> {
  const params: Record<string, string> = {
    dates_are_gmt: "true",
    orderby: "date",
    order: "asc",
  };
  if (after) params.after = after;
  if (before) params.before = before;
  return wpGet<WpOrder>(store, "/wp-json/wc/v3/orders", params, maxPages);
}

// ── Customers (WooCommerce standard — WCFM has no customer endpoint) ──
export type WpCustomer = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  billing: Record<string, string>;
  shipping: Record<string, string>;
  orders_count: number;
  total_spent: string;
  date_created: string;
};

export async function fetchCustomers(
  store: WpStore
): Promise<WpCustomer[]> {
  return wpGet<WpCustomer>(store, "/wp-json/wc/v3/customers");
}

// src/lib/woocommerce/client.ts
// WooCommerce WCFM REST API client — read-only, server-side only.
// Follows the same pattern as src/lib/sheets/client.ts: built only inside
// api/cron/ or api/wp/ contexts, never imported into dashboard components.
//
// Authentication: HTTP Basic Auth via WordPress Application Passwords.
// WCFM endpoints are scoped to the authenticated vendor — only ECTOLAB
// data is returned when using the ECTOLAB vendor credentials.
//
// Rate limiting: 1 request per second to avoid overwhelming the WordPress
// server. Pagination: WCFM/WC return max 100 items per page.
const RATE_LIMIT_MS = 1000;

type WpStore = {
  id: string;
  url: string;
  auth_user: string;
  auth_password: string;
  vendor_id: number | null;
};

let lastRequestAt = 0;

async function rateLimitedFetch(url: string, init?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestAt = Date.now();
  return fetch(url, { ...init, cache: "no-store" });
}

function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

async function wpGet<T>(
  store: WpStore,
  path: string,
  params?: Record<string, string>
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;

  while (true) {
    const qs = new URLSearchParams({ per_page: "100", page: String(page), ...params });
    const url = `${store.url}${path}?${qs}`;
    const res = await rateLimitedFetch(url, {
      headers: {
        Authorization: basicAuth(store.auth_user, store.auth_password),
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`WooCommerce API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as T[];
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...data);
    if (data.length < 100) break;
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
  modifiedAfter?: string
): Promise<WpProduct[]> {
  const params: Record<string, string> = {};
  if (modifiedAfter) params.modified_after = modifiedAfter;
  return wpGet<WpProduct>(store, "/wp-json/wcfmmp/v1/products", params);
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
    name: string;
    quantity: number;
    total: string;
    meta_data: Array<{ key: string; value: string }>;
  }>;
  coupon_lines: Array<{ code: string }>;
  date_created: string;
  date_modified: string;
  vendor_order_details?: {
    vendor_id: string;
    commission_amount: string;
    commission_status: string;
  };
};

export async function fetchOrders(
  store: WpStore,
  after?: string
): Promise<WpOrder[]> {
  const params: Record<string, string> = {};
  if (after) params.after = after;
  return wpGet<WpOrder>(store, "/wp-json/wcfmmp/v1/orders", params);
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

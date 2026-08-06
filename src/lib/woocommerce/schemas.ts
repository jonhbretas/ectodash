// src/lib/woocommerce/schemas.ts
// Zod validation schemas for WooCommerce WCFM API responses.
// Follows the same pattern as src/lib/sheets/parse-rows.ts: validate
// external data before database insert, reject entire batch on failure.
import { z } from "zod";

// ── Product ───────────────────────────────────────────────────────────
export const wpProductSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  sku: z.string().nullable(),
  price: z.string().transform((v) => parseFloat(v) || 0),
  regular_price: z.string().transform((v) => parseFloat(v) || 0),
  sale_price: z.string().transform((v) => parseFloat(v) || 0),
  stock_quantity: z.number().nullable(),
  status: z.string(),
  categories: z.array(
    z.object({ id: z.number(), name: z.string() })
  ),
  images: z.array(
    z.object({ src: z.string() })
  ),
  date_created: z.string(),
  date_modified: z.string(),
});

export type ValidatedProduct = z.infer<typeof wpProductSchema>;

export function validateProducts(
  raw: unknown[]
): ValidatedProduct[] | null {
  const results: ValidatedProduct[] = [];
  for (const item of raw) {
    const parsed = wpProductSchema.safeParse(item);
    if (!parsed.success) return null;
    results.push(parsed.data);
  }
  return results;
}

// ── Order ─────────────────────────────────────────────────────────────
export const wpOrderSchema = z.object({
  id: z.number(),
  status: z.string(),
  total: z.string().transform((v) => parseFloat(v) || 0),
  total_tax: z.string().transform((v) => parseFloat(v) || 0),
  discount_total: z.string().transform((v) => parseFloat(v) || 0),
  currency: z.string(),
  payment_method: z.string(),
  customer_id: z.number().nullable(),
  billing: z.object({
    first_name: z.string(),
    last_name: z.string(),
    email: z.string(),
    phone: z.string().optional(),
  }),
  shipping: z.record(z.string(), z.string()).default({}),
  line_items: z.array(
    z.object({
      id: z.number(),
      product_id: z.number(),
      name: z.string(),
      quantity: z.number(),
      total: z.string(),
      meta_data: z.array(
        z.object({ key: z.string(), value: z.string() })
      ),
    })
  ),
  coupon_lines: z.array(
    z.object({ code: z.string() })
  ),
  date_created: z.string(),
  date_modified: z.string(),
  vendor_order_details: z
    .object({
      vendor_id: z.string(),
      commission_amount: z.string(),
      commission_status: z.string(),
    })
    .optional(),
});

export type ValidatedOrder = z.infer<typeof wpOrderSchema>;

export function validateOrders(
  raw: unknown[]
): ValidatedOrder[] | null {
  const results: ValidatedOrder[] = [];
  for (const item of raw) {
    const parsed = wpOrderSchema.safeParse(item);
    if (!parsed.success) return null;
    results.push(parsed.data);
  }
  return results;
}

// ── Customer ──────────────────────────────────────────────────────────
export const wpCustomerSchema = z.object({
  id: z.number(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  billing: z.record(z.string(), z.string()),
  shipping: z.record(z.string(), z.string()),
  orders_count: z.number(),
  total_spent: z.string().transform((v) => parseFloat(v) || 0),
  date_created: z.string(),
});

export type ValidatedCustomer = z.infer<typeof wpCustomerSchema>;

export function validateCustomers(
  raw: unknown[]
): ValidatedCustomer[] | null {
  const results: ValidatedCustomer[] = [];
  for (const item of raw) {
    const parsed = wpCustomerSchema.safeParse(item);
    if (!parsed.success) return null;
    results.push(parsed.data);
  }
  return results;
}

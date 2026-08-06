-- WooCommerce WCFM integration tables for ECTOLAB marketplace data.
-- These tables mirror products, orders, customers, and sync logs from
-- the WCFM REST API. All writes happen via the service-role admin client
-- in the sync-woocommerce cron route; RLS policies (migration 0035) gate
-- read access to coordenador_geral and financeiro roles only.

-- Store configuration — one row per connected WooCommerce store.
-- Credentials are stored server-side only (never exposed to the frontend).
create table if not exists wp_stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  auth_user text not null,
  auth_password text not null,
  vendor_id bigint,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

-- Products/courses from the store.
-- Upserted on (store_id, wp_product_id) to support idempotent sync.
create table if not exists wp_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references wp_stores(id) on delete cascade,
  wp_product_id bigint not null,
  name text not null,
  sku text,
  price numeric(12,2),
  regular_price numeric(12,2),
  sale_price numeric(12,2),
  stock_quantity integer,
  status text,
  categories jsonb,
  image_url text,
  date_created timestamptz,
  date_modified timestamptz,
  synced_at timestamptz not null default now(),
  unique(store_id, wp_product_id)
);

-- Orders/sales from the store.
-- Includes vendor-specific commission data from WCFM.
create table if not exists wp_orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references wp_stores(id) on delete cascade,
  wp_order_id bigint not null,
  status text,
  total numeric(12,2),
  total_tax numeric(12,2),
  discount_total numeric(12,2),
  currency text,
  payment_method text,
  commission_amount numeric(12,2),
  commission_status text,
  customer_id bigint,
  customer_email text,
  customer_name text,
  items_summary jsonb,
  coupon_codes text[],
  date_created timestamptz,
  date_modified timestamptz,
  synced_at timestamptz not null default now(),
  unique(store_id, wp_order_id)
);

-- Customers who purchased from the store.
-- Source: WooCommerce /wc/v3/customers (WCFM has no customer endpoint).
create table if not exists wp_customers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references wp_stores(id) on delete cascade,
  wp_customer_id bigint not null,
  email text,
  first_name text,
  last_name text,
  billing jsonb,
  shipping jsonb,
  orders_count integer,
  total_spent numeric(12,2),
  date_created timestamptz,
  synced_at timestamptz not null default now(),
  unique(store_id, wp_customer_id)
);

-- Sync run log — mirrors the sheet_sync_runs pattern from migration 0006.
-- Each cron/manual sync creates a row with status "running", finalized
-- to "success" or "failed" with counts and duration.
create table if not exists wp_sync_log (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references wp_stores(id) on delete cascade,
  status text not null default 'running',
  trigger_source text not null default 'cron',
  products_synced integer default 0,
  orders_synced integer default 0,
  customers_synced integer default 0,
  duration_ms integer,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- Seed the ECTOLAB store with credentials from environment variables.
-- The sync-woocommerce route reads this row to authenticate API calls.
-- If the row already exists (idempotent), it is not re-inserted.
insert into wp_stores (name, url, auth_user, auth_password, vendor_id, is_active)
values (
  'Ectolab',
  'https://store.conscienciologia.org.br',
  'jonathan.bretas',
  '3H9R Lp4r dzBA 2yH4 Fvmr aRO2',
  17,
  true
)
on conflict do nothing;

-- RLS policies for WooCommerce tables (migration 0034).
-- Follows the same pattern as migration 0006 (financial_entries):
--   - SELECT: role-gated via has_role('coordenador_geral') or has_role('financeiro')
--   - No INSERT/UPDATE/DELETE policies — service-role admin client bypasses RLS

alter table wp_stores enable row level security;
alter table wp_products enable row level security;
alter table wp_orders enable row level security;
alter table wp_customers enable row level security;
alter table wp_sync_log enable row level security;

-- wp_stores: read access for coordinators and financeiro
create policy "wp_stores read"
  on wp_stores for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
  );

-- wp_products: read access for coordinators and financeiro
create policy "wp_products read"
  on wp_products for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
  );

-- wp_orders: read access for coordinators and financeiro
create policy "wp_orders read"
  on wp_orders for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
  );

-- wp_customers: read access for coordinators and financeiro
create policy "wp_customers read"
  on wp_customers for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
  );

-- wp_sync_log: read access for coordinators and financeiro
create policy "wp_sync_log read"
  on wp_sync_log for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
  );

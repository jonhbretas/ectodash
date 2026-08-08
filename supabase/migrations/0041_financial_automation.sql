-- Institutional financial ledger. The legacy financial_entries snapshot remains
-- untouched; this schema is append-only, idempotent and fully traceable.
create extension if not exists pgcrypto;

create table public.finance_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_sha256 text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0),
  storage_path text,
  source_type text not null default 'UNKNOWN' check (source_type in ('BANK_STATEMENT','PAYMENT_PROCESSOR','CARD_INVOICE','INVESTMENT','REVENUE','EXPENSE','CASH','UNKNOWN')),
  provider text,
  period_start date,
  period_end date,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','PROCESSING','PROCESSED','PARTIAL','FAILED','DUPLICATE')),
  row_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.finance_entities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('COMPANY','BANK','ACCOUNT','PROVIDER','WALLET','CARD','INVESTMENT','SUPPLIER','CUSTOMER','REVENUE_CENTER','COST_CENTER','CATEGORY','PAYMENT_METHOD')),
  name text not null,
  normalized_name text not null,
  document text,
  external_id text,
  agency text,
  account_number text,
  metadata jsonb not null default '{}'::jsonb,
  confidence numeric(5,4) not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique(kind, normalized_name),
  unique(kind, document) 
);
create index finance_entities_lookup on public.finance_entities(kind, normalized_name);
create index finance_entities_document on public.finance_entities(document);

create table public.finance_ledger (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.finance_imports(id) on delete restrict,
  file_name text not null, sheet_name text, source_line integer, source_column text,
  line_hash text not null,
  external_transaction_id text,
  company_id uuid references public.finance_entities(id), account_id uuid references public.finance_entities(id),
  provider_id uuid references public.finance_entities(id), customer_id uuid references public.finance_entities(id),
  supplier_id uuid references public.finance_entities(id), revenue_center_id uuid references public.finance_entities(id),
  cost_center_id uuid references public.finance_entities(id), category_id uuid references public.finance_entities(id),
  payment_method_id uuid references public.finance_entities(id),
  movement_date date not null, competence_date date, sale_date date, settlement_date date, expected_date date,
  type text not null check (type in ('RECEITA_FATURADA','RECEITA_RECEBIDA','DESPESA','TRANSFERENCIA_INTERNA','APLICACAO','RESGATE','RENDIMENTO_FINANCEIRO','ESTORNO','CHARGEBACK','TARIFA','AJUSTE','SALDO_INICIAL','SALDO_FINAL')),
  original_description text not null, normalized_description text not null,
  gross_amount numeric(18,2) not null default 0, fee_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0, refund_amount numeric(18,2) not null default 0,
  chargeback_amount numeric(18,2) not null default 0, net_amount numeric(18,2) not null default 0,
  inflow numeric(18,2) not null default 0, outflow numeric(18,2) not null default 0,
  currency char(3) not null default 'BRL',
  reconciliation_status text not null default 'PENDENTE' check (reconciliation_status in ('CONCILIADO','PARCIALMENTE_CONCILIADO','PENDENTE','DIVERGENTE','DUPLICADO','IGNORADO')),
  confidence numeric(5,4) not null default 0 check (confidence between 0 and 1), classification_explanation text,
  created_by text not null default 'importer', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(import_id, line_hash)
);
create index finance_ledger_dates on public.finance_ledger(movement_date, type);
create index finance_ledger_reconciliation on public.finance_ledger(reconciliation_status);
create index finance_ledger_external on public.finance_ledger(external_transaction_id);

create table public.finance_rules (
  id uuid primary key default gen_random_uuid(), name text not null, priority integer not null default 100,
  condition jsonb not null, action jsonb not null, company_id uuid references public.finance_entities(id), account_id uuid references public.finance_entities(id),
  result_category_id uuid references public.finance_entities(id), confidence numeric(5,4) not null default .8,
  active boolean not null default true, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create index finance_rules_active_priority on public.finance_rules(active, priority);

create table public.finance_reconciliations (
  id uuid primary key default gen_random_uuid(), kind text not null, status text not null default 'PENDENTE',
  amount numeric(18,2) not null default 0, difference numeric(18,2) not null default 0, criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz
);
create table public.finance_reconciliation_items (
  reconciliation_id uuid not null references public.finance_reconciliations(id) on delete cascade,
  ledger_id uuid not null references public.finance_ledger(id) on delete restrict,
  primary key(reconciliation_id, ledger_id), unique(ledger_id)
);

create table public.finance_exceptions (
  id uuid primary key default gen_random_uuid(), import_id uuid references public.finance_imports(id) on delete cascade,
  problem text not null, affected_amount numeric(18,2) not null default 0, ledger_ids uuid[] not null default '{}',
  recommendation text, alternatives jsonb not null default '[]'::jsonb, revenue_impact numeric(18,2) not null default 0,
  balance_impact numeric(18,2) not null default 0, status text not null default 'OPEN' check(status in ('OPEN','APPROVED','REJECTED','RESOLVED')),
  created_at timestamptz not null default now(), resolved_by uuid references public.profiles(id), resolved_at timestamptz
);

create table public.finance_audit_log (
  id bigint generated always as identity primary key, ledger_id uuid references public.finance_ledger(id), import_id uuid references public.finance_imports(id),
  action text not null, before_data jsonb, after_data jsonb, actor text not null default 'system', created_at timestamptz not null default now()
);

create or replace view public.finance_receivables with (security_invoker = true) as
select l.provider_id, l.company_id, coalesce(sum(l.net_amount),0) as billed,
       coalesce(sum(case when l.reconciliation_status in ('CONCILIADO','PARCIALMENTE_CONCILIADO') then l.net_amount else 0 end),0) as received,
       coalesce(sum(l.net_amount),0) - coalesce(sum(case when l.reconciliation_status in ('CONCILIADO','PARCIALMENTE_CONCILIADO') then l.net_amount else 0 end),0) as outstanding
from public.finance_ledger l where l.type = 'RECEITA_FATURADA' group by l.provider_id, l.company_id;

create or replace view public.finance_consolidated_balance with (security_invoker = true) as
select coalesce(sum(inflow - outflow) filter (where type not in ('TRANSFERENCIA_INTERNA','SALDO_FINAL')),0) as consolidated_balance,
       coalesce(sum(gross_amount - fee_amount - tax_amount - refund_amount - chargeback_amount) filter (where type = 'RECEITA_FATURADA'),0) as net_billing,
       coalesce(sum(inflow) filter (where type = 'RECEITA_RECEBIDA'),0) as received,
       coalesce(sum(outflow) filter (where type = 'DESPESA'),0) as expenses
from public.finance_ledger;

alter table public.finance_imports enable row level security;
alter table public.finance_entities enable row level security;
alter table public.finance_ledger enable row level security;
alter table public.finance_rules enable row level security;
alter table public.finance_reconciliations enable row level security;
alter table public.finance_reconciliation_items enable row level security;
alter table public.finance_exceptions enable row level security;
alter table public.finance_audit_log enable row level security;

create policy "finance roles read imports" on public.finance_imports for select to authenticated using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));
create policy "finance roles read entities" on public.finance_entities for select to authenticated using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));
create policy "finance roles read ledger" on public.finance_ledger for select to authenticated using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));
create policy "finance roles read rules" on public.finance_rules for all to authenticated using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral'))) with check ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));
create policy "finance roles read reconciliations" on public.finance_reconciliations for all to authenticated using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral'))) with check ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));
create policy "finance roles read reconciliation items" on public.finance_reconciliation_items for all to authenticated using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral'))) with check ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));
create policy "finance roles read exceptions" on public.finance_exceptions for all to authenticated using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral'))) with check ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));
create policy "finance roles read audit" on public.finance_audit_log for select to authenticated using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));

grant select on public.finance_receivables, public.finance_consolidated_balance to authenticated;

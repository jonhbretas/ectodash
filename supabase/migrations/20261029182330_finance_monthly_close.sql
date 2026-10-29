-- Mês financeiro com checklist controlado e trilha de fechamento.
create table public.finance_periods (
  id uuid primary key default gen_random_uuid(),
  competencia date not null unique check (extract(day from competencia) = 1),
  status text not null default 'ABERTO' check (status in ('ABERTO', 'FECHADO')),
  checklist jsonb not null default '{"extratos": false, "recebimentos": false, "conciliacao": false, "cartao": false, "notas": false, "pagamentos": false}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'ABERTO' and closed_by is null and closed_at is null) or (status = 'FECHADO' and closed_by is not null and closed_at is not null))
);
create index finance_periods_status_date on public.finance_periods(status, competencia desc);

alter table public.finance_periods enable row level security;
create policy "cargo financeiro pode gerir períodos"
  on public.finance_periods for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
grant select, insert, update on public.finance_periods to authenticated;

-- supabase/migrations/0113_contas_recorrencia_mensal.sql
-- Débitos mensais (aluguel, internet, contador…): a conta pode se repetir
-- todo mês por N meses. Cada ocorrência é uma linha independente (baixa
-- separada) ligada pelo grupo_recorrencia — o bloco "A pagar" da home e
-- os lembretes de vencimento funcionam sem lógica extra.

alter table public.pagamentos_ectolab
  add column if not exists recorrencia text not null default 'unica'
    check (recorrencia in ('unica', 'mensal')),
  add column if not exists grupo_recorrencia uuid;

create index if not exists pagamentos_grupo_idx on public.pagamentos_ectolab (grupo_recorrencia);

comment on column public.pagamentos_ectolab.recorrencia is 'unica = conta avulsa; mensal = gerada pela repetição automática mês a mês.';
comment on column public.pagamentos_ectolab.grupo_recorrencia is 'Liga as ocorrências da mesma repetição mensal (para exibir 2/12 etc.).';

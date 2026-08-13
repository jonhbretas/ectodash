-- supabase/migrations/0071_financial_monthly_references.sql
-- Referências mensais do fluxo de caixa (linhas de total/soma/saldo da
-- planilha EctoLab + valores preenchidos manualmente nos cards):
--   SALDO ANTERIOR, RECEITA TOTAL, DESPESA TOTAL, SALDO TOTAL,
--   SALDO DE CAIXA e APLICAÇÃO.
--
-- Essas linhas NUNCA são lançamentos de operação (não entram na conta de
-- receita/despesa) — são referências de acompanhamento. O parser
-- (parse-ectolab.ts) captura os valores da planilha e o import os grava
-- aqui; o dashboard os exibe em cards e permite ajuste manual (coordenação).
--
-- A chave é o mês (MM/yyyy), o mesmo formato usado pela página /financeiro.
-- `extra` guarda outras linhas de total/soma encontradas no arquivo que não
-- casam com os campos fixos (ex.: "TOTAL GERAL (CENTRO DE CUSTO)"), sem
-- perder nada da planilha.

create table public.financial_monthly_references (
  mes text primary key check (mes ~ '^\d{2}/\d{4}$'),
  saldo_anterior numeric(14, 2),
  receita_total numeric(14, 2),
  despesa_total numeric(14, 2),
  saldo_total numeric(14, 2),
  saldo_caixa numeric(14, 2),
  aplicacao numeric(14, 2),
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.financial_monthly_references enable row level security;

-- Mesmo padrão das demais políticas de financeiro (0006/0041): apenas
-- financeiro e coordenador_geral enxergam e gravam referências — o card
-- editável é uma feature dessas duas funções.
create policy "financeiro e coordenador podem ler referências mensais"
  on public.financial_monthly_references
  for select
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

create policy "financeiro e coordenador podem gravar referências mensais"
  on public.financial_monthly_references
  for insert
  to authenticated
  with check (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

create policy "financeiro e coordenador podem atualizar referências mensais"
  on public.financial_monthly_references
  for update
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  )
  with check (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

create policy "financeiro e coordenador podem excluir referências mensais"
  on public.financial_monthly_references
  for delete
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

-- supabase/migrations/0112_parcelas_e_contas_a_pagar.sql
-- Parcelas mensais das propostas + contas a pagar da Ectolab + leitura de
-- contratos pelo financeiro:
--
-- 1. proposta_parcelas: cada proposta gera N parcelas mensais automáticas
--    (ex.: R$ 1.000 em 10x no Pix → 10 vencimentos mensais). Parcela tem
--    situação própria (pago/pendente) para a cobrança mês a mês.
-- 2. pagamentos_ectolab: contas que a Ectolab precisa pagar (fornecedor,
--    vencimento, método, situação) — o bloco "A pagar" da home.
-- 3. SELECT de contratos para o financeiro (só leitura): a cobrança dos
--    alunos cruza contrato × proposta × parcela. Escrita continua
--    criador-ou-coordenador (0042, intocado).
--
-- Acesso: financeiro + coordenador_geral (idiom de 0006/0110, com TO
-- explícito + GRANTs para a Data API).

-- ---------------------------------------------------------------------------
-- 1. Parcelas
-- ---------------------------------------------------------------------------
create table public.proposta_parcelas (
  id bigint generated always as identity primary key,
  proposta_id bigint not null references public.propostas_financeiras(id) on delete cascade,
  numero integer not null check (numero >= 1),
  vencimento date not null,
  valor numeric(12, 2) not null check (valor >= 0),
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  pago_em date,
  created_at timestamptz not null default now()
);

create index proposta_parcelas_proposta_idx on public.proposta_parcelas (proposta_id);
create index proposta_parcelas_vencimento_idx on public.proposta_parcelas (vencimento);
create index proposta_parcelas_status_idx on public.proposta_parcelas (status);

alter table public.proposta_parcelas enable row level security;

create policy "financeiro e coordenador can view parcelas"
  on public.proposta_parcelas
  for select
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

create policy "financeiro e coordenador can insert parcelas"
  on public.proposta_parcelas
  for insert
  to authenticated
  with check (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

create policy "financeiro e coordenador can update parcelas"
  on public.proposta_parcelas
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

create policy "financeiro e coordenador can delete parcelas"
  on public.proposta_parcelas
  for delete
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

grant select, insert, update, delete on table public.proposta_parcelas to authenticated;

comment on table public.proposta_parcelas is 'Parcelas mensais geradas automaticamente no registro da proposta (valor total dividido, vencimentos mês a mês).';

-- ---------------------------------------------------------------------------
-- 2. Contas a pagar da Ectolab
-- ---------------------------------------------------------------------------
create table public.pagamentos_ectolab (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) between 3 and 200),
  fornecedor text check (fornecedor is null or char_length(trim(fornecedor)) between 2 and 200),
  valor numeric(12, 2) not null check (valor >= 0),
  vencimento date,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  metodo text not null default 'pix' check (metodo in (
    'pix', 'transferencia', 'boleto',
    'cartao_credito', 'cartao_debito', 'dinheiro', 'outro'
  )),
  pago_em date,
  observacoes text check (observacoes is null or char_length(observacoes) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pagamentos_ectolab_status_idx on public.pagamentos_ectolab (status);
create index pagamentos_ectolab_vencimento_idx on public.pagamentos_ectolab (vencimento);

alter table public.pagamentos_ectolab enable row level security;

create policy "financeiro e coordenador can view pagamentos ectolab"
  on public.pagamentos_ectolab
  for select
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

create policy "financeiro e coordenador can insert pagamentos ectolab"
  on public.pagamentos_ectolab
  for insert
  to authenticated
  with check (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

create policy "financeiro e coordenador can update pagamentos ectolab"
  on public.pagamentos_ectolab
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

create policy "financeiro e coordenador can delete pagamentos ectolab"
  on public.pagamentos_ectolab
  for delete
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

grant select, insert, update, delete on table public.pagamentos_ectolab to authenticated;

comment on table public.pagamentos_ectolab is 'Contas que a Ectolab precisa pagar (bloco A pagar da home).';

-- ---------------------------------------------------------------------------
-- 3. Financeiro lê contratos (cobrança cruza contrato × proposta × parcela)
-- ---------------------------------------------------------------------------
create policy "financeiro can view contratos"
  on public.contratos
  for select
  to authenticated
  using ((select public.has_role('financeiro')));

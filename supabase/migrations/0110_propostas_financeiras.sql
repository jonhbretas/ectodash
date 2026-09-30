-- supabase/migrations/0110_propostas_financeiras.sql
-- Propostas financeiras a acompanhar (orçamentos de fornecedores, propostas
-- a alunos/clientes, contas a pagar/receber):
-- título, contraparte, valor, método de pagamento, prazo, status
-- (pendente/pago/cancelado) + link da planilha Google (acesso externo).
--
-- Acesso: financeiro + coordenador_geral (mesmo idiom de 0006), com
-- escrita via Data API (diferente de financial_entries, que é só-leitura
-- via cron). RLS habilitada + GRANTs explícitos para a Data API.

create table public.propostas_financeiras (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) between 3 and 200),
  contraparte text check (contraparte is null or char_length(trim(contraparte)) between 2 and 200),
  descricao text check (descricao is null or char_length(descricao) <= 2000),
  valor numeric(12, 2) not null check (valor >= 0),
  metodo text not null default 'pix' check (metodo in (
    'pix', 'transferencia', 'boleto',
    'cartao_credito', 'cartao_debito', 'dinheiro', 'outro'
  )),
  prazo date,
  status text not null default 'pendente' check (status in (
    'pendente', 'pago', 'cancelado'
  )),
  pago_em date,
  sheet_url text check (
    sheet_url is null
    or sheet_url ~ '^https://docs\.google\.com/spreadsheets/'
  ),
  observacoes text check (observacoes is null or char_length(observacoes) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index propostas_financeiras_status_idx on public.propostas_financeiras (status);
create index propostas_financeiras_prazo_idx on public.propostas_financeiras (prazo);
create index propostas_financeiras_metodo_idx on public.propostas_financeiras (metodo);

alter table public.propostas_financeiras enable row level security;

-- Leitura: financeiro + coordenador_geral (idiom de 0006, com TO explícito).
create policy "financeiro e coordenador can view propostas"
  on public.propostas_financeiras
  for select
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

-- Escrita via Data API (o app cria/edita/marca pago diretamente).
create policy "financeiro e coordenador can insert propostas"
  on public.propostas_financeiras
  for insert
  to authenticated
  with check (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

-- UPDATE precisa de USING + WITH CHECK (select implícito incluso).
create policy "financeiro e coordenador can update propostas"
  on public.propostas_financeiras
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

create policy "financeiro e coordenador can delete propostas"
  on public.propostas_financeiras
  for delete
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

grant select, insert, update, delete on table public.propostas_financeiras to authenticated;

comment on table public.propostas_financeiras is 'Propostas financeiras: título, valor, método de pagamento, prazo, status pago/pendente + link da planilha Google.';

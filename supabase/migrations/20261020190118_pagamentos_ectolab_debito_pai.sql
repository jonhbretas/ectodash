-- Débito recorrente (mãe) e suas parcelas mensais (filhas).
-- A mãe guarda o contexto comum e não aparece na lista de vencimentos; cada
-- pagamento_ectolab continua sendo uma parcela baixável/excluível isoladamente.
create table public.debitos_ectolab (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) between 3 and 200),
  fornecedor text check (fornecedor is null or char_length(trim(fornecedor)) between 2 and 200),
  valor numeric(12, 2) not null check (valor >= 0),
  metodo text not null check (metodo in ('pix', 'transferencia', 'boleto', 'cartao_credito', 'cartao_debito', 'dinheiro', 'outro')),
  observacoes text check (observacoes is null or char_length(observacoes) <= 2000),
  grupo_recorrencia uuid not null unique,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.debitos_ectolab enable row level security;

create policy "financeiro e coordenador can view debitos ectolab"
  on public.debitos_ectolab for select to authenticated
  using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));

create policy "financeiro e coordenador can insert debitos ectolab"
  on public.debitos_ectolab for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')))
  );

create policy "financeiro e coordenador can delete debitos ectolab"
  on public.debitos_ectolab for delete to authenticated
  using ((select public.has_role('financeiro')) or (select public.has_role('coordenador_geral')));

grant select, insert, delete on table public.debitos_ectolab to authenticated;

alter table public.pagamentos_ectolab
  add column if not exists debito_id bigint references public.debitos_ectolab(id) on delete cascade;

-- Toda FK usada para buscar as parcelas de um débito precisa de índice.
create index if not exists pagamentos_ectolab_debito_id_idx
  on public.pagamentos_ectolab (debito_id);

-- Preserva os débitos mensais já existentes: cada grupo antigo ganha uma mãe
-- e todas as suas ocorrências tornam-se filhas, sem apagar histórico.
insert into public.debitos_ectolab (
  titulo, fornecedor, valor, metodo, observacoes, grupo_recorrencia, created_by, created_at
)
select distinct on (p.grupo_recorrencia)
  regexp_replace(p.titulo, ' \\(1/[0-9]+\\)$', ''),
  p.fornecedor,
  p.valor,
  p.metodo,
  p.observacoes,
  p.grupo_recorrencia,
  p.created_by,
  p.created_at
from public.pagamentos_ectolab p
where p.grupo_recorrencia is not null
order by p.grupo_recorrencia, p.vencimento nulls last, p.id
on conflict (grupo_recorrencia) do nothing;

update public.pagamentos_ectolab p
set debito_id = d.id
from public.debitos_ectolab d
where p.grupo_recorrencia = d.grupo_recorrencia
  and p.debito_id is null;

comment on table public.debitos_ectolab is 'Débito recorrente mãe; ao ser excluído, apaga por cascata todas as parcelas filhas em pagamentos_ectolab.';
comment on column public.pagamentos_ectolab.debito_id is 'Débito recorrente mãe da parcela; nulo para lançamento avulso.';

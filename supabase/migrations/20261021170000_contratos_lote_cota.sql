-- supabase/migrations/20261021170000_contratos_lote_cota.sql
-- Contratos em massa:
--   1) qualificação completa do aluno nos contratos (RG, nascimento,
--      endereço, nacionalidade, estado civil, profissão) — viram variáveis
--      {{aluno_*}} nos modelos;
--   2) contrato_envios: 1 linha por documento enviado à Assinafy (inclusive
--      envios de teste), base do controle da cota mensal do plano.

alter table public.contratos
  add column aluno_rg text,
  add column aluno_nascimento date,
  add column aluno_endereco text,
  add column aluno_nacionalidade text,
  add column aluno_estado_civil text,
  add column aluno_profissao text;

create table public.contrato_envios (
  id bigint generated always as identity primary key,
  contrato_id bigint references public.contratos(id) on delete set null,
  teste boolean not null default false,
  assinafy_document_id text,
  enviado_por uuid not null references public.profiles(id) default auth.uid(),
  enviado_em timestamptz not null default now()
);

create index contrato_envios_enviado_em_idx on public.contrato_envios (enviado_em);
create index contrato_envios_contrato_id_idx on public.contrato_envios (contrato_id);
create index contrato_envios_enviado_por_idx on public.contrato_envios (enviado_por);

alter table public.contrato_envios enable row level security;

create policy "coordinator can view contrato_envios"
  on public.contrato_envios
  for select
  to authenticated
  using ((select public.has_role('coordenador_geral')));

create policy "coordinator can create contrato_envios"
  on public.contrato_envios
  for insert
  to authenticated
  with check (
    enviado_por = (select auth.uid())
    and (select public.has_role('coordenador_geral'))
  );

-- Histórico: contratos já enviados antes desta migration contam na cota do
-- mês em que foram enviados (aproximação: created_at do contrato).
insert into public.contrato_envios (contrato_id, teste, assinafy_document_id, enviado_por, enviado_em)
select id, false, assinafy_document_id, criado_por, created_at
from public.contratos
where assinafy_document_id is not null;

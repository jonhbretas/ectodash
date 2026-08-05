-- supabase/migrations/0026_situacao_atividades.sql
-- Situação de trabalho do voluntário + atividades de conscienciologia.
--
-- 1. voluntarios.situacao — 'ativo' (desempenha atividades) | 'ocioso'
--    (está alocado na área mas sem atividade específica). Coordenadores
--    marcam via atualizar_situacao_voluntario(), uma SECURITY DEFINER
--    gated pelo mesmo voluntario_manager_role() das outras funções de
--    gestão (0017) — voluntarios não tem políticas de escrita direta.
--
-- 2. voluntario_atividades — atividades preenchidas PELO PRÓPRIO
--    voluntário (user decision: "serão preenchidas por cada um"):
--    tenepes, docente_conscienciologia, verbete, artigo, curso_livre,
--    autor, co_autor, pesquisa_laboratorial. RLS: SELECT aberto a todos
--    (shared knowledge, como as demais tabelas); INSERT/UPDATE/DELETE
--    restritos ao próprio cadastro (meu_voluntario_id(), migration 0020)
--    ou aos coordenadores de equipe.
-- Sources: 0017_voluntariado.sql manager-gate idiom [CITED: this repo];
-- 0020_voluntarios_responsaveis.sql meu_voluntario_id() [CITED: this repo].

alter table public.voluntarios
  add column situacao text not null default 'ativo'
  check (situacao in ('ativo', 'ocioso'));

create or replace function public.atualizar_situacao_voluntario(
  p_cadastro_id bigint,
  p_situacao text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  manager public.app_role;
  target_area text;
begin
  if p_situacao not in ('ativo', 'ocioso') then
    return false;
  end if;

  select v.area_atuacao
  into target_area
  from public.voluntarios v
  where v.id = p_cadastro_id;

  if not found then
    return false;
  end if;

  manager := public.voluntario_manager_role(target_area);
  if manager is null then
    return false;
  end if;

  update public.voluntarios
    set situacao = p_situacao
  where id = p_cadastro_id;

  return found;
end;
$$;

revoke execute on function public.atualizar_situacao_voluntario(bigint, text) from public, anon;
grant execute on function public.atualizar_situacao_voluntario(bigint, text) to authenticated;

create table public.voluntario_atividades (
  voluntario_id bigint not null references public.voluntarios(id) on delete cascade,
  atividade text not null check (atividade in (
    'tenepes', 'docente_conscienciologia', 'verbete', 'artigo',
    'curso_livre', 'autor', 'co_autor', 'pesquisa_laboratorial'
  )),
  created_at timestamptz not null default now(),
  primary key (voluntario_id, atividade)
);

create index voluntario_atividades_voluntario_idx on public.voluntario_atividades (voluntario_id);

alter table public.voluntario_atividades enable row level security;

create policy "authenticated users can view all voluntario atividades"
  on public.voluntario_atividades
  for select
  to authenticated
  using (true);

-- Self-service: cada voluntário preenche o próprio cadastro; coordenadores
-- de equipe (coordenador_geral/voluntariado) também podem.
create policy "volunteer or coordinator can insert own atividades"
  on public.voluntario_atividades
  for insert
  to authenticated
  with check (
    voluntario_id = (select public.meu_voluntario_id())
    or (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
  );

create policy "volunteer or coordinator can update own atividades"
  on public.voluntario_atividades
  for update
  to authenticated
  using (
    voluntario_id = (select public.meu_voluntario_id())
    or (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
  )
  with check (
    voluntario_id = (select public.meu_voluntario_id())
    or (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
  );

create policy "volunteer or coordinator can delete own atividades"
  on public.voluntario_atividades
  for delete
  to authenticated
  using (
    voluntario_id = (select public.meu_voluntario_id())
    or (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
  );

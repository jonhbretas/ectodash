-- supabase/migrations/0100_atualizar_voluntario_area_epicom.sql
-- Consolida a função canônica de edição do roster (16 args):
--   - base = 0099 (escopo por cargo via voluntario_manager_role/scope, teto
--     de papel para coordenador_geral, sync de profiles sem updated_at);
--   - restaura da 0074 a re-resolução de area_id/localidade_id a partir dos
--     nomes editados (a 0082/0099 perderam: edições pararam de acompanhar
--     mudanças de área/unidade);
--   - mantém p_epicom DEFAULT NULL = preserva o valor atual.
--
-- Limpeza de dados (auditada pelo trigger audit_voluntarios, actor=Sistema):
--   - re-backfill de area_id/localidade_id NULL mapeáveis (o seed 2026-08-04
--     insere sem essas FKs e o backfill 0073 não cobriu 47 linhas);
--   - telefones-fantasia do seed -> NULL ("(00) 00000-0000" de Angela Mattia,
--     "(45) -9993" de Marlise Royer). Dado falso é pior que ausência: quebra
--     o link de WhatsApp e polui filtros.

create or replace function public.atualizar_voluntario(
  p_cadastro_id bigint,
  p_nome text,
  p_codigo_pf text,
  p_unidade text,
  p_org_depto text,
  p_funcao text,
  p_data_inicio date,
  p_data_saida date,
  p_obs text,
  p_area_atuacao text,
  p_papel public.app_role,
  p_areas_lideradas text[],
  p_ativo boolean,
  p_telefone1 text,
  p_telefone2 text,
  p_epicom boolean default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  manager public.app_role;
  target_area text;
  t_area_id bigint;
  t_localidade_id bigint;
  v_epicom_atual boolean;
  linked_profile uuid;
  new_area_id bigint;
  new_localidade_id bigint;
begin
  select area_atuacao, area_id, localidade_id, epicom
  into target_area, t_area_id, t_localidade_id, v_epicom_atual
  from public.voluntarios
  where id = p_cadastro_id;

  if not found then
    return false;
  end if;

  manager := public.voluntario_manager_role(target_area);
  if manager is null then
    manager := public.voluntario_manager_scope(t_area_id, t_localidade_id);
  end if;
  if manager is null then
    return false;
  end if;

  -- Re-resolver area_id e localidade_id a partir dos nomes atualizados (0074).
  new_area_id := public.resolve_area_id(
    nullif(trim(coalesce(p_area_atuacao, '')), '')
  );
  new_localidade_id := (
    select vl.id from public.voluntario_localidades vl
    where lower(trim(vl.nome)) = lower(trim(nullif(trim(coalesce(p_unidade, '')), '')))
    limit 1
  );

  update public.voluntarios v
    set nome = trim(p_nome),
        codigo_pf = nullif(trim(coalesce(p_codigo_pf, '')), ''),
        unidade = nullif(trim(coalesce(p_unidade, '')), ''),
        org_depto = nullif(trim(coalesce(p_org_depto, '')), ''),
        funcao = nullif(trim(coalesce(p_funcao, '')), ''),
        data_inicio = p_data_inicio,
        data_saida = p_data_saida,
        obs = nullif(trim(coalesce(p_obs, '')), ''),
        area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
        area_id = new_area_id,
        localidade_id = new_localidade_id,
        role = case
          when manager = 'coordenador_geral' then p_papel
          else v.role
        end,
        areas_lideradas = case
          when manager = 'coordenador_geral' then coalesce(p_areas_lideradas, '{}'::text[])
          else v.areas_lideradas
        end,
        ativo = p_ativo,
        telefone1 = nullif(trim(coalesce(p_telefone1, '')), ''),
        telefone2 = nullif(trim(coalesce(p_telefone2, '')), ''),
        epicom = coalesce(p_epicom, v_epicom_atual, false)
    where v.id = p_cadastro_id;

  select id into linked_profile
  from public.profiles
  where voluntario_id = p_cadastro_id;

  if linked_profile is not null then
    if manager = 'coordenador_geral' then
      update public.profiles
        set full_name = trim(p_nome),
            area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
            role = p_papel,
            ativo = p_ativo
        where id = linked_profile;

      delete from public.lider_areas where lider_id = linked_profile;
      if p_papel = 'coordenador_area' then
        insert into public.lider_areas (lider_id, area)
        select distinct linked_profile, unnest(coalesce(p_areas_lideradas, '{}'::text[]));
      end if;
    else
      update public.profiles
        set full_name = trim(p_nome),
            area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
            ativo = p_ativo
        where id = linked_profile;
    end if;
  end if;

  return true;
end;
$$;

revoke execute on function public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  public.app_role, text[], boolean, text, text, boolean
) from public, anon;
grant execute on function public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  public.app_role, text[], boolean, text, text, boolean
) to authenticated;

-- Re-backfill das FKs que o seed insere como NULL (idempotente: só NULLs).
update public.voluntarios v
set area_id = public.resolve_area_id(v.area_atuacao)
where v.area_id is null
  and v.area_atuacao is not null
  and public.resolve_area_id(v.area_atuacao) is not null;

update public.voluntarios v
set localidade_id = vl.id
from public.voluntario_localidades vl
where v.localidade_id is null
  and v.unidade is not null
  and lower(trim(vl.nome)) = lower(trim(v.unidade));

-- Telefones-fantasia do seed viram NULL (não são contato real).
update public.voluntarios
set telefone1 = null
where telefone1 = '(00) 00000-0000';

update public.voluntarios
set telefone2 = null
where telefone2 in ('(45) -9993', '(00) 00000-0000');

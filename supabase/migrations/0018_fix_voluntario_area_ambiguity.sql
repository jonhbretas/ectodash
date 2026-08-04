-- supabase/migrations/0018_fix_voluntario_area_ambiguity.sql
-- Fixes a bug in migration 0017's atualizar_voluntario(): its first
-- statement was
--     select area_atuacao into target_area from public.voluntarios ...
-- which raised SQLSTATE 42702 (ambiguous column reference) at runtime: the
-- function parameter `area_atuacao` shadows the table column of the same
-- name, and PL/pgSQL refuses the unqualified reference in a SELECT ... INTO
-- context. The fix aliases the table so the column reference is
-- unambiguous. No other function has this shape (every other SELECT ... INTO
-- either reads a `*` rowtype, targets a column with no same-named parameter,
-- or qualifies the source already).

create or replace function public.atualizar_voluntario(
  cadastro_id bigint,
  nome text,
  codigo_pf text,
  unidade text,
  org_depto text,
  funcao text,
  data_inicio date,
  data_saida date,
  obs text,
  area_atuacao text,
  papel public.app_role,
  areas_lideradas text[],
  ativo boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  manager public.app_role;
  target_area text;
  linked_profile uuid;
begin
  select v.area_atuacao
  into target_area
  from public.voluntarios v
  where v.id = cadastro_id;

  if not found then
    return false;
  end if;

  manager := public.voluntario_manager_role(target_area);
  if manager is null then
    return false;
  end if;

  update public.voluntarios v
    set nome = trim(nome),
        codigo_pf = nullif(trim(coalesce(codigo_pf, '')), ''),
        unidade = nullif(trim(coalesce(unidade, '')), ''),
        org_depto = nullif(trim(coalesce(org_depto, '')), ''),
        funcao = nullif(trim(coalesce(funcao, '')), ''),
        data_inicio = data_inicio,
        data_saida = data_saida,
        obs = nullif(trim(coalesce(obs, '')), ''),
        area_atuacao = nullif(trim(coalesce(area_atuacao, '')), ''),
        role = case
          when manager = 'coordenador_geral' then papel
          else v.role
        end,
        areas_lideradas = case
          when manager = 'coordenador_geral' then coalesce(areas_lideradas, '{}'::text[])
          else v.areas_lideradas
        end,
        ativo = ativo
    where v.id = cadastro_id;

  select id into linked_profile
  from public.profiles
  where voluntario_id = cadastro_id;

  if linked_profile is not null then
    if manager = 'coordenador_geral' then
      update public.profiles
        set full_name = trim(nome),
            area_atuacao = nullif(trim(coalesce(area_atuacao, '')), ''),
            role = papel,
            ativo = ativo
        where id = linked_profile;

      delete from public.lider_areas where lider_id = linked_profile;
      if papel = 'coordenador_area' then
        insert into public.lider_areas (lider_id, area)
        select distinct linked_profile, unnest(coalesce(areas_lideradas, '{}'::text[]));
      end if;
    else
      update public.profiles
        set full_name = trim(nome),
            area_atuacao = nullif(trim(coalesce(area_atuacao, '')), ''),
            ativo = ativo
        where id = linked_profile;
    end if;
  end if;

  return true;
end;
$$;

revoke execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean) from public, anon;
grant execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean) to authenticated;

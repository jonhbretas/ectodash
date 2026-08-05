-- supabase/migrations/0030_voluntario_telefones.sql
-- Add phone number columns to the volunteer roster and thread them through
-- the create/update SECURITY DEFINER functions.

-- 1. New columns
alter table public.voluntarios
  add column telefone_1 text,
  add column telefone_2 text;

-- 2. Recreate criar_voluntario() with phone parameters
create or replace function public.criar_voluntario(
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
  telefone_1 text default null,
  telefone_2 text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  manager public.app_role;
  effective_area text;
  effective_role public.app_role;
  novo_id bigint;
begin
  if me is null then
    return null;
  end if;

  if trim(coalesce(nome, '')) = '' then
    return null;
  end if;

  manager := public.voluntario_manager_role(area_atuacao);
  if manager is null then
    return null;
  end if;

  effective_area := nullif(trim(coalesce(area_atuacao, '')), '');
  if manager = 'coordenador_area' then
    effective_area := (
      select la.area from public.lider_areas la
      where la.lider_id = me
      order by la.created_at asc
      limit 1
    );
    effective_role := 'voluntario_comum';
  else
    effective_role := case
      when papel = 'coordenador_geral' then 'voluntario_comum'
      else papel
    end;
  end if;

  insert into public.voluntarios (
    nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida,
    obs, area_atuacao, role, areas_lideradas, telefone_1, telefone_2
  ) values (
    trim(nome),
    nullif(trim(coalesce(codigo_pf, '')), ''),
    nullif(trim(coalesce(unidade, '')), ''),
    nullif(trim(coalesce(org_depto, '')), ''),
    nullif(trim(coalesce(funcao, '')), ''),
    data_inicio,
    data_saida,
    nullif(trim(coalesce(obs, '')), ''),
    effective_area,
    effective_role,
    case when manager = 'coordenador_geral' then coalesce(areas_lideradas, '{}'::text[]) else '{}'::text[] end,
    nullif(trim(coalesce(telefone_1, '')), ''),
    nullif(trim(coalesce(telefone_2, '')), '')
  )
  returning id into novo_id;

  return novo_id;
end;
$$;

-- 3. Recreate atualizar_voluntario() with phone parameters
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
  ativo boolean,
  telefone_1 text default null,
  telefone_2 text default null
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
  select area_atuacao
  into target_area
  from public.voluntarios
  where id = cadastro_id;

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
        ativo = ativo,
        telefone_1 = nullif(trim(coalesce(telefone_1, '')), ''),
        telefone_2 = nullif(trim(coalesce(telefone_2, '')), '')
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

-- 4. Re-grant the updated function signatures
revoke execute on function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[], text, text) from public, anon;
grant execute on function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[], text, text) to authenticated;

revoke execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean, text, text) from public, anon;
grant execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean, text, text) to authenticated;

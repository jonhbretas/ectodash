-- supabase/migrations/0030_voluntario_telefone.sql
-- Add telefone1 and telefone2 columns to the institutional roster so
-- coordinators can store contact numbers for each volunteer.

alter table public.voluntarios
  add column telefone1 text,
  add column telefone2 text;

-- Update criar_voluntario() to accept phone parameters
drop function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[]);

create or replace function public.criar_voluntario(
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
  p_telefone1 text,
  p_telefone2 text
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

  if trim(coalesce(p_nome, '')) = '' then
    return null;
  end if;

  manager := public.voluntario_manager_role(p_area_atuacao);
  if manager is null then
    return null;
  end if;

  effective_area := nullif(trim(coalesce(p_area_atuacao, '')), '');
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
      when p_papel = 'coordenador_geral' then 'voluntario_comum'
      else p_papel
    end;
  end if;

  insert into public.voluntarios (
    nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida,
    obs, area_atuacao, role, areas_lideradas, telefone1, telefone2
  ) values (
    trim(p_nome),
    nullif(trim(coalesce(p_codigo_pf, '')), ''),
    nullif(trim(coalesce(p_unidade, '')), ''),
    nullif(trim(coalesce(p_org_depto, '')), ''),
    nullif(trim(coalesce(p_funcao, '')), ''),
    p_data_inicio,
    p_data_saida,
    nullif(trim(coalesce(p_obs, '')), ''),
    effective_area,
    effective_role,
    case when manager = 'coordenador_geral' then coalesce(p_areas_lideradas, '{}'::text[]) else '{}'::text[] end,
    nullif(trim(coalesce(p_telefone1, '')), ''),
    nullif(trim(coalesce(p_telefone2, '')), '')
  )
  returning id into novo_id;

  return novo_id;
end;
$$;

-- Update atualizar_voluntario() to accept phone parameters
drop function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean);

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
  p_telefone2 text
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
  where v.id = p_cadastro_id;

  if not found then
    return false;
  end if;

  manager := public.voluntario_manager_role(target_area);
  if manager is null then
    return false;
  end if;

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
        telefone2 = nullif(trim(coalesce(p_telefone2, '')), '')
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

revoke execute on function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[], text, text) from public, anon;
grant execute on function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[], text, text) to authenticated;

revoke execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean, text, text) from public, anon;
grant execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean, text, text) to authenticated;

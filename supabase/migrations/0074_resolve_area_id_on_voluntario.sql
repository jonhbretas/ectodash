-- Adiciona area_id ao criar/atualizar voluntário e cria helper
-- resolve_area_id() para mapear area_atuacao → areas_institucionais.id.
-- Resolve o problema de 51 voluntários com area_id = null que impediam
-- a política RLS coordena_area(area_id) de funcionar.

-- Helper: resolve area_atuacao text → area_id
-- Regras: 1) match exato no nome, 2) sufixo após " - ", 3) fallback
create or replace function public.resolve_area_id(area_name text)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(
    -- 1. Match exato
    (select ai.id from public.areas_institucionais ai
     where lower(trim(ai.nome)) = lower(trim(area_name))
     limit 1),
    -- 2. Sufixo composto: "X - Y" → busca Y
    (select ai.id from public.areas_institucionais ai
     where position(' - ' in area_name) > 0
       and lower(trim(split_part(area_name, ' - ', 2))) = lower(trim(ai.nome))
     limit 1),
    -- 3. Fallback "Comunicação e Eventos" → Comunicação
    (select ai.id from public.areas_institucionais ai
     where lower(trim(area_name)) = 'comunicação e eventos'
       and lower(trim(ai.nome)) = 'comunicação'
     limit 1)
  );
$$;

revoke execute on function public.resolve_area_id(text) from public, anon;
grant execute on function public.resolve_area_id(text) to authenticated;

-- Recriar criar_voluntario com area_id no INSERT
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
  resolved_area_id bigint;
  resolved_localidade_id bigint;
begin
  if me is null then
    return null;
  end if;

  if trim(coalesce(p_nome, '')) = '' then
    return null;
  end if;

  manager := public.voluntario_manager_role(p_area_atuacao);
  if manager is null then
    manager := public.voluntario_manager_scope(
      (select ai.id from public.areas_institucionais ai
       where lower(trim(ai.nome)) = lower(trim(nullif(trim(coalesce(p_area_atuacao, '')), '')))),
      (select vl.id from public.voluntario_localidades vl
       where lower(trim(vl.nome)) = lower(trim(nullif(trim(coalesce(p_unidade, '')), ''))))
    );
  end if;
  if manager is null then
    return null;
  end if;

  effective_area := nullif(trim(coalesce(p_area_atuacao, '')), '');
  if manager = 'coordenador_area' then
    effective_area := case
      when (select role from public.profiles where id = me) = 'coordenador_area' then
        (select la.area from public.lider_areas la
         where la.lider_id = me order by la.created_at asc limit 1)
      when exists (
        select 1 from public.cargos c
        where c.profile_id = me and c.area_id is not null
      ) then
        (select ai.nome
         from public.cargos c
         join public.areas_institucionais ai on ai.id = c.area_id
         where c.profile_id = me and c.area_id is not null
         order by c.id asc limit 1)
      else effective_area
    end;
    effective_role := 'voluntario_comum';
  else
    effective_role := case
      when p_papel = 'coordenador_geral' then 'voluntario_comum'
      else p_papel
    end;
  end if;

  -- Resolver area_id e localidade_id a partir dos nomes
  resolved_area_id := public.resolve_area_id(effective_area);
  resolved_localidade_id := (
    select vl.id from public.voluntario_localidades vl
    where lower(trim(vl.nome)) = lower(trim(nullif(trim(coalesce(p_unidade, '')), '')))
    limit 1
  );

  insert into public.voluntarios (
    nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida,
    obs, area_atuacao, area_id, localidade_id, role, areas_lideradas,
    telefone1, telefone2
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
    resolved_area_id,
    resolved_localidade_id,
    effective_role,
    case when manager = 'coordenador_geral' then coalesce(p_areas_lideradas, '{}'::text[]) else '{}'::text[] end,
    nullif(trim(coalesce(p_telefone1, '')), ''),
    nullif(trim(coalesce(p_telefone2, '')), '')
  )
  returning id into novo_id;

  return novo_id;
end;
$$;

-- Recriar atualizar_voluntario com area_id no UPDATE
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
  t_area_id bigint;
  t_localidade_id bigint;
  linked_profile uuid;
  new_area_id bigint;
  new_localidade_id bigint;
begin
  select area_atuacao, area_id, localidade_id
  into target_area, t_area_id, t_localidade_id
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

  -- Resolver area_id e localidade_id a partir dos nomes atualizados
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

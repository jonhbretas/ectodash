-- supabase/migrations/0045_fix_voluntario_functions_cargos.sql
-- Correções pós-aplicação da 0043 (confirmadas em teste ao vivo):
--
--   1. A 0043 recriou criar_voluntario()/atualizar_voluntario() com as
--      ASSINATURAS ANTIGAS (sem p_ e sem telefone1/telefone2). A 0030 já
--      tinha dropado e recriado essas funções com p_ + telefones — o
--      CREATE OR REPLACE da 0043 criou OVERLOADS paralelos, e o app (que
--      chama com p_telefone1/p_telefone2) continuou caindo na versão da
--      0030, SEM o fallback de escopo por cargo (resultado: criar/editar
--      voluntário devolvia null para coordenadores por cargo). Correção:
--      drop dos overloads errados da 0043 e recriação com a assinatura da
--      0030 + o fallback de escopo da 0043.
--   2. pode_conceder_cargo(): `c.localidade_id = localidade_id` era
--      ambíguo (parâmetro PL/pgSQL vs coluna) → SQLSTATE 42702 ao conceder
--      cargo de localidade. Corrigido qualificando com o nome da função.
--
-- O arquivo 0043_cargos_acesso.sql já foi editado para refletir as
-- assinaturas corretas — uma restauração limpa do diretório de migrações
-- reproduz o mesmo estado final, e esta 0045 existe porque a 0043 já
-- estava aplicada no projeto hospedado (migrações são imutáveis após
-- aplicadas).
-- Fontes: 0030_voluntario_telefone.sql (assinaturas) [CITED: this repo];
-- 0043_cargos_acesso.sql (lógica de escopo) [CITED: this repo].

-- 1. Overloads errados criados pela 0043 (assinaturas sem p_ e sem telefones)
drop function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[]);
drop function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean);

-- 2. pode_conceder_cargo com a referência qualificada (fix 42702)
create or replace function public.pode_conceder_cargo(area_id bigint, localidade_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    return false;
  end if;

  if (select role from public.profiles where id = me) = 'coordenador_geral' then
    return true;
  end if;

  if area_id is not null then
    return exists (
      with recursive arvore as (
        select c.area_id as id
        from public.cargos c
        where c.profile_id = me
          and c.nivel = 'coordenador_geral_area'
          and c.area_id is not null
        union all
        select a.id
        from public.areas_institucionais a
        join arvore on a.area_mae_id = arvore.id
      )
      select 1 from arvore where id = area_id
    );
  end if;

  if localidade_id is not null then
    return exists (
      select 1 from public.cargos c
      where c.profile_id = me
        and c.nivel = 'coordenador_localidade'
        and c.localidade_id = pode_conceder_cargo.localidade_id
    );
  end if;

  return false;
end;
$$;

revoke execute on function public.pode_conceder_cargo(bigint, bigint) from public, anon;
grant execute on function public.pode_conceder_cargo(bigint, bigint) to authenticated;

-- 3. Versões corretas (assinatura da 0030 + fallback de escopo da 0043)
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
    -- Legado (role coordenador_area): pin para a primeira lider_area.
    -- Cargo de área: pin para a primeira área do cargo. Só localidade:
    -- mantém a área escolhida no payload (o escopo dela é a localidade).
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

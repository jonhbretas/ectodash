-- supabase/migrations/0098_fix_atualizar_voluntario_overload.sql
-- Corrige o PGRST203 ("Could not choose the best candidate function") que
-- quebra TODA edição individual de voluntário (actions.ts atualizarVoluntario
-- chama sem p_epicom; o teste voluntarios-rls "atualizar_voluntario" falha).
--
-- Causa: a 0082 adicionou p_epicom via CREATE OR REPLACE com DEFAULT. No
-- Postgres, mudar a contagem de parâmetros cria uma SEGUNDA overload em vez
-- de substituir — restaram duas assinaturas (15 args da 0045 + 16 args da
-- 0082) e o PostgREST não resolve chamadas sem p_epicom (precedente interno:
-- a 0045 documenta o mesmo padrão de overload fantasma da 0043).
--
-- Correção:
--   1. DROP da overload antiga de 15 args.
--   2. Recria a de 16 args com p_epicom DEFAULT NULL + preservação do valor
--      atual quando NULL (antes: COALESCE(p_epicom, false) zerava o epicom
--      a cada edição que omitisse o parâmetro).

-- 1. Remove a overload antiga (15 args, sem p_epicom) herdada da 0045.
drop function if exists public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  public.app_role, text[], boolean, text, text
);

-- 2. Versão canônica: 16 args, epicom preservado quando NULL.
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
  v_target_id bigint;
  v_caller_id uuid := (select auth.uid());
  v_caller_role text;
  v_caller_area text;
  v_target_area text;
  v_epicom_atual boolean;
begin
  -- Verificar papel do chamador
  select role into v_caller_role from public.profiles where id = v_caller_id;

  -- Buscar o id do cadastro vinculado ao chamador
  select voluntario_id into v_target_id
  from public.profiles where id = v_caller_id;

  -- Coordenador geral e voluntariado podem editar qualquer um
  if v_caller_role in ('coordenador_geral', 'voluntariado') then
    v_target_id := p_cadastro_id;
  elsif v_caller_role = 'coordenador_area' then
    -- Coordenador de área: só pode editar voluntários da sua área
    select area_atuacao into v_caller_area
    from public.voluntarios where id = v_target_id;

    select area_atuacao into v_target_area
    from public.voluntarios where id = p_cadastro_id;

    if v_target_area is distinct from v_caller_area then
      return false;
    end if;
    v_target_id := p_cadastro_id;
  else
    -- Voluntário comum: só pode editar a si mesmo (cadastro básico)
    if v_target_id is null or v_target_id != p_cadastro_id then
      return false;
    end if;
  end if;

  -- Valor atual do epicom (preservado quando p_epicom é NULL/omitido).
  select epicom into v_epicom_atual
  from public.voluntarios where id = v_target_id;

  if not found then
    return false;
  end if;

  -- Atualizar o cadastro
  update public.voluntarios set
    nome = trim(p_nome),
    codigo_pf = nullif(trim(p_codigo_pf), ''),
    unidade = nullif(trim(p_unidade), ''),
    org_depto = nullif(trim(p_org_depto), ''),
    funcao = nullif(trim(p_funcao), ''),
    data_inicio = p_data_inicio,
    data_saida = p_data_saida,
    obs = nullif(trim(p_obs), ''),
    area_atuacao = nullif(trim(p_area_atuacao), ''),
    role = p_papel,
    areas_lideradas = coalesce(p_areas_lideradas, '{}'),
    ativo = p_ativo,
    telefone1 = nullif(trim(p_telefone1), ''),
    telefone2 = nullif(trim(p_telefone2), ''),
    epicom = coalesce(p_epicom, v_epicom_atual, false),
    updated_at = now()
  where id = v_target_id;

  -- Sincronizar com profiles se houver vínculo
  update public.profiles set
    role = p_papel,
    updated_at = now()
  where voluntario_id = v_target_id
    and p_papel is not null;

  return true;
end;
$$;

revoke all on function public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  public.app_role, text[], boolean, text, text, boolean
) from public, anon;
grant execute on function public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  public.app_role, text[], boolean, text, text, boolean
) to authenticated;

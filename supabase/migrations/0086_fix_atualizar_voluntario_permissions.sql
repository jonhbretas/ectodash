-- 0086_fix_atualizar_voluntario_permissions.sql
-- FIX: A migração 0082 (add_epicom_to_rpc) regrediu a lógica de permissão
-- de atualizar_voluntario(). A 0074 usava voluntario_manager_role() +
-- voluntario_manager_scope() que verifica cargos (migration 0043), mas a 0082
-- substituiu por uma checagem simples de profiles.role que ignora cargos.
-- Usuários com cargo (ex: coordenador_localidade) mas profiles.role = voluntario_comum
-- tinham retorno false para todas as edições — bug do "0 voluntários migrados".
-- Esta migration restaura a lógica de permissão correta E mantém o p_epicom.

CREATE OR REPLACE FUNCTION public.atualizar_voluntario(
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
  p_epicom boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  manager public.app_role;
  target_area text;
  t_area_id bigint;
  t_localidade_id bigint;
  linked_profile uuid;
  new_area_id bigint;
  new_localidade_id bigint;
BEGIN
  SELECT area_atuacao, area_id, localidade_id
  INTO target_area, t_area_id, t_localidade_id
  FROM public.voluntarios
  WHERE id = p_cadastro_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  manager := public.voluntario_manager_role(target_area);
  IF manager IS NULL THEN
    manager := public.voluntario_manager_scope(t_area_id, t_localidade_id);
  END IF;
  IF manager IS NULL THEN
    RETURN false;
  END IF;

  -- Resolver area_id e localidade_id a partir dos nomes atualizados
  new_area_id := public.resolve_area_id(
    nullif(trim(coalesce(p_area_atuacao, '')), '')
  );
  new_localidade_id := (
    SELECT vl.id FROM public.voluntario_localidades vl
    WHERE lower(trim(vl.nome)) = lower(trim(nullif(trim(coalesce(p_unidade, '')), '')))
    LIMIT 1
  );

  UPDATE public.voluntarios v
    SET nome = trim(p_nome),
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
        role = CASE
          WHEN manager = 'coordenador_geral' THEN p_papel
          ELSE v.role
        END,
        areas_lideradas = CASE
          WHEN manager = 'coordenador_geral' THEN coalesce(p_areas_lideradas, '{}'::text[])
          ELSE v.areas_lideradas
        END,
        ativo = p_ativo,
        telefone1 = nullif(trim(coalesce(p_telefone1, '')), ''),
        telefone2 = nullif(trim(coalesce(p_telefone2, '')), ''),
        epicom = COALESCE(p_epicom, false),
        updated_at = now()
    WHERE v.id = p_cadastro_id;

  SELECT id INTO linked_profile
  FROM public.profiles
  WHERE voluntario_id = p_cadastro_id;

  IF linked_profile IS NOT NULL THEN
    IF manager = 'coordenador_geral' THEN
      UPDATE public.profiles
        SET full_name = trim(p_nome),
            area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
            role = p_papel,
            ativo = p_ativo
        WHERE id = linked_profile;

      DELETE FROM public.lider_areas WHERE lider_id = linked_profile;
      IF p_papel = 'coordenador_area' THEN
        INSERT INTO public.lider_areas (lider_id, area)
        SELECT DISTINCT linked_profile, unnest(coalesce(p_areas_lideradas, '{}'::text[]));
      END IF;
    ELSE
      UPDATE public.profiles
        SET full_name = trim(p_nome),
            area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
            ativo = p_ativo
        WHERE id = linked_profile;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  public.app_role, text[], boolean, text, text, boolean
) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  public.app_role, text[], boolean, text, text, boolean
) TO authenticated;

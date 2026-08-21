-- 0082_add_epicom_to_rpc.sql
-- Adiciona o parâmetro p_epicom à função atualizar_voluntario para
-- suportar edição em massa do campo epicom.

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
  p_papel app_role,
  p_areas_lideradas text[],
  p_ativo boolean,
  p_telefone1 text,
  p_telefone2 text,
  p_epicom boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_id bigint;
  v_caller_id uuid := auth.uid();
  v_caller_role text;
  v_caller_area text;
  v_target_area text;
BEGIN
  -- Verificar papel do chamador
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

  -- Buscar o id do cadastro vinculado ao chamador
  SELECT voluntario_id INTO v_target_id
  FROM public.profiles WHERE id = v_caller_id;

  -- Coordenador geral e voluntariado podem editar qualquer um
  IF v_caller_role IN ('coordenador_geral', 'voluntariado') THEN
    v_target_id := p_cadastro_id;
  ELSIF v_caller_role = 'coordenador_area' THEN
    -- Coordenador de área: só pode editar voluntários da sua área
    SELECT area_atuacao INTO v_caller_area
    FROM public.voluntarios WHERE id = v_target_id;

    SELECT area_atuacao INTO v_target_area
    FROM public.voluntarios WHERE id = p_cadastro_id;

    IF v_target_area IS DISTINCT FROM v_caller_area THEN
      RETURN false;
    END IF;
    v_target_id := p_cadastro_id;
  ELSE
    -- Voluntário comum: só pode editar a si mesmo (cadastro básico)
    IF v_target_id IS NULL OR v_target_id != p_cadastro_id THEN
      RETURN false;
    END IF;
  END IF;

  -- Atualizar o cadastro
  UPDATE public.voluntarios SET
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
    areas_lideradas = COALESCE(p_areas_lideradas, '{}'),
    ativo = p_ativo,
    telefone1 = nullif(trim(p_telefone1), ''),
    telefone2 = nullif(trim(p_telefone2), ''),
    epicom = COALESCE(p_epicom, false),
    updated_at = now()
  WHERE id = v_target_id;

  -- Sincronizar com profiles se houver vínculo
  UPDATE public.profiles SET
    role = p_papel,
    updated_at = now()
  WHERE voluntario_id = v_target_id
    AND p_papel IS NOT NULL;

  RETURN true;
END;
$$;

-- Garantir EXECUTE
GRANT EXECUTE ON FUNCTION public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  app_role, text[], boolean, text, text, boolean
) TO authenticated;

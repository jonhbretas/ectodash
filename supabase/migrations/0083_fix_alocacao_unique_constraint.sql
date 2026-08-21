-- 0083: Corrigir constraint UNIQUE na tabela escala_alocacao
-- O problema: UNIQUE (escala_id, funcao) impedia múltiplas pessoas na mesma função
-- (ex: "Monitoria" com 2 vagas). A solução é usar UNIQUE (escala_id, voluntario_id)
-- para garantir que cada voluntário tenha apenas UMA função por escala.

-- 1. Remover a constraint antiga (nome gerado automaticamente pelo Postgres)
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.escala_alocacao'::regclass
    AND contype = 'u'
    AND conkey <@ ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.escala_alocacao'::regclass AND attname = 'escala_id'),
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.escala_alocacao'::regclass AND attname = 'funcao')
    ];

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.escala_alocacao DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- 2. Adicionar nova constraint: um voluntário só pode ter UMA função por escala
ALTER TABLE public.escala_alocacao
  ADD CONSTRAINT escala_alocacao_escala_voluntario_unique
  UNIQUE (escala_id, voluntario_id);

-- 3. Atualizar RPC substituir_ausente para normalizar nomes de vagas múltiplas
-- "Monitoria 1" → "Monitoria" ao buscar histórico, para contar todas as vagas juntas
CREATE OR REPLACE FUNCTION public.substituir_ausente(
  p_escala_id bigint,
  p_voluntario_ausente_id bigint
)
RETURNS TABLE (
  funcao text,
  substituto_id bigint,
  substituto_nome text
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_localidade text;
  v_funcao_alocada text;
  v_funcao_base text;
  v_substituto record;
BEGIN
  -- Buscar a função do ausente
  SELECT ea.funcao INTO v_funcao_alocada
  FROM public.escala_alocacao ea
  WHERE ea.escala_id = p_escala_id AND ea.voluntario_id = p_voluntario_ausente_id;

  IF v_funcao_alocada IS NULL THEN
    RAISE EXCEPTION 'Voluntário não está alocado nesta escala.';
  END IF;

  -- Normalizar: "Monitoria 1" → "Monitoria" para buscar histórico
  v_funcao_base := regexp_replace(v_funcao_alocada, ' \d+$', '');

  -- Buscar localidade da escala
  SELECT es.localidade INTO v_localidade
  FROM public.escala_semanal es WHERE es.id = p_escala_id;

  -- Remover a alocação do ausente
  DELETE FROM public.escala_alocacao
  WHERE escala_id = p_escala_id AND voluntario_id = p_voluntario_ausente_id;

  -- Buscar substituto: voluntário ativo, não ausente, com menos participações
  -- na função (normalizada), que não seja epicom (exceto para funções que permitem)
  FOR v_substituto IN
    SELECT
      v.id AS vid,
      v.nome AS vnome,
      COALESCE(hf.total, 0) AS total_funcao,
      hf.ultima_data
    FROM public.voluntarios v
    LEFT JOIN public.historico_funcoes_voluntario(v_localidade) hf
      ON hf.voluntario_id = v.id AND regexp_replace(hf.funcao, ' \d+$', '') = v_funcao_base
    WHERE v.ativo = true
      AND (v_localidade IS NULL OR v.unidade = v_localidade)
      AND v.id != p_voluntario_ausente_id
      AND v.id NOT IN (
        SELECT ea2.voluntario_id FROM public.escala_alocacao ea2
        WHERE ea2.escala_id = p_escala_id
      )
      AND v.id NOT IN (
        SELECT ea3.voluntario_id FROM public.escala_ausencia ea3
        WHERE ea3.escala_id = p_escala_id
      )
      -- Restrição Epicon: só quem tem epicom=true pode ocupar Epicon
      AND (
        v_funcao_base != 'Epicon'
        OR v.epicom = true
      )
      -- Restrição Energizador 1: precisa de docente_conscienciologia
      AND (
        v_funcao_base != 'Energizador 1'
        OR EXISTS (
          SELECT 1 FROM public.voluntario_atividades va
          WHERE va.voluntario_id = v.id
            AND va.atividade = 'docente_conscienciologia'
        )
      )
      -- Demais funções: não pode ser epicom (exceto Observador Parapsíquico)
      AND (
        v_funcao_base IN ('Epicon', 'Observador Parapsíquico')
        OR v.epicom = false
      )
    ORDER BY COALESCE(hf.total, 0), hf.ultima_data NULLS FIRST, v.nome
    LIMIT 1
  LOOP
    -- Inserir o substituto (mantém o nome original com vaga, ex: "Monitoria 1")
    INSERT INTO public.escala_alocacao (escala_id, funcao, voluntario_id)
    VALUES (p_escala_id, v_funcao_alocada, v_substituto.vid);

    funcao := v_funcao_alocada;
    substituto_id := v_substituto.vid;
    substituto_nome := v_substituto.vnome;
    RETURN NEXT;
  END LOOP;
END;
$$;

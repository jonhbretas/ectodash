-- 0080_escala_voluntarios.sql
-- Sistema de escala semanal de voluntários para dinâmicas (sexta-feira).

-- ── 1. Coluna epicom no cadastro de voluntários ──────────────────────
ALTER TABLE public.voluntarios
  ADD COLUMN IF NOT EXISTS epicom boolean DEFAULT false;

-- ── 2. Tabela de escalas semanais (cabeçalho) ────────────────────────
CREATE TABLE IF NOT EXISTS public.escala_semanal (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data_semana   date NOT NULL,                -- referência à sexta-feira da semana
  localidade    text,                          -- cidade (null = todas)
  status        text NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho', 'publicada', 'cancelada')),
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Índice para buscas por data + localidade
CREATE INDEX IF NOT EXISTS idx_escala_semanal_data
  ON public.escala_semanal (data_semana DESC);

-- ── 3. Tabela de alocações (função × voluntário) ─────────────────────
CREATE TABLE IF NOT EXISTS public.escala_alocacao (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escala_id       bigint NOT NULL REFERENCES public.escala_semanal(id) ON DELETE CASCADE,
  funcao          text NOT NULL,
  voluntario_id   bigint NOT NULL REFERENCES public.voluntarios(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (escala_id, funcao)   -- uma pessoa por função por escala
);

CREATE INDEX IF NOT EXISTS idx_escala_alocacao_escala
  ON public.escala_alocacao (escala_id);

CREATE INDEX IF NOT EXISTS idx_escala_alocacao_voluntario
  ON public.escala_alocacao (voluntario_id);

-- ── 4. Tabela de ausências ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escala_ausencia (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escala_id       bigint NOT NULL REFERENCES public.escala_semanal(id) ON DELETE CASCADE,
  voluntario_id   bigint NOT NULL REFERENCES public.voluntarios(id),
  motivo          text,
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (escala_id, voluntario_id)
);

CREATE INDEX IF NOT EXISTS idx_escala_ausencia_escala
  ON public.escala_ausencia (escala_id);

-- ── 5. RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.escala_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_alocacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escala_ausencia  ENABLE ROW LEVEL SECURITY;

-- escala_semanal: leitura para todos autenticados; escrita para coordenadores
CREATE POLICY "escala_semanal_select"
  ON public.escala_semanal FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "escala_semanal_insert"
  ON public.escala_semanal FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = created_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

CREATE POLICY "escala_semanal_update"
  ON public.escala_semanal FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

CREATE POLICY "escala_semanal_delete"
  ON public.escala_semanal FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

-- escala_alocacao: leitura para todos autenticados; escrita para coordenadores
CREATE POLICY "escala_alocacao_select"
  ON public.escala_alocacao FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "escala_alocacao_insert"
  ON public.escala_alocacao FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

CREATE POLICY "escala_alocacao_update"
  ON public.escala_alocacao FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

CREATE POLICY "escala_alocacao_delete"
  ON public.escala_alocacao FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

-- escala_ausencia: leitura para todos autenticados; escrita para coordenadores
CREATE POLICY "escala_ausencia_select"
  ON public.escala_ausencia FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "escala_ausencia_insert"
  ON public.escala_ausencia FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

CREATE POLICY "escala_ausencia_delete"
  ON public.escala_ausencia FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

-- ── 6. Função auxiliar: histórico de funções por voluntário ──────────
-- Retorna quantas vezes cada voluntário exerceu cada função.
CREATE OR REPLACE FUNCTION public.historico_funcoes_voluntario(p_localidade text)
RETURNS TABLE (
  voluntario_id bigint,
  funcao text,
  total integer,
  ultima_data date
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    ea.voluntario_id,
    ea.funcao,
    COUNT(*)::int AS total,
    MAX(es.data_semana) AS ultima_data
  FROM public.escala_alocacao ea
  JOIN public.escala_semanal es ON es.id = ea.escala_id
  WHERE es.status != 'cancelada'
    AND (p_localidade IS NULL OR es.localidade = p_localidade)
  GROUP BY ea.voluntario_id, ea.funcao;
$$;

-- Garantir EXECUTE para authenticated
GRANT EXECUTE ON FUNCTION public.historico_funcoes_voluntario(text) TO authenticated;

-- ── 7. Função: substituir ausente automaticamente ────────────────────
-- Dado uma escala e um voluntário ausente, busca substituto elegível
-- e atualiza a alocação.
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
  v_substituto record;
BEGIN
  -- Buscar a função do ausente
  SELECT ea.funcao INTO v_funcao_alocada
  FROM public.escala_alocacao ea
  WHERE ea.escala_id = p_escala_id AND ea.voluntario_id = p_voluntario_ausente_id;

  IF v_funcao_alocada IS NULL THEN
    RAISE EXCEPTION 'Voluntário não está alocado nesta escala.';
  END IF;

  -- Buscar localidade da escala
  SELECT es.localidade INTO v_localidade
  FROM public.escala_semanal es WHERE es.id = p_escala_id;

  -- Remover a alocação do ausente
  DELETE FROM public.escala_alocacao
  WHERE escala_id = p_escala_id AND voluntario_id = p_voluntario_ausente_id;

  -- Buscar substituto: voluntário ativo, não ausente, com menos participações
  -- na função, que não seja epicom (exceto para funções que permitem)
  FOR v_substituto IN
    SELECT
      v.id AS vid,
      v.nome AS vnome,
      COALESCE(hf.total, 0) AS total_funcao,
      hf.ultima_data
    FROM public.voluntarios v
    LEFT JOIN public.historico_funcoes_voluntario(v_localidade) hf
      ON hf.voluntario_id = v.id AND hf.funcao = v_funcao_alocada
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
        v_funcao_alocada != 'Epicon'
        OR v.epicom = true
      )
      -- Restrição Energizador 1: precisa de docente_conscienciologia
      AND (
        v_funcao_alocada != 'Energizador 1'
        OR EXISTS (
          SELECT 1 FROM public.voluntario_atividades va
          WHERE va.voluntario_id = v.id
            AND va.atividade = 'docente_conscienciologia'
        )
      )
      -- Demais funções: não pode ser epicom (exceto Observador Parapsíquico)
      AND (
        v_funcao_alocada IN ('Epicon', 'Observador Parapsíquico')
        OR v.epicom = false
      )
    ORDER BY COALESCE(hf.total, 0), hf.ultima_data NULLS FIRST, v.nome
    LIMIT 1
  LOOP
    -- Inserir o substituto
    INSERT INTO public.escala_alocacao (escala_id, funcao, voluntario_id)
    VALUES (p_escala_id, v_funcao_alocada, v_substituto.vid);

    funcao := v_funcao_alocada;
    substituto_id := v_substituto.vid;
    substituto_nome := v_substituto.vnome;
    RETURN NEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.substituir_ausente(bigint, bigint) TO authenticated;

-- Migration 0085: Escala manual, efetivação e alertas de repetição
-- Adiciona colunas para rastrear execução real das alocações

-- ── 1. Colunas em escala_alocacao ─────────────────────────────────────

ALTER TABLE public.escala_alocacao
  ADD COLUMN IF NOT EXISTS efetivado boolean DEFAULT false;

ALTER TABLE public.escala_alocacao
  ADD COLUMN IF NOT EXISTS efetivado_por uuid REFERENCES auth.users(id);

ALTER TABLE public.escala_alocacao
  ADD COLUMN IF NOT EXISTS efetivado_em timestamptz;

ALTER TABLE public.escala_alocacao
  ADD COLUMN IF NOT EXISTS substituido_por bigint REFERENCES public.voluntarios(id);

-- ── 2. Função: contar funções de um voluntário no mês ─────────────────

CREATE OR REPLACE FUNCTION public.contar_funcoes_mes(
  p_voluntario_id bigint,
  p_mes date DEFAULT NULL
)
RETURNS TABLE (funcao text, total integer)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- Se p_mes não informado, usa o mês atual
  WITH params AS (
    SELECT
      COALESCE(p_mes, date_trunc('month', now())::date) AS mes_inicio,
      (COALESCE(p_mes, date_trunc('month', now())::date) + interval '1 month - 1 day')::date AS mes_fim
  )
  SELECT
    regexp_replace(ea.funcao, ' \d+$', '') AS funcao,
    COUNT(*)::int AS total
  FROM public.escala_alocacao ea
  JOIN public.escala_semanal es ON es.id = ea.escala_id
  JOIN params p ON true
  WHERE ea.voluntario_id = p_voluntario_id
    AND es.status != 'cancelada'
    AND es.data_semana >= p.mes_inicio
    AND es.data_semana <= p.mes_fim
  GROUP BY regexp_replace(ea.funcao, ' \d+$', '');
$$;

GRANT EXECUTE ON FUNCTION public.contar_funcoes_mes(bigint, date) TO authenticated;

-- ── 3. Função: alertas de repetição no mês para uma escala ────────────

CREATE OR REPLACE FUNCTION public.alertas_repeticao_mes(
  p_escala_id bigint
)
RETURNS TABLE (
  voluntario_id bigint,
  nome text,
  funcao text,
  total_mes integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH escala_atual AS (
    SELECT data_semana, localidade
    FROM public.escala_semanal
    WHERE id = p_escala_id
  ),
  -- Alocações da escala atual
  alocacoes_atual AS (
    SELECT ea.voluntario_id, regexp_replace(ea.funcao, ' \d+$', '') AS funcao
    FROM public.escala_alocacao ea
    WHERE ea.escala_id = p_escala_id
  ),
  -- Contar quantas vezes cada voluntário fez CADA função no mês (incluindo escala atual)
  contagem_mes AS (
    SELECT
      a.voluntario_id,
      a.funcao,
      COUNT(*)::int AS total
    FROM alocacoes_atual a
    -- Contar outras escalas do mesmo mês
    JOIN public.escala_alocacao ea2 ON ea2.voluntario_id = a.voluntario_id
      AND regexp_replace(ea2.funcao, ' \d+$', '') = a.funcao
    JOIN public.escala_semanal es2 ON es2.id = ea2.escala_id
      AND es2.status != 'cancelada'
      AND es2.data_semana >= date_trunc('month', (SELECT data_semana FROM escala_atual))::date
      AND es2.data_semana <= (date_trunc('month', (SELECT data_semana FROM escala_atual)) + interval '1 month - 1 day')::date
    WHERE ea2.escala_id != p_escala_id  -- excluir a escala atual
    GROUP BY a.voluntario_id, a.funcao
    HAVING COUNT(*) >= 2  -- 2 ou mais vezes = alerta
  )
  SELECT
    cm.voluntario_id,
    v.nome,
    cm.funcao,
    cm.total
  FROM contagem_mes cm
  JOIN public.voluntarios v ON v.id = cm.voluntario_id;
$$;

GRANT EXECUTE ON FUNCTION public.alertas_repeticao_mes(bigint) TO authenticated;

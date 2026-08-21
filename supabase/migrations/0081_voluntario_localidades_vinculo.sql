-- 0081_voluntario_localidades_vinculo.sql
-- Vínculo real entre voluntários e localidades de dinâmica.
-- A tabela voluntario_localidades já existe (migration 0025) com as
-- cidades. Esta migration cria a tabela pivô para saber QUAIS localidades
-- cada voluntário frequenta.

CREATE TABLE IF NOT EXISTS public.voluntario_localidades_vinculo (
  voluntario_id   bigint NOT NULL REFERENCES public.voluntarios(id) ON DELETE CASCADE,
  localidade_id   bigint NOT NULL REFERENCES public.voluntario_localidades(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  PRIMARY KEY (voluntario_id, localidade_id)
);

ALTER TABLE public.voluntario_localidades_vinculo ENABLE ROW LEVEL SECURITY;

-- Leitura: todos autenticados
CREATE POLICY "voluntario_localidades_vinculo_select"
  ON public.voluntario_localidades_vinculo FOR SELECT
  TO authenticated
  USING (true);

-- Escrita: coordenadores e voluntariado
CREATE POLICY "voluntario_localidades_vinculo_insert"
  ON public.voluntario_localidades_vinculo FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

CREATE POLICY "voluntario_localidades_vinculo_delete"
  ON public.voluntario_localidades_vinculo FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (select auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_vlv_localidade
  ON public.voluntario_localidades_vinculo (localidade_id);

-- 0084: Tabela de disponibilidade semanal dos voluntários
-- Voluntários marcam se podem ou não participar de cada escala semanal.
-- O coordenador também pode marcar para todos.

CREATE TABLE IF NOT EXISTS public.escala_disponibilidade (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  escala_id     bigint NOT NULL REFERENCES public.escala_semanal(id) ON DELETE CASCADE,
  voluntario_id bigint NOT NULL REFERENCES public.voluntarios(id),
  disponivel    boolean NOT NULL DEFAULT true,
  motivo        text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (escala_id, voluntario_id)
);

CREATE INDEX IF NOT EXISTS idx_escala_disponibilidade_escala
  ON public.escala_disponibilidade (escala_id);

CREATE INDEX IF NOT EXISTS idx_escala_disponibilidade_voluntario
  ON public.escala_disponibilidade (voluntario_id);

-- RLS
ALTER TABLE public.escala_disponibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escala_disponibilidade_select"
  ON public.escala_disponibilidade FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "escala_disponibilidade_insert"
  ON public.escala_disponibilidade FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

CREATE POLICY "escala_disponibilidade_update"
  ON public.escala_disponibilidade FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

CREATE POLICY "escala_disponibilidade_delete"
  ON public.escala_disponibilidade FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('coordenador_geral', 'voluntariado')
    )
  );

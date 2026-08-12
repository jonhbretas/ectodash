-- supabase/migrations/0068_area_financeiro.sql
-- Recria a área institucional 'Financeiro' caso tenha sido removida na
-- reorganização feita pela tela /areas. A área foi originalmente criada na
-- migration 0052 (separada de 'Adminstrativo Financeiro') e é usada como
-- filtro no acervo de Utilidades e demais módulos. Idempotente.

INSERT INTO public.areas_institucionais (nome, area_mae_id, criado_por)
SELECT 'Financeiro', NULL, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.areas_institucionais WHERE nome = 'Financeiro'
);

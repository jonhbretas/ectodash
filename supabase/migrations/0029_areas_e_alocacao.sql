-- supabase/migrations/0029_areas_e_alocacao.sql
-- Seed da hierarquia de áreas institucionais (compatível com o sistema
-- anterior) e alinhamento de area_atuacao dos voluntários para casar com
-- os nomes das áreas criadas.

-- 1. Áreas de nível superior (area_mae_id = NULL)
INSERT INTO public.areas_institucionais (nome, area_mae_id, criado_por)
VALUES
  ('Adminstrativo Financeiro', NULL, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1)),
  ('Coordenaação geral',       NULL, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1)),
  ('Comunicação e Eventos',    NULL, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1)),
  ('Internacional',            NULL, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1)),
  ('Parapedagógico',           NULL, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1)),
  ('Paratecnológico',          NULL, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1)),
  ('Voluntariado',             NULL, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1))
ON CONFLICT (nome) DO NOTHING;

-- 2. Sub-áreas de Paratecnológico
INSERT INTO public.areas_institucionais (nome, area_mae_id, criado_por)
SELECT sub.nome, ai.id, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1)
FROM (VALUES ('DIP'), ('Bioenergologia')) AS sub(nome)
JOIN public.areas_institucionais ai ON ai.nome = 'Paratecnológico'
ON CONFLICT (nome) DO NOTHING;

-- 3. Alinhar area_atuacao dos voluntários com os nomes das áreas
UPDATE public.voluntarios SET area_atuacao = 'Adminstrativo Financeiro' WHERE area_atuacao = 'Financeiro';
UPDATE public.voluntarios SET area_atuacao = 'DIP'                   WHERE area_atuacao = 'Paratecnológico - DIP';
UPDATE public.voluntarios SET area_atuacao = 'Bioenergologia'        WHERE area_atuacao = 'Paratecnológico - Bioenergologia';

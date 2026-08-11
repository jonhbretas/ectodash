-- supabase/migrations/0052_limpeza_areas_demandas.sql
-- Limpeza de áreas e demandas:
-- 1. Criar área 'Financeiro' (separando de 'Adminstrativo Financeiro')
-- 2. Migrar utilidades_itens das áreas removidas para 'Financeiro'
-- 3. Deletar áreas 'Adminstrativo Financeiro' e 'Comunicação e Eventos'
-- 4. Deletar demandas com título começando por 'DA '
-- 5. Corrigir typo 'Coordenaação geral' → 'Coordenação Geral'

-- 1. Criar 'Financeiro' se não existir
INSERT INTO public.areas_institucionais (nome, area_mae_id, criado_por)
SELECT 'Financeiro', NULL, (SELECT id FROM public.profiles WHERE role = 'coordenador_geral' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM public.areas_institucionais WHERE nome = 'Financeiro'
);

-- 2. Migrar utilidades_itens das áreas que serão removidas para 'Financeiro'
UPDATE public.utilidades_itens
SET area_id = (SELECT id FROM public.areas_institucionais WHERE nome = 'Financeiro' LIMIT 1)
WHERE area_id IN (
  SELECT id FROM public.areas_institucionais
  WHERE nome IN ('Adminstrativo Financeiro', 'Comunicação e Eventos')
);

-- 3. Deletar lider_areas que referenciam áreas que serão removidas
DELETE FROM public.lider_areas
WHERE area IN ('Adminstrativo Financeiro', 'Comunicação e Eventos');

-- 4. Deletar as áreas removidas
DELETE FROM public.areas_institucionais
WHERE nome IN ('Adminstrativo Financeiro', 'Comunicação e Eventos');

-- 5. Deletar demandas com título começando por 'DA ' (dados de teste/automação)
DELETE FROM public.demandas
WHERE titulo ~ '^DA \d';

-- 6. Corrigir typo 'Coordenaação geral' → 'Coordenação Geral' (merge no nome
-- correto — que pode já existir no banco — depois remove o duplicado)
UPDATE public.demandas SET area = 'Coordenação Geral' WHERE area = 'Coordenaação geral';
UPDATE public.voluntarios SET area_atuacao = 'Coordenação Geral' WHERE area_atuacao = 'Coordenaação geral';

INSERT INTO public.lider_areas (lider_id, area, created_at)
SELECT lider_id, 'Coordenação Geral', created_at
FROM public.lider_areas
WHERE area = 'Coordenaação geral'
ON CONFLICT (lider_id, area) DO NOTHING;
DELETE FROM public.lider_areas WHERE area = 'Coordenaação geral';

UPDATE public.utilidades_itens
SET area_id = (SELECT id FROM public.areas_institucionais WHERE nome = 'Coordenação Geral' LIMIT 1)
WHERE area_id IN (
  SELECT id FROM public.areas_institucionais WHERE nome = 'Coordenaação geral'
);

DELETE FROM public.areas_institucionais
WHERE nome = 'Coordenaação geral';

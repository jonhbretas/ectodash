-- Backfill area_id para voluntários com area_id NULL.
-- 51 voluntários ativos tinham area_id = null, o que impedia o RLS
-- coordena_area(area_id) de resolver visibilidade para coordenadores
-- de área/cargo. Mapeamento baseado no area_atuacao → areas_institucionais.
--
-- Regras:
--   1. Match exato: area_atuacao = areas_institucionais.nome (case-insensitive)
--   2. Sufixo composto: "X - Y" → busca Y em areas_institucionais.nome
--   3. Fallback "Comunicação e Eventos" → Comunicação (id 3)
--   4. Volunteers with area_atuacao IS NULL → sem mudança (permanece null)

-- 1. Match exato por nome
UPDATE public.voluntarios v
SET area_id = ai.id
FROM public.areas_institucionais ai
WHERE v.area_id IS NULL
  AND v.area_atuacao IS NOT NULL
  AND lower(trim(v.area_atuacao)) = lower(trim(ai.nome));

-- 2. Sufixo composto: "Paratecnológico - DIP" → busca "DIP"
UPDATE public.voluntarios v
SET area_id = ai.id
FROM public.areas_institucionais ai
WHERE v.area_id IS NULL
  AND v.area_atuacao IS NOT NULL
  AND position(' - ' in v.area_atuacao) > 0
  AND lower(trim(split_part(v.area_atuacao, ' - ', 2))) = lower(trim(ai.nome));

-- 3. "Comunicação e Eventos" → Comunicação (id 3)
UPDATE public.voluntarios v
SET area_id = 3
WHERE v.area_id IS NULL
  AND lower(trim(v.area_atuacao)) = 'comunicação e eventos';

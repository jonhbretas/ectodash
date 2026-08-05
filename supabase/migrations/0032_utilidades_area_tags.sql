-- supabase/migrations/0023_utilidades_area_tags.sql
-- Add area_id (FK to areas_institucionais) and tags (text array) to utilidades_itens.

ALTER TABLE public.utilidades_itens
  ADD COLUMN area_id bigint REFERENCES public.areas_institucionais(id) ON DELETE SET NULL;

ALTER TABLE public.utilidades_itens
  ADD COLUMN tags text[] DEFAULT '{}';

CREATE INDEX utilidades_itens_area_idx ON public.utilidades_itens (area_id);

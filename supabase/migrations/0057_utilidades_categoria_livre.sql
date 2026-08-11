-- supabase/migrations/0057_utilidades_categoria_livre.sql
-- Libera o CHECK de categorias fixas em utilidades_itens para permitir
-- títulos/categorias específicas cadastradas diretamente na tela (ex: tutoriais).

DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'utilidades_itens'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%ata_fundacao%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.utilidades_itens DROP CONSTRAINT %I', conname);
  END IF;
END $$;

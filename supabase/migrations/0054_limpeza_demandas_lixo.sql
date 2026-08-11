-- supabase/migrations/0054_limpeza_demandas_lixo.sql
-- Remove demandas geradas por testes de IA/transcrição, criadas após a
-- limpeza da migration 0052. Padrão: título começa com "D" (DA, DB,
-- DPai, DFilha...) seguido de um timestamp em milissegundos — dados de
-- teste, sem responsável nem conteúdo real.
DELETE FROM public.demandas
WHERE titulo ~ '^D[A-Za-z]* 1[0-9]{11,}';

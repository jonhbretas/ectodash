-- supabase/migrations/0055_limpeza_voluntarios_lixo.sql
-- Remove voluntários criados por testes de IA/automação — nome no padrão
-- "Novo Cadastro <timestamp>-<n>-<hash>", sem conta vinculada nem dados
-- reais. Referências em tabelas filhas (demanda_responsaveis,
-- demanda_membros, ata_participantes, voluntario_situacao,
-- voluntario_areas) são removidas por ON DELETE CASCADE.
DELETE FROM public.voluntarios
WHERE nome ~ '^Novo Cadastro [0-9]{10,}';

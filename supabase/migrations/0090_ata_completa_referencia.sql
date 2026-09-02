-- supabase/migrations/0090_ata_completa_referencia.sql
-- Ata no formato 02_ATA_ECTOLAB_2026-09-01.md (errando por excesso)
-- Adiciona os blocos que o modelo de referencia exige e que a estrutura enxuta não tinha:
-- duracao / formato / conducao / proxima_reuniao / saidas antecipadas / decisoes / calendario / observacoes
-- Tudo nullable para retrocompatibilidade (atas antigas continuam válidas).
-- decisoes e calendario são jsonb para manter a tabela numerada e o calendário cronológico
-- exatamente como na referência, sem criar 3 tabelas novas para 1 ata.

alter table public.reunioes
  add column if not exists duracao text,
  add column if not exists formato text,
  add column if not exists conducao text,
  add column if not exists proxima_reuniao date,
  add column if not exists saidas_antecipadas jsonb default '[]'::jsonb,
  add column if not exists decisoes jsonb default '[]'::jsonb,
  add column if not exists calendario jsonb default '[]'::jsonb,
  add column if not exists observacoes text;

-- Índices leves para consultas por data (calendário / próxima reunião)
create index if not exists reunioes_proxima_reuniao_idx on public.reunioes (proxima_reuniao);
create index if not exists reunioes_data_reuniao_idx on public.reunioes (data_reuniao);

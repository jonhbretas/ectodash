-- supabase/migrations/0087_pautas_data_horario_reuniao.sql
-- Pautas ganham campos de data/horário solicitado e seleção de reunião.
-- data_solicitada e horario_solicitado registram quando o solicitante quer
-- que a pauta seja tratada. reuniao_selecionada_id permite vincular
-- diretamente a uma reunião futura (em vez de sempre ir para a próxima).
-- RLS existente (0076) já cobre INSERT/UPDATE — basta manter as colunas
-- dentro das mesmas políticas.

alter table public.pautas
  add column data_solicitada date,
  add column horario_solicitado text,
  add column reuniao_selecionada_id bigint
    references public.reunioes(id) on delete set null;

create index pautas_reuniao_selecionada_id_idx on public.pautas (reuniao_selecionada_id);

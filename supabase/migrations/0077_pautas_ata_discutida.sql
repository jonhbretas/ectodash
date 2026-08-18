-- supabase/migrations/0077_pautas_ata_discutida.sql
-- Pautas ganham o vínculo com a ata da reunião em que foram discutidas.
-- ata_id continua sendo a ata de ORIGEM (quando a pauta nasceu de uma
-- análise); ata_discutida_id registra a reunião em que o tópico foi
-- tratado (setado junto com status = 'discutida'). O CHECK documenta o
-- invariante: uma pauta pendente nunca aponta para uma ata de discussão.
-- Sources: 0076_pautas.sql [CITED: this repo]; FK indexing skill.

alter table public.pautas
  add column ata_discutida_id bigint
    references public.reunioes(id) on delete set null
    check (ata_discutida_id is null or status = 'discutida');

create index pautas_ata_discutida_id_idx on public.pautas (ata_discutida_id);

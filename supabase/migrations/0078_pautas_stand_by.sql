-- supabase/migrations/0078_pautas_stand_by.sql
-- Pautas ficam em espera ("stand by") quando o autor quer adiar para uma
-- reunião futura em vez de discutir na próxima. Em stand_by = true, a pauta
--some da lista "O que será discutido" mas continua visível numa seção
-- separada, podendo ser retomada a qualquer momento.

alter table public.pautas
  add column stand_by boolean not null default false;

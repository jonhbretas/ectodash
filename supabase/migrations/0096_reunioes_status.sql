-- supabase/migrations/0096_reunioes_status.sql
-- Reunião existe antes da ata: a linha em `reunioes` representa a REUNIÃO
-- (toda terça 19h), e a ata (resumo, pontos, deliberações) é preenchida
-- depois que ela acontece. Por isso a pauta vincula na reunião, não na ata.
--
-- `status` registra o ciclo de vida:
--   agendada   — criada automaticamente ao pedir pauta (ou manualmente),
--                ainda sem ata;
--   realizada  — aconteceu e tem (ou terá) ata;
--   adiada     — não houve nesta data, adiada;
--   remarcada  — não houve nesta data, remarcada para outra;
--   nao_houve  — não houve reunião (sem nova data).
-- `observacoes` (0090) guarda o motivo visível ("não houve quórum", etc.).
-- RLS existente (0007) já cobre a nova coluna — sem política nova.

alter table public.reunioes
  add column if not exists status text not null default 'realizada'
    check (status in ('agendada', 'realizada', 'adiada', 'remarcada', 'nao_houve'));

comment on column public.reunioes.status is
  'Ciclo de vida da reunião: agendada (sem ata ainda), realizada, adiada, remarcada, nao_houve. A pauta vincula na reunião; a ata é preenchida depois.';

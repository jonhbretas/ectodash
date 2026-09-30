-- supabase/migrations/0111_propostas_aluno_sync.sql
-- Propostas financeiras com foco no ALUNO (cursos/eventos/atividades da
-- Ectolab) + colunas para sincronizar com o Google Planilhas nos dois
-- sentidos:
--   - PULL (planilha → sistema): linhas da planilha viram propostas com
--     origem='planilha' + sheet_row (aba!linha, estável). A sincronização
--     substitui só as linhas de origem planilha (espelha a semântica
--     whole-replace do financeiro em 0006/0008); o que foi digitado no
--     sistema (origem='sistema') nunca é apagado pelo sync.
--   - PUSH (sistema → planilha): exportação sobrescreve o intervalo da
--     aba com o estado atual do sistema.
--
-- Dedup do pull: índice único parcial em sheet_row (só linhas planilha).

alter table public.propostas_financeiras
  add column if not exists aluno_nome text,
  add column if not exists aluno_email text,
  add column if not exists curso_atividade text,
  add column if not exists evento_id bigint references public.eventos(id) on delete set null,
  add column if not exists origem text not null default 'sistema'
    check (origem in ('sistema', 'planilha')),
  add column if not exists sheet_row text,
  add column if not exists sincronizado_em timestamptz;

-- Backfill de linhas antigas (0110): aluno = contraparte ou título.
update public.propostas_financeiras
set aluno_nome = coalesce(nullif(trim(contraparte), ''), titulo),
    curso_atividade = coalesce(nullif(trim(curso_atividade), ''), titulo)
where aluno_nome is null or curso_atividade is null;

alter table public.propostas_financeiras
  alter column aluno_nome set not null,
  alter column curso_atividade set not null;

create index if not exists propostas_aluno_idx on public.propostas_financeiras (aluno_nome);
create index if not exists propostas_evento_idx on public.propostas_financeiras (evento_id);
create index if not exists propostas_origem_idx on public.propostas_financeiras (origem);

-- Uma linha da planilha = uma proposta (re-sync da mesma linha atualiza,
-- nunca duplica).
create unique index if not exists propostas_sheet_row_uidx
  on public.propostas_financeiras (sheet_row)
  where origem = 'planilha' and sheet_row is not null;

comment on column public.propostas_financeiras.aluno_nome is 'Aluno da Ectolab (busca em wp_customers ou digitação manual).';
comment on column public.propostas_financeiras.curso_atividade is 'Curso, evento ou atividade da Ectolab.';
comment on column public.propostas_financeiras.origem is 'sistema = digitado no app; planilha = puxado do Google Sheets.';
comment on column public.propostas_financeiras.sheet_row is 'Endereço estável da linha na planilha (Aba!N) para dedup do pull.';

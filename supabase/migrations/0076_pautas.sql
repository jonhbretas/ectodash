-- supabase/migrations/0076_pautas.sql
-- Pautas de reunião — the agenda topics that volunteers and coordenadores
-- list to be discussed at the NEXT weekly meeting (toda terça-feira). Two
-- sources feed the same list:
--   1. "Pedir pauta" (origem = 'manual'): any volunteer submits a topic;
--   2. AI meeting analysis (origem = 'ata'): the transcription extractor
--      surfaces deferred topics ("vamos falar semana que vem sobre X") as
--      pautas and links them to their source ata (ata_id).
-- A pauta lives in 'pendente' until discussed, then 'discutida'. RLS mirrors
-- reunioes' authorship conventions (0007_reunioes.sql): SELECT open to every
-- authenticated volunteer (pautas are shared institution knowledge); INSERT
-- binds criado_por to the session; UPDATE/DELETE limited to the creator or
-- any coordenador_geral. Uses the shared set_updated_at trigger function
-- (0003_demandas.sql) and registers on the generic audit trail (0059).
-- Sources: 0007_reunioes.sql authorship policies [CITED: this repo];
-- 0003_demandas.sql set_updated_at + FK indexing [CITED: this repo];
-- 0059_audit_log.sql registrar_audit [CITED: this repo].

create table public.pautas (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) > 0),
  contexto text,
  status text not null default 'pendente' check (status in ('pendente', 'discutida')),
  origem text not null default 'manual' check (origem in ('manual', 'ata')),
  -- Ata que originou esta pauta (apenas quando origem = 'ata').
  ata_id bigint references public.reunioes(id) on delete set null,
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Foreign keys are not auto-indexed by Postgres (skill: FK indexing).
create index pautas_ata_id_idx on public.pautas (ata_id);
create index pautas_status_idx on public.pautas (status);
create index pautas_created_at_idx on public.pautas (created_at desc);

alter table public.pautas enable row level security;

-- Any authenticated volunteer can read every pauta — shared institution
-- knowledge, same policy as reunioes (0007).
create policy "authenticated users can view all pautas"
  on public.pautas
  for select
  to authenticated
  using (true);

-- Authorship is bound server-side: the column default is auth.uid() and the
-- WITH CHECK requires the inserting session to claim its own id — the same
-- anti-spoofing shape reunioes uses (0007).
create policy "authenticated users can create pautas"
  on public.pautas
  for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

-- Creator or any coordenador_geral can edit (mark discussed, reopen) a pauta.
create policy "creator or coordinator can update pautas"
  on public.pautas
  for update
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  )
  with check (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

create policy "creator or coordinator can delete pautas"
  on public.pautas
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

drop trigger if exists pautas_set_updated_at on public.pautas;
create trigger pautas_set_updated_at
  before update on public.pautas
  for each row execute function public.set_updated_at();

-- Generic audit trail (0059): one trigger line registers the table.
create trigger audit_pautas
  after insert or update or delete on public.pautas
  for each row execute function public.registrar_audit('id');

-- supabase/migrations/0015_atas_dips.sql
-- Structured meeting minutes + DIP tracking.
--
-- 1. reunioes gains the structured fields an AI-generated ata carries:
--    horario, participantes, pontos_principais, deliberacoes, plus texto
--    (the full transcription/file source — stored as TEXT, never binary,
--    per the user's "lighter format" decision) and arquivo_nome (original
--    uploaded file name for easy identification). resumo stays the
--    narrative summary; the new columns are the structured breakdown.
--
-- 2. public.dips — one row per DIP mention in a meeting transcript
--    (user decision 2026-08-04: "registro por menção", preserving full
--    update history). Each mention links back to its ata. RLS mirrors
--    reunioes' authorship conventions (0007_reunioes.sql): SELECT open to
--    every authenticated volunteer, INSERT bound to the session,
--    UPDATE/DELETE limited to the creator or any coordenador_geral.
-- Sources: 0007_reunioes.sql [CITED: this repo]; 0012_trello_features.sql
-- comments pattern [CITED: this repo].

alter table public.reunioes
  add column horario time,
  add column participantes text,
  add column pontos_principais text,
  add column deliberacoes text,
  add column texto text,
  add column arquivo_nome text;

create table public.dips (
  id bigint generated always as identity primary key,
  ata_id bigint not null references public.reunioes(id) on delete cascade,
  localidade text not null check (char_length(trim(localidade)) > 0),
  pais text not null check (char_length(trim(pais)) > 0),
  data_dip date,
  participantes integer check (participantes is null or participantes >= 0),
  observacoes text,
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create index dips_ata_id_idx on public.dips (ata_id);
create index dips_localidade_idx on public.dips (localidade);
create index dips_data_dip_idx on public.dips (data_dip);

alter table public.dips enable row level security;

-- Any authenticated volunteer can read any DIP record — shared
-- institution knowledge, same policy as reunioes (0007).
create policy "authenticated users can view all dips"
  on public.dips
  for select
  to authenticated
  using (true);

-- Authorship is bound server-side: the column default is auth.uid() and
-- the WITH CHECK requires the inserting session to claim its own id —
-- the same anti-spoofing shape reunioes uses (0007).
create policy "authenticated users can create dips"
  on public.dips
  for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

create policy "creator or coordinator can update dips"
  on public.dips
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

create policy "creator or coordinator can delete dips"
  on public.dips
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

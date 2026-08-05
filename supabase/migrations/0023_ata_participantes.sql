-- supabase/migrations/0023_ata_participantes.sql
-- Meeting participants linked to the institutional roster.
--
-- 1. ata_participantes — one row per (ata, voluntario) pair. The ata's
--    free-text `participantes` column stays untouched (backward compat);
--    this table is the structured link that powers the per-volunteer
--    participation metric in the volunteer profile and the coordinator's
--    view. RLS mirrors the reunioes authorship model (0007): SELECT open
--    to every authenticated volunteer (shared institution knowledge),
--    INSERT/UPDATE/DELETE restricted to the ata's creator or any
--    coordenador_geral — the same rule that governs editing the ata itself.
--    The insert/update/delete policies validate against the parent ata's
--    criado_por via a correlated subquery, so a stranger can never add
--    participants to someone else's ata.
-- Sources: 0007_reunioes.sql authorship policies [CITED: this repo];
-- 0020_voluntarios_responsaveis.sql join-table shape [CITED: this repo].

create table public.ata_participantes (
  ata_id bigint not null references public.reunioes(id) on delete cascade,
  voluntario_id bigint not null references public.voluntarios(id) on delete cascade,
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (ata_id, voluntario_id)
);

create index ata_participantes_voluntario_idx on public.ata_participantes (voluntario_id);

alter table public.ata_participantes enable row level security;

-- Any authenticated volunteer can read the links — same shared-knowledge
-- policy as reunioes and dips (0007/0015).
create policy "authenticated users can view all ata participants"
  on public.ata_participantes
  for select
  to authenticated
  using (true);

-- Authorship is bound to the parent ata: only the ata's creator (or any
-- coordenador_geral) can attach participants, mirroring the update policy
-- on reunioes itself.
create policy "ata creator or coordinator can insert ata participants"
  on public.ata_participantes
  for insert
  to authenticated
  with check (
    (select r.criado_por from public.reunioes r where r.id = ata_id) = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

create policy "ata creator or coordinator can update ata participants"
  on public.ata_participantes
  for update
  to authenticated
  using (
    (select r.criado_por from public.reunioes r where r.id = ata_id) = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  )
  with check (
    (select r.criado_por from public.reunioes r where r.id = ata_id) = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

create policy "ata creator or coordinator can delete ata participants"
  on public.ata_participantes
  for delete
  to authenticated
  using (
    (select r.criado_por from public.reunioes r where r.id = ata_id) = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

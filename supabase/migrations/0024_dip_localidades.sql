-- supabase/migrations/0024_dip_localidades.sql
-- Localidades da Dinâmica DIP — cadastro padronizado.
--
-- 1. dip_localidades — canonical list of DIP localities (localidade + pais),
--    mirroring areas_institucionais (0022): SELECT open to all
--    authenticated, INSERT/UPDATE/DELETE only for coordenador_geral (the
--    app's admin). dips.localidade stays free text for backward compat; the
--    registered list feeds the admin register UI and the datalist that
--    suggests standard names when editing a DIP record. Existing records
--    are backfilled once so the list starts with what's already in use.
-- Sources: 0022_areas_institucionais.sql policies [CITED: this repo].

create table public.dip_localidades (
  id bigint generated always as identity primary key,
  localidade text not null unique check (char_length(trim(localidade)) > 0),
  pais text not null check (char_length(trim(pais)) > 0),
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create index dip_localidades_pais_idx on public.dip_localidades (pais);

alter table public.dip_localidades enable row level security;

create policy "authenticated users can view all dip localidades"
  on public.dip_localidades
  for select
  to authenticated
  using (true);

create policy "coordenador_geral can insert dip localidades"
  on public.dip_localidades
  for insert
  to authenticated
  with check ((select public.has_role('coordenador_geral')));

create policy "coordenador_geral can update dip localidades"
  on public.dip_localidades
  for update
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create policy "coordenador_geral can delete dip localidades"
  on public.dip_localidades
  for delete
  to authenticated
  using ((select public.has_role('coordenador_geral')));

-- Backfill: seed the registry with the localidades already present in dips
-- (one row each — the earliest record's país wins) so the standard list
-- starts populated instead of empty.
insert into public.dip_localidades (localidade, pais)
select distinct on (localidade) localidade, pais
from public.dips
order by localidade, data_dip asc nulls last
on conflict (localidade) do nothing;

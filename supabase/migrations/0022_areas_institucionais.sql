-- supabase/migrations/0022_areas_institucionais.sql
-- Institutional áreas registry + sub-áreas and projects table.
--
-- 1. areas_institucionais — canonical list of the institution's areas.
--    Each area can have a parent (area_mae_id), forming a hierarchy:
--    "Paratecnológico" (parent) → "Paratecnológico - DIP" (sub-área).
--    RLS: SELECT open to all authenticated; INSERT/UPDATE/DELETE only
--    for coordenador_geral (same pattern as evento_tipos).
--
-- 2. projetos — standalone project registry. demandas.projeto stays
--    free-text for backward compat but this table gives the coordinator
--    a structured place to manage projects (name, description, area, status).

create table public.areas_institucionais (
  id bigint generated always as identity primary key,
  nome text not null unique check (char_length(trim(nome)) > 0),
  area_mae_id bigint references public.areas_institucionais(id) on delete set null,
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create index areas_institucionais_mae_idx on public.areas_institucionais (area_mae_id);

alter table public.areas_institucionais enable row level security;

create policy "authenticated users can view all areas"
  on public.areas_institucionais
  for select
  to authenticated
  using (true);

create policy "coordenador_geral can insert areas"
  on public.areas_institucionais
  for insert
  to authenticated
  with check ((select public.has_role('coordenador_geral')));

create policy "coordenador_geral can update areas"
  on public.areas_institucionais
  for update
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create policy "coordenador_geral can delete areas"
  on public.areas_institucionais
  for delete
  to authenticated
  using ((select public.has_role('coordenador_geral')));

create table public.projetos (
  id bigint generated always as identity primary key,
  nome text not null check (char_length(trim(nome)) > 0),
  descricao text,
  area text,
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'cancelado')),
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

create index projetos_area_idx on public.projetos (area);

alter table public.projetos enable row level security;

create policy "authenticated users can view all projetos"
  on public.projetos
  for select
  to authenticated
  using (true);

create policy "authenticated users can insert projetos"
  on public.projetos
  for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

create policy "creator or coordinator can update projetos"
  on public.projetos
  for update
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
    or (select public.has_role('coordenador_area'))
  )
  with check (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
    or (select public.has_role('coordenador_area'))
  );

create policy "creator or coordinator can delete projetos"
  on public.projetos
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

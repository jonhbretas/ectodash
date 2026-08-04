-- supabase/migrations/0007_reunioes.sql
-- Atas de reuniões schema — the first screen beyond demandas, requested by
-- the user's sidebar redesign (2026-08-04). Deliberately minimal: titulo,
-- data_reuniao and a free-text resumo (meeting minutes are collaborative,
-- shared knowledge — no per-responsável assignment table in this pass).
-- RLS mirrors demandas' authorship conventions (0003_demandas.sql):
-- SELECT is open to every authenticated volunteer (atas are institution-
-- wide knowledge); INSERT binds criado_por to the session; UPDATE/DELETE
-- are limited to the creator or any coordenador_geral.
-- Sources: 0003_demandas.sql's authorship + set_updated_at conventions
-- [CITED: this repo]; 0002_profiles_role.sql's has_role() precedent
-- [CITED: this repo].

create table public.reunioes (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) > 0),
  data_reuniao date not null,
  resumo text,
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reunioes_data_idx on public.reunioes (data_reuniao);

-- Same trigger pair 0003_demandas.sql established for demandas — a
-- manually-written updated_at column without a trigger drifts.
create or replace function public.set_updated_at_reunioes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reunioes_set_updated_at on public.reunioes;
create trigger reunioes_set_updated_at
  before update on public.reunioes
  for each row execute function public.set_updated_at_reunioes();

alter table public.reunioes enable row level security;

-- Any authenticated volunteer can read any ata — minutes are shared
-- institution knowledge, unlike demandas' role-scoped visibility.
create policy "authenticated users can view all reunioes"
  on public.reunioes
  for select
  to authenticated
  using (true);

-- Authorship is bound server-side: the column default is auth.uid() and
-- the WITH CHECK requires the inserting session to claim its own id — the
-- same anti-spoofing shape 0003_demandas.sql uses for demandas.criado_por.
create policy "authenticated users can create reunioes"
  on public.reunioes
  for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

-- Creator or any coordenador_geral can edit/remove an ata.
create policy "creator or coordinator can update reunioes"
  on public.reunioes
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

create policy "creator or coordinator can delete reunioes"
  on public.reunioes
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

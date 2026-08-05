-- supabase/migrations/0025_voluntario_localidades.sql
-- Localidades (regiões) dos voluntários — cadastro padronizado.
--
-- 1. voluntario_localidades — canonical list of volunteer localidades
--    (the free-text `unidade` column is kept for backward compat). Same
--    RLS shape as dip_localidades (0024): SELECT open to all
--    authenticated, INSERT/UPDATE/DELETE only for coordenador_geral.
--    Backfilled once from the distinct unidade values already in use so
--    the list starts populated.
-- Sources: 0024_dip_localidades.sql [CITED: this repo].

create table public.voluntario_localidades (
  id bigint generated always as identity primary key,
  nome text not null unique check (char_length(trim(nome)) > 0),
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.voluntario_localidades enable row level security;

create policy "authenticated users can view all voluntario localidades"
  on public.voluntario_localidades
  for select
  to authenticated
  using (true);

create policy "coordenador_geral can insert voluntario localidades"
  on public.voluntario_localidades
  for insert
  to authenticated
  with check ((select public.has_role('coordenador_geral')));

create policy "coordenador_geral can update voluntario localidades"
  on public.voluntario_localidades
  for update
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create policy "coordenador_geral can delete voluntario localidades"
  on public.voluntario_localidades
  for delete
  to authenticated
  using ((select public.has_role('coordenador_geral')));

-- Backfill: seed with the localidades already in use (distinct unidade).
-- criado_por is explicit because there is no session during a migration
-- (auth.uid() would be NULL and violate NOT NULL); the oldest profile is
-- credited, skipped entirely if profiles is empty.
do $$
begin
  if exists (select 1 from public.profiles) then
    insert into public.voluntario_localidades (nome, criado_por)
    select distinct unidade,
      (select id from public.profiles order by created_at asc limit 1)
    from public.voluntarios
    where unidade is not null and trim(unidade) <> ''
    on conflict (nome) do nothing;
  end if;
end;
$$;

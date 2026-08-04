-- supabase/migrations/0008_profiles_names_eventos_financeiro.sql
-- User-decided batch (2026-08-04):
--   1. profiles.full_name — display name for volunteers (UI shows the name,
--      falling back to email when unset); fictitious-name seeding happens via
--      scripts/seed-voluntarios.ts, not here.
--   2. eventos table — institution events; demandas.evento_id links a demanda
--      to an event (vínculo evento -> demanda). Events are institution-wide
--      knowledge (SELECT for all authenticated), created by any volunteer,
--      edited/removed by creator or coordenador_geral.
--   3. financial_entries write policies for financeiro/coordenador_geral —
--      the manual CSV/XLSX import path replaces the whole table the same way
--      the cron does, but through a user session (previously service-role
--      only). These roles are the trusted finance-data owners (FIN-04).
-- Sources: 0003_demandas.sql conventions [CITED: this repo]; 0002 has_role()
-- precedent [CITED: this repo]; 0005_reminder_logs.sql role-gated policy
-- idiom [CITED: this repo].

alter table public.profiles
  add column full_name text;

create table public.eventos (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) > 0),
  descricao text,
  data_evento date not null,
  local text,
  criado_por uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index eventos_data_idx on public.eventos (data_evento);

-- demanda -> evento link (nullable, set null on event deletion).
alter table public.demandas
  add column evento_id bigint references public.eventos(id) on delete set null;

create index demandas_evento_id_idx on public.demandas (evento_id);

-- Recreate demandas_com_status: the view was created with `select d.*`,
-- which fixes its column list at creation time — a newly added column
-- (evento_id) does NOT appear until the view is recreated.
drop view public.demandas_com_status;
create view public.demandas_com_status
with (security_invoker = true) as
select
  d.*,
  (d.prazo < current_date and d.status <> 'concluida') as atrasada
from public.demandas d;

-- Same trigger convention as 0003/0007.
create or replace function public.set_updated_at_eventos()
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

drop trigger if exists eventos_set_updated_at on public.eventos;
create trigger eventos_set_updated_at
  before update on public.eventos
  for each row execute function public.set_updated_at_eventos();

alter table public.eventos enable row level security;

create policy "authenticated users can view all eventos"
  on public.eventos
  for select
  to authenticated
  using (true);

create policy "authenticated users can create eventos"
  on public.eventos
  for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

create policy "creator or coordinator can update eventos"
  on public.eventos
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

create policy "creator or coordinator can delete eventos"
  on public.eventos
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

-- Financial write path for the manual import: financeiro and coordenador
-- can replace financial_entries wholesale (delete + insert), mirroring the
-- cron's whole-table-replace semantics — the spreadsheet is the system of
-- record, the dashboard always mirrors it exactly.
create policy "financeiro e coordenador can delete financial entries"
  on public.financial_entries
  for delete
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

create policy "financeiro e coordenador can insert financial entries"
  on public.financial_entries
  for insert
  to authenticated
  with check (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

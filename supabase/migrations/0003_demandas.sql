-- supabase/migrations/0003_demandas.sql
-- Core demandas entity: enum status, many-to-many responsável link table
-- (demanda_responsaveis — NOT a single responsavel_id FK, per 04-CONTEXT.md's
-- locked decision overriding 04-RESEARCH.md's Assumption A2), free-text área,
-- read-time-derived overdue view, permissive-but-authenticated RLS (Phase 5
-- narrows this to role/ownership scoping — see forward-looking notes below).
-- Sources: Postgres generated-column immutability constraint [CITED:
-- postgresql.org/docs/current/ddl-generated-columns.html]; project's own
-- supabase-postgres-best-practices skill (FK indexing, bigint identity PK,
-- partial/composite index patterns) [CITED: .agents/skills installed
-- locally]; project's own supabase skill (views bypass RLS by default;
-- UPDATE requires a matching SELECT policy) [CITED: .agents/skills/supabase
-- installed locally, corroborated by Phase 2's live-verified 02-01-SUMMARY.md
-- SELECT-gates-UPDATE lesson — reproduced here deliberately, in the same
-- migration, not as a follow-up fix].

create type public.demanda_status as enum (
  'pendente',
  'em_andamento',
  'concluida'
);

create table public.demandas (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) > 0),
  descricao text,
  area text,
  criado_por uuid not null references public.profiles(id) default auth.uid(),
  prazo date not null,
  status public.demanda_status not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Many-to-many responsável link: a demanda can have multiple responsáveis,
-- and the same volunteer can be responsável for multiple demandas. This is
-- the user's locked decision (04-CONTEXT.md Data Model), overriding
-- 04-RESEARCH.md's single responsavel_id FK assumption. Deliberately no
-- responsavel_id column exists anywhere on public.demandas.
create table public.demanda_responsaveis (
  demanda_id bigint not null references public.demandas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (demanda_id, profile_id)
);

-- Foreign keys are not auto-indexed by Postgres — index both FK columns
-- per the project's own supabase-postgres-best-practices skill.
create index demandas_criado_por_idx on public.demandas (criado_por);

-- Supports Phase 5's filter/group-by-área (DEM-04) without a full scan.
create index demandas_area_idx on public.demandas (area);

-- Supports "list demandas ordered/filtered by prazo, excluding concluded"
-- (this phase's own list view, and Phase 6/7's overdue queries).
create index demandas_prazo_idx on public.demandas (prazo) where status <> 'concluida';

-- Reverse-lookup direction the composite PK above doesn't already cover
-- ("which demandas is this person responsável for") — needed by Phase 5's
-- filter-by-responsável and Phase 7's reminder targeting.
create index demanda_responsaveis_profile_id_idx on public.demanda_responsaveis (profile_id);

alter table public.demandas enable row level security;
alter table public.demanda_responsaveis enable row level security;

-- Every authenticated user can see every demanda this phase.
-- (Phase 5's DEM-05 narrows this: voluntário comum sees only their own,
-- líder de área sees their área's, coordenador sees all.)
create policy "authenticated users can view all demandas"
  on public.demandas
  for select
  to authenticated
  using (true);

-- Any authenticated user can create a demanda; criado_por is forced to
-- their own auth.uid() (column default handles this, but WITH CHECK makes
-- the invariant explicit and rejects any client attempt to spoof it) —
-- defense-in-depth against a client-supplied criado_por (RESEARCH.md
-- Pitfall 4).
create policy "authenticated users can create demandas"
  on public.demandas
  for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

-- Any authenticated user can edit/conclude any demanda this phase.
-- (Phase 5 narrows this to ownership/role — see forward-looking note below.
-- Reachable because the SELECT policy above is using (true): this phase
-- deliberately reproduces the "SELECT gates UPDATE" fix from
-- 0002_profiles_role.sql by shipping both policies together, never as a
-- follow-up.)
create policy "authenticated users can update demandas"
  on public.demandas
  for update
  to authenticated
  using (true)
  with check (true);

-- demanda_responsaveis mirrors demandas: every authenticated user can see
-- who's responsável for every demanda, and any authenticated user creating
-- or editing a demanda can attach/detach responsáveis. This table has no
-- independent ownership concept apart from the demanda it belongs to.
create policy "authenticated users can view all demanda_responsaveis"
  on public.demanda_responsaveis
  for select
  to authenticated
  using (true);

create policy "authenticated users can create demanda_responsaveis"
  on public.demanda_responsaveis
  for insert
  to authenticated
  with check (true);

-- Editing a demanda's responsável list requires removing stale links (e.g.
-- swapping one responsável for another), expressed as delete-then-insert,
-- not an UPDATE (no UPDATE policy exists on this table for that reason).
-- Same SELECT-gates-DELETE reasoning as Phase 2's SELECT-gates-UPDATE
-- lesson: since SELECT here is already using (true), DELETE is never
-- unreachable.
create policy "authenticated users can delete demanda_responsaveis"
  on public.demanda_responsaveis
  for delete
  to authenticated
  using (true);

create or replace function public.set_updated_at()
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

create trigger demandas_set_updated_at
  before update on public.demandas
  for each row
  execute function public.set_updated_at();

-- Read-time overdue derivation — NOT a stored/generated column (now()/
-- current_date are STABLE, not IMMUTABLE; a `generated always as (...)
-- stored` column referencing either would fail to create at all).
-- security_invoker ensures this view respects the querying user's own RLS
-- grants rather than the view owner's — without it, this view would
-- silently bypass every RLS policy above and leak every demanda to every
-- reader regardless of future Phase 5 narrowing.
create view public.demandas_com_status
with (security_invoker = true) as
select
  d.*,
  (d.prazo < current_date and d.status <> 'concluida') as atrasada
from public.demandas d;

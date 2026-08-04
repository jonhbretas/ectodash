-- supabase/migrations/0004_demandas_role_scope.sql
-- Closes the área-to-líder data-model gap with a many-to-many
-- public.lider_areas join table (a líder can lead multiple áreas
-- simultaneously — the user's locked decision, overriding
-- 05-RESEARCH.md's own [ASSUMED] single-column area_liderada
-- recommendation) and narrows demandas/demanda_responsaveis RLS from
-- Phase 4's permissive baseline to DEM-05's role/ownership scoping.
-- SELECT and UPDATE predicates on demandas are IDENTICAL by
-- construction (copy-pasted, not abstracted), and demanda_responsaveis'
-- own policies are rewritten in the same migration (never deferred) —
-- both are the direct, deliberate carry-forward of Phase 2's
-- SELECT-gates-UPDATE lesson, reproduced here because Phase 4 shipped
-- demandas with using(true) SELECT specifically to defer this
-- narrowing to this phase.
-- Sources: 05-RESEARCH.md Patterns 1-4 (structural template only — the
-- single-column area_liderada design is superseded here by the
-- multi-área lider_areas join table); 0002_profiles_role.sql's
-- has_role() precedent [CITED: this repo]; .agents/skills/supabase
-- (views bypass RLS by default; UPDATE requires a matching SELECT
-- policy; RLS does not cascade to related/join tables) [CITED:
-- project-installed skill].

-- lider_areas: the many-to-many área-to-líder mechanism. Composite
-- primary key (lider_id, area) is what makes this many-to-many: a
-- líder can hold multiple rows (multiple áreas), and the same área
-- string can appear under multiple líderes (co-leadership is not
-- excluded by this design, though not required by DEM-05 either).
-- No CHECK constraint tying lider_id's profiles.role to 'lider_area' —
-- same reasoning 05-RESEARCH.md's Pattern 1 gives for the rejected
-- area_liderada CHECK: a coordenador demoting/promoting a role and
-- assigning an área are two separate steps that shouldn't be forced
-- atomic.
create table public.lider_areas (
  lider_id uuid not null references public.profiles(id) on delete cascade,
  area text not null check (char_length(trim(area)) > 0),
  created_at timestamptz not null default now(),
  primary key (lider_id, area)
);

-- Supports is_lider_of_area()'s reverse lookup ("who leads this área")
-- without a full scan; lider_id is already covered by the composite
-- primary key's leading column.
create index lider_areas_area_idx on public.lider_areas (area);

alter table public.lider_areas enable row level security;

-- is_lider_of_area: mirrors has_role()'s exact SECURITY DEFINER /
-- STABLE / search_path / revoke-grant shape (0002_profiles_role.sql),
-- adapted from a single-column lookup to an exists() over the
-- lider_areas join table. Returns true iff a row exists in
-- lider_areas for the caller AND the caller's profiles.role is still
-- 'lider_area' — the role check is required so a demoted líder whose
-- lider_areas rows were never cleaned up doesn't retain área-scoped
-- access. lower(trim(...)) on both sides: área is free text with no
-- normalization table, so this comparison must be case/whitespace
-- insensitive to be correct, not just cosmetic.
create or replace function public.is_lider_of_area(target_area text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.lider_areas la
    join public.profiles p on p.id = la.lider_id
    where la.lider_id = (select auth.uid())
      and p.role = 'lider_area'
      and lower(trim(la.area)) = lower(trim(target_area))
  );
$$;

revoke execute on function public.is_lider_of_area(text) from public, anon;
grant execute on function public.is_lider_of_area(text) to authenticated;

-- is_responsavel_for: unaffected by the multi-área decision — this
-- helper is unrelated to área/líder modeling. Mirrors the same shape.
create or replace function public.is_responsavel_for(target_demanda_id bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.demanda_responsaveis
    where demanda_id = target_demanda_id
      and profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.is_responsavel_for(bigint) from public, anon;
grant execute on function public.is_responsavel_for(bigint) to authenticated;

-- Drop Phase 4's permissive policies by exact name before creating the
-- narrowed ones, in this same migration — Postgres RLS policies of the
-- same command type are OR'd together, so a stale using(true) policy
-- left in place would silently defeat this entire migration.
drop policy "authenticated users can view all demandas" on public.demandas;
drop policy "authenticated users can update demandas" on public.demandas;

-- SELECT and UPDATE use the IDENTICAL predicate, copy-pasted rather
-- than abstracted — this is deliberate and is the direct fix for
-- Phase 2's SELECT-gates-UPDATE lesson: whatever a role can see, that
-- same role can also edit, by construction. There is no scenario where
-- a role passes this SELECT check but fails the corresponding UPDATE
-- check, because it is the same expression.
create policy "role-scoped demandas visibility"
  on public.demandas
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  );

create policy "role-scoped demandas edit"
  on public.demandas
  for update
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  );

-- DEM-05 says "vê e edita" (sees and edits) — it does not mention
-- delete. No DELETE policy is added to demandas this phase.

-- Drop Phase 4's permissive policies on demanda_responsaveis by exact
-- name — RLS does not cascade from a parent table to a join table, so
-- a bare (non-joined) query against demanda_responsaveis is gated
-- only by its own policy, never inherited from demandas.
drop policy "authenticated users can view all demanda_responsaveis" on public.demanda_responsaveis;
drop policy "authenticated users can create demanda_responsaveis" on public.demanda_responsaveis;
drop policy "authenticated users can delete demanda_responsaveis" on public.demanda_responsaveis;

-- Visibility of a responsável-link row follows the SAME rule as the
-- parent demanda: if you couldn't see the demanda, you can't see who's
-- assigned to it either. Written independently (RLS policies cannot
-- reference another table's policy directly) via a subquery against
-- demandas' columns, plus "you can always see your own assignment."
create policy "role-scoped demanda_responsaveis visibility"
  on public.demanda_responsaveis
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
        )
    )
  );

-- INSERT/UPDATE/DELETE (attaching/detaching a responsável) follow
-- demandas' EDIT predicate — attaching/detaching a responsável
-- requires the same access as editing the demanda itself. `for all`
-- is correct here (not split like demandas' SELECT/UPDATE) because
-- this table has no independent UPDATE use case (swaps happen via
-- delete-then-insert, per 0003_demandas.sql) — there is no scenario
-- where this table's insert/delete permissions should differ.
create policy "role-scoped demanda_responsaveis manage"
  on public.demanda_responsaveis
  for all
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_responsaveis.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

-- No changes to demandas_com_status: it already has
-- security_invoker = true from 0003_demandas.sql, so it automatically
-- inherits this migration's narrowing with no changes to its own
-- definition — the querying user's own (now-narrowed) RLS grants
-- govern what the view returns, exactly as it already governed
-- Phase 4's permissive policy.

-- lider_areas RLS: a líder can see their own rows; only a
-- coordenador_geral can write ANY row (including a líder's own) — a
-- líder cannot self-assign an área, closing the same
-- privilege-escalation shape docs/roles.md already warns about for
-- profiles.role self-promotion, applied here to área assignment.
create policy "lider can view own lider_areas rows"
  on public.lider_areas
  for select
  to authenticated
  using (lider_id = (select auth.uid()));

create policy "coordenador manages all lider_areas rows"
  on public.lider_areas
  for all
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

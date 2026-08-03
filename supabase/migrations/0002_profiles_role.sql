-- supabase/migrations/0002_profiles_role.sql
-- Adds the 4 fixed institutional roles, backfills the existing coordinator
-- account, and ships the has_role() RLS helper this and all future phases use.
-- Sources: Postgres ALTER TABLE docs (fast NOT NULL DEFAULT path, PG11+) [CITED];
-- Supabase Custom Claims & RBAC guide (has_role/authorize pattern) [CITED: supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac]

create type public.app_role as enum (
  'coordenador_geral',
  'lider_area',
  'voluntario_comum',
  'financeiro'
);

alter table public.profiles
  add column role public.app_role not null default 'voluntario_comum';

-- Backfill: the DEFAULT above satisfies NOT NULL for every existing row,
-- including the already-seeded coordinator -- but it backfills them ALL to
-- 'voluntario_comum'. This repository is public, so the coordinator's real
-- institutional email is deliberately never hardcoded into a tracked SQL
-- file. Instead, target the row structurally: the coordinator is, by
-- construction, the very first account created in Phase 1 -- before this
-- migration, `public.profiles` held exactly that one row. Promote the
-- earliest-created row to `coordenador_geral`. This runs once at `db push`
-- time, before any test suite (which only creates disposable
-- `@example.invalid` fixtures) has run, so `created_at asc limit 1` is a
-- reliable, reproducible target on both the live project and a fresh
-- restore. On an empty table this is a correct no-op.
update public.profiles
  set role = 'coordenador_geral'
  where id = (
    select id
    from public.profiles
    order by created_at asc
    limit 1
  );

create or replace function public.has_role(required_role public.app_role)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = required_role
  );
$$;

revoke execute on function public.has_role(public.app_role) from public, anon;
grant execute on function public.has_role(public.app_role) to authenticated;

-- Postgres RLS note (undocumented in the phase's original research, found
-- during live verification of this migration): an UPDATE's internal row
-- lookup is itself gated by SELECT policies. Without a SELECT policy
-- granting the coordinator visibility of another user's row, the UPDATE
-- policy below is unreachable -- PostgREST reports success (204/200, zero
-- rows affected) with no error, which is easy to mistake for "the deny
-- path working" when it's actually "the allow path silently broken." This
-- SELECT policy is required for the UPDATE policy to have any effect at
-- all; Phase 1's self-only SELECT policy is untouched for every other role.
create policy "coordenador geral can view any profile"
  on public.profiles
  for select
  to authenticated
  using ((select public.has_role('coordenador_geral')));

create policy "coordenador geral can update any profile"
  on public.profiles
  for update
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

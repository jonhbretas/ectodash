-- supabase/migrations/0020_voluntarios_responsaveis.sql
-- Demandas can now be assigned to ROSTER volunteers without an auth
-- account (user decision, 2026-08-04): "já temos o nome no sistema, na
-- tela de voluntários" — every registered volunteer is assignable as
-- responsável/membro even before they ever sign in. The institutional
-- roster (public.voluntarios) is the source of truth for who a demanda
-- belongs to; profiles only add access.
--
-- Mechanics: demanda_responsaveis and demanda_membros each gain a nullable
-- `voluntario_id` FK, with exactly one of (profile_id, voluntario_id) set
-- (CHECK). The old composite PK (demanda_id, profile_id) is replaced by an
-- identity `id` PK plus partial unique indexes per destination column, so
-- the same volunteer (by either representation) can't be added twice.
-- is_responsavel_for() and the join-table SELECT policies learn the
-- roster-based self-lookup (a linked volunteer sees demandas assigned to
-- their roster row).

alter table public.demanda_responsaveis
  add column voluntario_id bigint references public.voluntarios(id) on delete cascade;

alter table public.demanda_responsaveis
  drop constraint demanda_responsaveis_pkey;

alter table public.demanda_responsaveis
  add column id bigint generated always as identity primary key;

create unique index demanda_responsaveis_demanda_profile_key
  on public.demanda_responsaveis (demanda_id, profile_id)
  where profile_id is not null;

create unique index demanda_responsaveis_demanda_voluntario_key
  on public.demanda_responsaveis (demanda_id, voluntario_id)
  where voluntario_id is not null;

alter table public.demanda_responsaveis
  add constraint demanda_responsaveis_um_destino check (
    (profile_id is not null and voluntario_id is null)
    or (profile_id is null and voluntario_id is not null)
  );

alter table public.demanda_membros
  add column voluntario_id bigint references public.voluntarios(id) on delete cascade;

alter table public.demanda_membros
  drop constraint demanda_membros_pkey;

alter table public.demanda_membros
  add column id bigint generated always as identity primary key;

create unique index demanda_membros_demanda_profile_key
  on public.demanda_membros (demanda_id, profile_id)
  where profile_id is not null;

create unique index demanda_membros_demanda_voluntario_key
  on public.demanda_membros (demanda_id, voluntario_id)
  where voluntario_id is not null;

alter table public.demanda_membros
  add constraint demanda_membros_um_destino check (
    (profile_id is not null and voluntario_id is null)
    or (profile_id is null and voluntario_id is not null)
  );

-- is_responsavel_for: now ALSO true when the caller's linked roster row is
-- the assignment target (a volunteer without an account yet can still be
-- assigned, and sees the demanda once their account links the roster).
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
      and (
        profile_id = (select auth.uid())
        or voluntario_id = (
          select p.voluntario_id
          from public.profiles p
          where p.id = (select auth.uid())
        )
      )
  );
$$;

revoke execute on function public.is_responsavel_for(bigint) from public, anon;
grant execute on function public.is_responsavel_for(bigint) to authenticated;

-- Roster self-lookup for the join-table SELECT policies — a volunteer
-- linked to a roster row can see their own assignments. NULL-safe: a
-- profile without a link resolves to NULL, which never equals a row's
-- voluntario_id.
create or replace function public.meu_voluntario_id()
returns bigint
language sql
security definer
set search_path = ''
stable
as $$
  select p.voluntario_id
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke execute on function public.meu_voluntario_id() from public, anon;
grant execute on function public.meu_voluntario_id() to authenticated;

-- Rewrite the two join-table SELECT policies to include the roster-based
-- self-match. Manage policies already follow the parent demanda's edit
-- predicate (which flows through is_responsavel_for) — no change needed
-- there. Same treatment for the membros visibility policy.
drop policy "role-scoped demanda_responsaveis visibility" on public.demanda_responsaveis;
create policy "role-scoped demanda_responsaveis visibility"
  on public.demanda_responsaveis
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or voluntario_id = (select public.meu_voluntario_id())
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

drop policy "role-scoped membros visibility" on public.demanda_membros;
create policy "role-scoped membros visibility"
  on public.demanda_membros
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or voluntario_id = (select public.meu_voluntario_id())
    or exists (
      select 1 from public.demandas d
      where d.id = demanda_membros.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

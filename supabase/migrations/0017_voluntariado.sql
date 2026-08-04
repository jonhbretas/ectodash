-- supabase/migrations/0017_voluntariado.sql
-- Voluntariado: institutional roster decoupled from auth accounts, the
-- "link by name" self-signup flow, and the new `voluntariado` role
-- (enum values themselves live in 0016_roles_rename.sql — SQLSTATE 55P04
-- forbids using a newly-added enum value in the same transaction).
--
-- What changed (user decisions, 2026-08-04):
--   1. New table `public.voluntarios`: the institution's volunteer roster
--      (nome, codigo_pf, unidade, org_depto, funcao, data_inicio,
--      data_saida, obs, area_atuacao, role/areas_lideradas as *intended*
--      config). Roster rows exist WITHOUT auth accounts — a volunteer is
--      registered in the system before ever having access.
--   2. `profiles.voluntario_id` links a signed-in account to its roster
--      row; `profiles.vincular_pendente` flags new accounts that must
--      complete the "choose your name" flow (/vincular) on first sign-in.
--   3. Write paths are SECURITY DEFINER functions, NOT RLS write policies:
--      - voluntariado/coordenador_geral/coordenador_area manage the roster
--        through atualizar_voluntario()/criar_voluntario() (coordenador_area
--        scoped to their own áreas, never able to assign roles);
--      - the volunteer links their own account via
--        vincular_meu_cadastro()/criar_meu_cadastro() — self-only, capped
--        role application (never auto-grants coordenador_geral, never
--        downgrades an existing one);
--      - vincular search runs through buscar_voluntarios() (caller must
--        have vincular_pendente).
--   4. Profiles SELECT widens to voluntariado (any row) and to
--      coordenador_area (rows whose area_atuacao matches their lider_areas)
--      so roster screens can join email/full_name for linked accounts.
--      NO new profiles UPDATE policy exists — role changes remain
--      coordenador_geral-only (0002), closing the self-promotion shape
--      docs/roles.md warns about.
--   5. is_lider_of_area() is recreated for the renamed role value —
--      ALTER TYPE ... RENAME VALUE rewrites catalog references, but NOT
--      function bodies (stored as text).
-- Sources: 0002 has_role()/revoke-grant idiom [CITED: this repo];
-- 0004 is_lider_of_area() shape [CITED: this repo]; 0014 column-grant /
-- SECURITY DEFINER enforcement precedent [CITED: this repo]; project
-- skill: SECURITY DEFINER functions in public are callable by all roles —
-- every one below revokes from public/anon and grants to authenticated.

-- ---------------------------------------------------------------------------
-- Institutional roster (no auth dependency)
-- ---------------------------------------------------------------------------
create table public.voluntarios (
  id bigint generated always as identity primary key,
  nome text not null check (char_length(trim(nome)) > 0),
  codigo_pf text,
  unidade text,
  org_depto text,
  funcao text,
  data_inicio date,
  data_saida date,
  obs text,
  area_atuacao text,
  -- Intended role/áreas: applied to the linked account at link time (or by
  -- a coordenador_geral edit). Never grantable by the volunteer themselves.
  role public.app_role,
  areas_lideradas text[] not null default '{}',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- codigo_pf is the institution's stable key — unique where present.
create unique index voluntarios_codigo_pf_key
  on public.voluntarios (codigo_pf)
  where codigo_pf is not null;

-- Roster screens filter/group by área; the self-link flow searches by nome.
create index voluntarios_area_idx on public.voluntarios (area_atuacao);
create index voluntarios_nome_idx on public.voluntarios (nome);

alter table public.voluntarios enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: link + pending-flag columns (declared BEFORE the voluntarios
-- RLS policies below, which reference profiles.voluntario_id)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column voluntario_id bigint references public.voluntarios(id) on delete set null,
  add column vincular_pendente boolean not null default false;

-- One account per roster row; one roster row per account.
create unique index profiles_voluntario_id_key
  on public.profiles (voluntario_id)
  where voluntario_id is not null;

-- New accounts (every auth.users insert from now on) must complete the
-- "choose your name" flow before using the dashboard.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, vincular_pendente)
  values (new.id, new.email, true);
  return new;
end;
$$;

-- Same trigger convention as 0003/0007/0008.
create or replace function public.set_updated_at_voluntarios()
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

drop trigger if exists voluntarios_set_updated_at on public.voluntarios;
create trigger voluntarios_set_updated_at
  before update on public.voluntarios
  for each row execute function public.set_updated_at_voluntarios();

-- Roster visibility:
--   - a signed-in volunteer sees ONLY their own linked row (their /perfil);
--   - coordenador_geral and voluntariado see every row (full roster);
--   - coordenador_area sees rows of their own áreas (is_lider_of_area()).
-- No write policies at all — every write goes through the role-checked
-- SECURITY DEFINER functions below.
create policy "voluntarios self view"
  on public.voluntarios
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.voluntario_id = public.voluntarios.id
    )
  );

create policy "roster managers can view all voluntarios"
  on public.voluntarios
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
    or (area_atuacao is not null and (select public.is_lider_of_area(area_atuacao)))
  );

-- ---------------------------------------------------------------------------
-- Recreate is_lider_of_area() for the renamed role value — CREATE OR
-- REPLACE (same signature, updated body) keeps the policies from 0004
-- intact; a drop would cascade into them.
-- ---------------------------------------------------------------------------
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
      and p.role = 'coordenador_area'
      and lower(trim(la.area)) = lower(trim(target_area))
  );
$$;

revoke execute on function public.is_lider_of_area(text) from public, anon;
grant execute on function public.is_lider_of_area(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles SELECT for the roster screens' email/full_name join
-- ---------------------------------------------------------------------------
create policy "voluntariado and area coordenadores can view profiles"
  on public.profiles
  for select
  to authenticated
  using (
    (select public.has_role('voluntariado'))
    or (area_atuacao is not null and (select public.is_lider_of_area(area_atuacao)))
  );

-- ---------------------------------------------------------------------------
-- Self-service functions (vincular flow)
-- ---------------------------------------------------------------------------

-- Name search for the /vincular screen. Only callable while the caller's
-- account still has vincular_pendente — the roster search never outlives
-- the linking step, and never leaks rows already linked to another account.
create or replace function public.buscar_voluntarios(termo text)
returns table (cadastro_id bigint, nome text, unidade text, funcao text, area_atuacao text)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and vincular_pendente
  ) then
    return;
  end if;

  return query
    select v.id, v.nome, v.unidade, v.funcao, v.area_atuacao
    from public.voluntarios v
    where v.ativo
      and not exists (
        select 1 from public.profiles p where p.voluntario_id = v.id
      )
      and (termo = '' or v.nome ilike '%' || termo || '%')
    order by v.nome
    limit 20;
end;
$$;

-- Links the caller's account to an existing roster row: copies nome, área,
-- ativo and the INTENDED role (capped: coordenador_geral is never
-- auto-granted; an existing coordenador_geral is never downgraded), and
-- materializes lider_areas rows when the intended role is coordenador_area.
create or replace function public.vincular_meu_cadastro(cadastro_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.voluntarios%rowtype;
  me uuid := (select auth.uid());
  meu_role public.app_role;
begin
  if me is null then
    return false;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = me and vincular_pendente
  ) then
    return false;
  end if;

  select * into v_row from public.voluntarios where id = cadastro_id;
  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.profiles where voluntario_id = cadastro_id
  ) then
    return false;
  end if;

  select role into meu_role from public.profiles where id = me;

  if meu_role <> 'coordenador_geral' then
    meu_role := case
      when v_row.role in ('financeiro', 'voluntariado', 'coordenador_area', 'voluntario_comum')
        then v_row.role
      else 'voluntario_comum'
    end;
  end if;

  update public.profiles
    set voluntario_id = cadastro_id,
        vincular_pendente = false,
        full_name = v_row.nome,
        area_atuacao = v_row.area_atuacao,
        role = meu_role,
        ativo = v_row.ativo
    where id = me;

  if meu_role = 'coordenador_area' and cardinality(v_row.areas_lideradas) > 0 then
    insert into public.lider_areas (lider_id, area)
    select distinct me, unnest(v_row.areas_lideradas)
    on conflict do nothing;
  end if;

  return true;
end;
$$;

-- The volunteer who does not find their name: creates a fresh roster row
-- (nome only) and links the caller to it.
create or replace function public.criar_meu_cadastro(nome text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  novo_id bigint;
begin
  if me is null then
    return false;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = me and vincular_pendente
  ) then
    return false;
  end if;

  if trim(coalesce(nome, '')) = '' then
    return false;
  end if;

  insert into public.voluntarios (nome, ativo)
  values (trim(nome), true)
  returning id into novo_id;

  update public.profiles
    set voluntario_id = novo_id,
        vincular_pendente = false,
        full_name = trim(nome)
    where id = me;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Coordinator-side functions (roster management)
-- ---------------------------------------------------------------------------

-- Access gate shared by both coordinator functions: coordenador_geral and
-- voluntariado manage any row; coordenador_area manages only rows whose
-- área matches one of their lider_areas. Returns the caller's role.
create or replace function public.voluntario_manager_role(target_area text)
returns public.app_role
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  caller_role public.app_role;
begin
  select p.role into caller_role
  from public.profiles p
  where p.id = (select auth.uid());

  if caller_role is null then
    return null;
  end if;

  if caller_role in ('coordenador_geral', 'voluntariado') then
    return caller_role;
  end if;

  if caller_role = 'coordenador_area' and target_area is not null then
    if exists (
      select 1 from public.lider_areas la
      where la.lider_id = (select auth.uid())
        and lower(trim(la.area)) = lower(trim(target_area))
    ) then
      return caller_role;
    end if;
  end if;

  return null;
end;
$$;

-- Creates a roster row. coordenador_area callers are pinned to their own
-- área; non-coordenador_geral callers can never assign a role.
create or replace function public.criar_voluntario(
  nome text,
  codigo_pf text,
  unidade text,
  org_depto text,
  funcao text,
  data_inicio date,
  data_saida date,
  obs text,
  area_atuacao text,
  papel public.app_role,
  areas_lideradas text[]
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  manager public.app_role;
  effective_area text;
  effective_role public.app_role;
  novo_id bigint;
begin
  if me is null then
    return null;
  end if;

  if trim(coalesce(nome, '')) = '' then
    return null;
  end if;

  manager := public.voluntario_manager_role(area_atuacao);
  if manager is null then
    return null;
  end if;

  effective_area := nullif(trim(coalesce(area_atuacao, '')), '');
  if manager = 'coordenador_area' then
    effective_area := (
      select la.area from public.lider_areas la
      where la.lider_id = me
      order by la.created_at asc
      limit 1
    );
    effective_role := 'voluntario_comum';
  else
    effective_role := case
      when papel = 'coordenador_geral' then 'voluntario_comum'
      else papel
    end;
  end if;

  insert into public.voluntarios (
    nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida,
    obs, area_atuacao, role, areas_lideradas
  ) values (
    trim(nome),
    nullif(trim(coalesce(codigo_pf, '')), ''),
    nullif(trim(coalesce(unidade, '')), ''),
    nullif(trim(coalesce(org_depto, '')), ''),
    nullif(trim(coalesce(funcao, '')), ''),
    data_inicio,
    data_saida,
    nullif(trim(coalesce(obs, '')), ''),
    effective_area,
    effective_role,
    case when manager = 'coordenador_geral' then coalesce(areas_lideradas, '{}'::text[]) else '{}'::text[] end
  )
  returning id into novo_id;

  return novo_id;
end;
$$;

-- Updates a roster row (data fields always; role/áreas only for
-- coordenador_geral) and, when the row is linked to an account, syncs the
-- account's profile: full_name/area_atuacao/ativo always, role and
-- lider_areas (replace semantics) for coordenador_geral only.
create or replace function public.atualizar_voluntario(
  cadastro_id bigint,
  nome text,
  codigo_pf text,
  unidade text,
  org_depto text,
  funcao text,
  data_inicio date,
  data_saida date,
  obs text,
  area_atuacao text,
  papel public.app_role,
  areas_lideradas text[],
  ativo boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  manager public.app_role;
  target_area text;
  linked_profile uuid;
begin
  select area_atuacao
  into target_area
  from public.voluntarios
  where id = cadastro_id;

  if not found then
    return false;
  end if;

  manager := public.voluntario_manager_role(target_area);
  if manager is null then
    return false;
  end if;

  update public.voluntarios v
    set nome = trim(nome),
        codigo_pf = nullif(trim(coalesce(codigo_pf, '')), ''),
        unidade = nullif(trim(coalesce(unidade, '')), ''),
        org_depto = nullif(trim(coalesce(org_depto, '')), ''),
        funcao = nullif(trim(coalesce(funcao, '')), ''),
        data_inicio = data_inicio,
        data_saida = data_saida,
        obs = nullif(trim(coalesce(obs, '')), ''),
        area_atuacao = nullif(trim(coalesce(area_atuacao, '')), ''),
        role = case
          when manager = 'coordenador_geral' then papel
          else v.role
        end,
        areas_lideradas = case
          when manager = 'coordenador_geral' then coalesce(areas_lideradas, '{}'::text[])
          else v.areas_lideradas
        end,
        ativo = ativo
    where v.id = cadastro_id;

  select id into linked_profile
  from public.profiles
  where voluntario_id = cadastro_id;

  if linked_profile is not null then
    if manager = 'coordenador_geral' then
      update public.profiles
        set full_name = trim(nome),
            area_atuacao = nullif(trim(coalesce(area_atuacao, '')), ''),
            role = papel,
            ativo = ativo
        where id = linked_profile;

      delete from public.lider_areas where lider_id = linked_profile;
      if papel = 'coordenador_area' then
        insert into public.lider_areas (lider_id, area)
        select distinct linked_profile, unnest(coalesce(areas_lideradas, '{}'::text[]));
      end if;
    else
      update public.profiles
        set full_name = trim(nome),
            area_atuacao = nullif(trim(coalesce(area_atuacao, '')), ''),
            ativo = ativo
        where id = linked_profile;
    end if;
  end if;

  return true;
end;
$$;

revoke execute on function public.buscar_voluntarios(text) from public, anon;
grant execute on function public.buscar_voluntarios(text) to authenticated;

revoke execute on function public.vincular_meu_cadastro(bigint) from public, anon;
grant execute on function public.vincular_meu_cadastro(bigint) to authenticated;

revoke execute on function public.criar_meu_cadastro(text) from public, anon;
grant execute on function public.criar_meu_cadastro(text) to authenticated;

revoke execute on function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[]) from public, anon;
grant execute on function public.criar_voluntario(text, text, text, text, text, date, date, text, text, public.app_role, text[]) to authenticated;

revoke execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean) from public, anon;
grant execute on function public.atualizar_voluntario(bigint, text, text, text, text, text, date, date, text, text, public.app_role, text[], boolean) to authenticated;

revoke execute on function public.voluntario_manager_role(text) from public, anon;
grant execute on function public.voluntario_manager_role(text) to authenticated;

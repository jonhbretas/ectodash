-- supabase/migrations/0012_trello_features.sql
-- Trello-style demandas features (user decision, 2026-08-04):
--   1. etiquetas — labels ALWAYS scoped to an área ("etiqueta seria a
--      própria área ou uma sub-etiqueta dentro da área", e.g. Comunicação,
--      Vendas, Artes). Unique per (area, nome); demandas.etiqueta_id links
--      one label per demanda.
--   2. demanda_checklist — per-demanda checklist items with a concluded
--      flag (the card shows progress like "2/5").
--   3. demanda_membros — acompanhantes: volunteers who follow a demanda
--      and receive the same email reminders as responsáveis.
--   4. demanda_comentarios — comments on a demanda; anyone who can see the
--      demanda can comment, and @mentions trigger an instant email to the
--      mentioned volunteer (user decision, 2026-08-04).
-- RLS: checklist and membros visibility/manageability follow the parent
-- demanda's own scoping (same subquery pattern as demanda_responsaveis,
-- migration 0004); etiquetas are read by all and created by any volunteer
-- (they're collaborative tags), edited/removed by creator or coordinator.
-- Sources: 0004 role-scoped join-table idiom [CITED: this repo]; 0003
-- demandas conventions [CITED: this repo].

create table public.etiquetas (
  id bigint generated always as identity primary key,
  area text not null check (char_length(trim(area)) > 0),
  nome text not null check (char_length(trim(nome)) > 0),
  cor text not null default '#1D4ED8',
  criado_por uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (area, nome)
);

create index etiquetas_area_idx on public.etiquetas (area);

alter table public.demandas
  add column etiqueta_id bigint references public.etiquetas(id) on delete set null;

create index demandas_etiqueta_id_idx on public.demandas (etiqueta_id);

create table public.demanda_checklist (
  id bigint generated always as identity primary key,
  demanda_id bigint not null references public.demandas(id) on delete cascade,
  item text not null check (char_length(trim(item)) > 0),
  concluido boolean not null default false,
  criado_por uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index demanda_checklist_demanda_id_idx on public.demanda_checklist (demanda_id);

create table public.demanda_membros (
  demanda_id bigint not null references public.demandas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (demanda_id, profile_id)
);

create index demanda_membros_profile_id_idx on public.demanda_membros (profile_id);

create table public.demanda_comentarios (
  id bigint generated always as identity primary key,
  demanda_id bigint not null references public.demandas(id) on delete cascade,
  autor_id uuid not null references public.profiles(id) default auth.uid(),
  conteudo text not null check (char_length(trim(conteudo)) > 0),
  created_at timestamptz not null default now()
);

create index demanda_comentarios_demanda_id_idx on public.demanda_comentarios (demanda_id);

-- Recreate the view again (its column list is fixed at creation time).
drop view public.demandas_com_status;
create view public.demandas_com_status
with (security_invoker = true) as
select
  d.*,
  (d.prazo < current_date and d.status <> 'concluida') as atrasada
from public.demandas d;

alter table public.etiquetas enable row level security;
alter table public.demanda_checklist enable row level security;
alter table public.demanda_membros enable row level security;
alter table public.demanda_comentarios enable row level security;

create policy "authenticated users can view etiquetas"
  on public.etiquetas
  for select
  to authenticated
  using (true);

-- Any volunteer can create a label — but always bound to an área (the
-- CHECK on area enforces non-empty; the (area, nome) unique enforces
-- no-duplicate labels inside the same área).
create policy "authenticated users can create etiquetas"
  on public.etiquetas
  for insert
  to authenticated
  with check (criado_por = (select auth.uid()));

create policy "creator or coordinator can update etiquetas"
  on public.etiquetas
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

create policy "creator or coordinator can delete etiquetas"
  on public.etiquetas
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

-- Checklist visibility: same rule as the parent demanda (0004's pattern).
create policy "role-scoped checklist visibility"
  on public.demanda_checklist
  for select
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_checklist.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

-- Checklist writes follow the demanda's EDIT predicate (0004 idiom).
create policy "role-scoped checklist manage"
  on public.demanda_checklist
  for all
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_checklist.demanda_id
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
      where d.id = demanda_checklist.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

-- Membros: read = own membership OR demanda-visible (same scoping).
create policy "role-scoped membros visibility"
  on public.demanda_membros
  for select
  to authenticated
  using (
    profile_id = (select auth.uid())
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

-- Membros writes follow the demanda's EDIT predicate, like responsáveis.
create policy "role-scoped membros manage"
  on public.demanda_membros
  for all
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_membros.demanda_id
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
      where d.id = demanda_membros.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

-- Comments: anyone who can SEE the demanda can comment (collaborative
-- discussion surface) — same visibility predicate as the checklist, used
-- for both select and insert; no update/delete policy in this pass (a
-- comment is an immutable record, matching the dedup-log precedent).
create policy "role-scoped comentarios visibility"
  on public.demanda_comentarios
  for select
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_comentarios.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

create policy "role-scoped comentarios create"
  on public.demanda_comentarios
  for insert
  to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.demandas d
      where d.id = demanda_comentarios.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

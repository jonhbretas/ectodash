-- Demandas institucionais ou confidenciais da Coordenação Geral.
-- A coluna é a fronteira de dados: RLS bloqueia leitura, alteração e
-- vínculos por pessoas fora da coordenação, mesmo via chamadas diretas à API.
alter table public.demandas
  add column if not exists restrita_coordenacao_geral boolean not null default false;

create index if not exists demandas_restrita_coordenacao_geral_prazo_idx
  on public.demandas (prazo)
  where restrita_coordenacao_geral = true;

-- A view usa d.*; recriá-la inclui a nova coluna em sua lista materializada
-- de atributos e preserva security_invoker para que RLS continue valendo.
drop view if exists public.demandas_com_status;
create view public.demandas_com_status
with (security_invoker = true) as
select
  d.*,
  (d.prazo < current_date and d.status <> 'concluida') as atrasada
from public.demandas d;

drop policy if exists "authenticated users can create demandas" on public.demandas;
create policy "authenticated users can create demandas"
  on public.demandas for insert to authenticated
  with check (
    criado_por = (select auth.uid())
    and (not restrita_coordenacao_geral or (select public.has_role('coordenador_geral')))
  );

-- A RLS da demanda pai passa a ser a fonte de verdade de todos os vínculos.
drop policy if exists "role-scoped demandas visibility" on public.demandas;
create policy "role-scoped demandas visibility"
  on public.demandas for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (not restrita_coordenacao_geral and (
      (area is not null and (select public.is_lider_of_area(area)))
      or (area_id is not null and (select public.coordena_area(area_id)))
      or criado_por = (select auth.uid())
      or (select public.is_responsavel_for(id))
    ))
  );

drop policy if exists "role-scoped demandas edit" on public.demandas;
create policy "role-scoped demandas edit"
  on public.demandas for update to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (not restrita_coordenacao_geral and (
      (area is not null and (select public.is_lider_of_area(area)))
      or (area_id is not null and (select public.coordena_area(area_id)))
      or criado_por = (select auth.uid())
      or (select public.is_responsavel_for(id))
    ))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (not restrita_coordenacao_geral and (
      (area is not null and (select public.is_lider_of_area(area)))
      or (area_id is not null and (select public.coordena_area(area_id)))
      or criado_por = (select auth.uid())
      or (select public.is_responsavel_for(id))
    ))
  );

drop policy if exists "role-scoped demandas delete" on public.demandas;
create policy "role-scoped demandas delete"
  on public.demandas for delete to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (not restrita_coordenacao_geral and (
      (area is not null and (select public.is_lider_of_area(area)))
      or (area_id is not null and (select public.coordena_area(area_id)))
      or criado_por = (select auth.uid())
      or (select public.is_responsavel_for(id))
    ))
  );

drop policy if exists "role-scoped demanda_responsaveis visibility" on public.demanda_responsaveis;
create policy "role-scoped demanda_responsaveis visibility"
  on public.demanda_responsaveis for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));

drop policy if exists "role-scoped demanda_responsaveis manage" on public.demanda_responsaveis;
create policy "role-scoped demanda_responsaveis manage"
  on public.demanda_responsaveis for all to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id))
  with check (exists (select 1 from public.demandas d where d.id = demanda_id));

drop policy if exists "role-scoped membros visibility" on public.demanda_membros;
create policy "role-scoped membros visibility"
  on public.demanda_membros for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));

drop policy if exists "role-scoped membros manage" on public.demanda_membros;
create policy "role-scoped membros manage"
  on public.demanda_membros for all to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id))
  with check (exists (select 1 from public.demandas d where d.id = demanda_id));

drop policy if exists "role-scoped checklist visibility" on public.demanda_checklist;
create policy "role-scoped checklist visibility"
  on public.demanda_checklist for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));

drop policy if exists "role-scoped checklist manage" on public.demanda_checklist;
create policy "role-scoped checklist manage"
  on public.demanda_checklist for all to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id))
  with check (exists (select 1 from public.demandas d where d.id = demanda_id));

drop policy if exists "role-scoped comentarios visibility" on public.demanda_comentarios;
create policy "role-scoped comentarios visibility"
  on public.demanda_comentarios for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));

drop policy if exists "role-scoped comentarios create" on public.demanda_comentarios;
create policy "role-scoped comentarios create"
  on public.demanda_comentarios for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.demandas d where d.id = demanda_id)
  );

drop policy if exists "role-scoped comentarios delete" on public.demanda_comentarios;
create policy "role-scoped comentarios delete"
  on public.demanda_comentarios for delete to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));

drop policy if exists "role-scoped reminder log delete" on public.demanda_reminders_log;
create policy "role-scoped reminder log delete"
  on public.demanda_reminders_log for delete to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));

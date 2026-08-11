-- supabase/migrations/0053_delete_policies_demandas.sql
-- Habilita exclusão de demandas (UI de seleção em massa):
-- 1. policy de DELETE em demandas — mesmo predicado da edição role-scoped
--    (0004): coordenador geral, líder da área, criador ou responsável.
-- 2. policy de DELETE em demanda_comentarios — o ON DELETE CASCADE de
--    demandas dispara DELETEs nessas tabelas filhas, e o RLS é aplicado
--    em cascata: sem policy de DELETE, o cascade é barrado.
-- 3. policy de DELETE em demanda_reminders_log — idem (0005 só criou
--    policy de SELECT para o coordenador geral).

create policy "role-scoped demandas delete"
  on public.demandas
  for delete
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (area is not null and (select public.is_lider_of_area(area)))
    or criado_por = (select auth.uid())
    or (select public.is_responsavel_for(id))
  );

create policy "role-scoped comentarios delete"
  on public.demanda_comentarios
  for delete
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

create policy "role-scoped reminder log delete"
  on public.demanda_reminders_log
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.demandas d
      where d.id = demanda_reminders_log.demanda_id
        and (
          (select public.has_role('coordenador_geral'))
          or (d.area is not null and (select public.is_lider_of_area(d.area)))
          or d.criado_por = (select auth.uid())
          or (select public.is_responsavel_for(d.id))
        )
    )
  );

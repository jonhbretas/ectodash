-- supabase/migrations/0037_proep_edition_id_bigint.sql
-- Alinha o schema de produção com a migration 0033 (que define edition_id
-- como bigint referenciando eventos(id)).
--
-- Em produção as tabelas proep_* foram criadas com edition_id uuid
-- apontando para uma tabela proep_editions (vazia e não usada pelo app),
-- enquanto o app envia o id numérico do evento (eventos.id é bigint).
-- Resultado: erro "invalid input syntax for type uuid: '18'" ao inserir.
--
-- Como todas as tabelas estavam vazias, basta trocar o tipo e re-apontar
-- a FK para eventos(id). O bloco DO é idempotente (dropa FKs existentes
-- primeiro), seguro para re-execução.

do $$
declare
  t text;
  fk_name text;
begin
  foreach t in array array['proep_students','proep_materials','proep_checklist','proep_assignments','proep_progression'] loop
    for fk_name in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
      where ns.nspname = 'public' and rel.relname = t and con.contype = 'f'
    loop
      execute format('alter table public.%I drop constraint %I', t, fk_name);
    end loop;
    execute format('alter table public.%I alter column edition_id type bigint using null', t);
    execute format('alter table public.%I add constraint %I foreign key (edition_id) references public.eventos(id) on delete cascade', t, t || '_edition_id_fkey');
  end loop;
end $$;

-- As policies RLS da migration 0033 também nunca foram aplicadas em
-- produção (o schema foi criado manualmente). Recriá-las aqui torna a
-- migration re-executável: dropa se existir e recria.

drop policy if exists "authenticated can view proep_students" on public.proep_students;
drop policy if exists "authenticated can manage proep_students" on public.proep_students;
drop policy if exists "authenticated can view proep_materials" on public.proep_materials;
drop policy if exists "authenticated can manage proep_materials" on public.proep_materials;
drop policy if exists "authenticated can view proep_checklist" on public.proep_checklist;
drop policy if exists "authenticated can manage proep_checklist" on public.proep_checklist;
drop policy if exists "authenticated can view proep_assignments" on public.proep_assignments;
drop policy if exists "authenticated can manage proep_assignments" on public.proep_assignments;
drop policy if exists "authenticated can view proep_progression" on public.proep_progression;
drop policy if exists "authenticated can manage proep_progression" on public.proep_progression;

create policy "authenticated can view proep_students" on public.proep_students for select to authenticated using (true);
create policy "authenticated can manage proep_students" on public.proep_students for all to authenticated using (true) with check (true);

create policy "authenticated can view proep_materials" on public.proep_materials for select to authenticated using (true);
create policy "authenticated can manage proep_materials" on public.proep_materials for all to authenticated using (true) with check (true);

create policy "authenticated can view proep_checklist" on public.proep_checklist for select to authenticated using (true);
create policy "authenticated can manage proep_checklist" on public.proep_checklist for all to authenticated using (true) with check (true);

create policy "authenticated can view proep_assignments" on public.proep_assignments for select to authenticated using (true);
create policy "authenticated can manage proep_assignments" on public.proep_assignments for all to authenticated using (true) with check (true);

create policy "authenticated can view proep_progression" on public.proep_progression for select to authenticated using (true);
create policy "authenticated can manage proep_progression" on public.proep_progression for all to authenticated using (true) with check (true);

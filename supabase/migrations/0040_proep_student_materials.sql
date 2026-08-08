-- supabase/migrations/0040_proep_student_materials.sql
-- Materiais clonados por aluno (uma linha por template clonado).
-- Permite clonar N templates por aluno (ex.: vários arquivos de uma pasta)
-- e mostra os links individuais no card do aluno.

create table public.proep_student_materials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.proep_students(id) on delete cascade,
  material_id uuid not null references public.proep_materials(id) on delete cascade,
  drive_url text not null,
  created_at timestamptz not null default now()
);

create index idx_proep_student_materials_student on public.proep_student_materials(student_id);

alter table public.proep_student_materials enable row level security;

create policy "authenticated can view proep_student_materials"
  on public.proep_student_materials for select to authenticated using (true);

create policy "authenticated can manage proep_student_materials"
  on public.proep_student_materials for all to authenticated using (true) with check (true);

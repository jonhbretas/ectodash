-- supabase/migrations/0033_proep.sql
-- PROEP — Programa de Estimulação Parapsíquica Ectoplásmica
--
-- As turmas são eventos do sistema (eventos) cujo título contém "PROEP".
-- As demais tabelas referenciam o ID do evento como "edition_id".

create table public.proep_students (
  id uuid primary key default gen_random_uuid(),
  edition_id bigint not null references public.eventos(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role text not null default 'participant',
  drive_folder_url text,
  planilha_url text,
  parapercepciograma_url text,
  form_responder_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.proep_materials (
  id uuid primary key default gen_random_uuid(),
  edition_id bigint references public.eventos(id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  url text,
  file_id text,
  file_type text,
  is_template boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.proep_checklist (
  id uuid primary key default gen_random_uuid(),
  edition_id bigint not null references public.eventos(id) on delete cascade,
  day_number int not null,
  phase text not null default 'before',
  title text not null,
  description text,
  done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.proep_assignments (
  id uuid primary key default gen_random_uuid(),
  edition_id bigint not null references public.eventos(id) on delete cascade,
  role text not null,
  title text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.proep_progression (
  id uuid primary key default gen_random_uuid(),
  edition_id bigint references public.eventos(id) on delete cascade,
  from_role text not null,
  to_role text not null,
  requirements text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_proep_students_edition on public.proep_students(edition_id);
create index idx_proep_materials_edition on public.proep_materials(edition_id);
create index idx_proep_checklist_edition on public.proep_checklist(edition_id);
create index idx_proep_assignments_edition on public.proep_assignments(edition_id);

-- RLS: authenticated users can read/write all PROEP data
alter table public.proep_students enable row level security;
alter table public.proep_materials enable row level security;
alter table public.proep_checklist enable row level security;
alter table public.proep_assignments enable row level security;
alter table public.proep_progression enable row level security;

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

-- Updated_at trigger for proep_students
create or replace function public.set_updated_at_proep_students()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;

drop trigger if exists proep_students_set_updated_at on public.proep_students;
create trigger proep_students_set_updated_at
  before update on public.proep_students
  for each row execute function public.set_updated_at_proep_students();

-- supabase/migrations/0027_voluntario_areas.sql
-- Múltiplas áreas de atuação por voluntário.
--
-- voluntario_areas — áreas ADICIONAIS além da principal (voluntarios
-- .area_atuacao continua sendo a área primária usada no agrupamento, RLS
-- e gestão). Permite classificar quem é somente DIP vs DIP + áreas
-- institucionais. RLS: SELECT aberto; escrita para coordenador_geral /
-- voluntariado ou coordenador de área (is_lider_of_area) — os mesmos que
-- já podem editar o cadastro.
-- Sources: 0026_situacao_atividades.sql self-service shape [CITED: this
-- repo]; 0004 is_lider_of_area() [CITED: this repo].

create table public.voluntario_areas (
  voluntario_id bigint not null references public.voluntarios(id) on delete cascade,
  area text not null check (char_length(trim(area)) > 0),
  created_at timestamptz not null default now(),
  primary key (voluntario_id, area)
);

create index voluntario_areas_voluntario_idx on public.voluntario_areas (voluntario_id);

alter table public.voluntario_areas enable row level security;

create policy "authenticated users can view all voluntario areas"
  on public.voluntario_areas
  for select
  to authenticated
  using (true);

create policy "coordinators can insert voluntario areas"
  on public.voluntario_areas
  for insert
  to authenticated
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
    or (area is not null and (select public.is_lider_of_area(area)))
  );

create policy "coordinators can update voluntario areas"
  on public.voluntario_areas
  for update
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
    or (area is not null and (select public.is_lider_of_area(area)))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
    or (area is not null and (select public.is_lider_of_area(area)))
  );

create policy "coordinators can delete voluntario areas"
  on public.voluntario_areas
  for delete
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
    or (area is not null and (select public.is_lider_of_area(area)))
  );

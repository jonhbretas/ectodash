-- supabase/migrations/0011_evento_modelos.sql
-- Event management model (user decision, 2026-08-04): an event works like
-- a project — it can carry 100-150 tasks (demandas) linked via
-- eventos.id -> demandas.evento_id (migration 0008). Events are typed
-- ("Evento de campo", "Evento online", "Live", ...), and each tipo carries
-- a task TEMPLATE (modelo_tarefas) that the event screen can materialize
-- into real demandas with one click ("Adicionar tarefas do evento").
--
-- Templates are institution configuration: read by every authenticated
-- volunteer (they drive task creation), written ONLY by coordenador_geral
-- via the models configuration screen.
-- Sources: 0008_eventos conventions [CITED: this repo]; 0002 has_role()
-- precedent [CITED: this repo].

create table public.evento_tipos (
  id bigint generated always as identity primary key,
  nome text not null unique check (char_length(trim(nome)) > 0),
  created_at timestamptz not null default now()
);

-- One row per template task. area is optional: a template task can belong
-- to a specific área ("por área específica"), or leave it null for
-- generic tasks. prazo_offset_dias shifts the created demanda's prazo
-- relative to the event date (0 = same day, negative = days before).
create table public.modelo_tarefas (
  id bigint generated always as identity primary key,
  tipo_id bigint not null references public.evento_tipos(id) on delete cascade,
  area text,
  titulo text not null check (char_length(trim(titulo)) > 0),
  prazo_offset_dias integer not null default 0,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index modelo_tarefas_tipo_id_idx on public.modelo_tarefas (tipo_id);

alter table public.eventos
  add column tipo_evento_id bigint references public.evento_tipos(id) on delete set null;

create index eventos_tipo_evento_id_idx on public.eventos (tipo_evento_id);

alter table public.evento_tipos enable row level security;
alter table public.modelo_tarefas enable row level security;

create policy "authenticated users can view evento tipos"
  on public.evento_tipos
  for select
  to authenticated
  using (true);

create policy "authenticated users can view modelo tarefas"
  on public.modelo_tarefas
  for select
  to authenticated
  using (true);

-- Template configuration is coordinator-only — same shape as the
-- profiles.role and lider_areas coordinator-management precedent.
create policy "coordinator manages evento tipos"
  on public.evento_tipos
  for all
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create policy "coordinator manages modelo tarefas"
  on public.modelo_tarefas
  for all
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

-- Starter types + placeholder template tasks so the event-management flow
-- works end to end. The real task lists per área/type are configured by
-- the coordinator via the models screen (user will supply them).
insert into public.evento_tipos (nome) values
  ('Evento de campo'),
  ('Evento online'),
  ('Live');

insert into public.modelo_tarefas (tipo_id, area, titulo, prazo_offset_dias, ordem)
select t.id, m.area, m.titulo, m.offset_dias, m.ordem
from (values
  ('Evento de campo', 'Infraestrutura', 'Confirmar local e liberação do espaço', -21, 1),
  ('Evento de campo', 'Infraestrutura', 'Verificar equipamentos de som e tenda', -14, 2),
  ('Evento de campo', 'Divulgação', 'Publicar convite nas redes sociais', -14, 3),
  ('Evento de campo', 'Logística', 'Organizar transporte e materiais', -7, 4),
  ('Evento de campo', 'Equipe', 'Definir escala de voluntários do dia', -7, 5),
  ('Evento de campo', 'Logística', 'Montagem do espaço no dia do evento', 0, 6),
  ('Evento de campo', 'Equipe', 'Registrar presença e fotos do evento', 0, 7),
  ('Evento de campo', 'Equipe', 'Enviar relatório pós-evento', 3, 8),
  ('Evento online', 'Infraestrutura', 'Configurar plataforma e link da transmissão', -14, 1),
  ('Evento online', 'Divulgação', 'Criar página de inscrição e divulgar', -14, 2),
  ('Evento online', 'Logística', 'Testar áudio e vídeo com palestrantes', -3, 3),
  ('Evento online', 'Equipe', 'Moderar chat e recepção durante a live', 0, 4),
  ('Evento online', 'Equipe', 'Enviar gravação e certificados aos participantes', 2, 5),
  ('Live', 'Divulgação', 'Anunciar data e horário da live', -7, 1),
  ('Live', 'Infraestrutura', 'Preparar roteiro e testes de transmissão', -2, 2),
  ('Live', 'Equipe', 'Apresentar e interagir com o público', 0, 3),
  ('Live', 'Equipe', 'Publicar o replay e resumo da live', 1, 4)
) as m(tipo_nome, area, titulo, offset_dias, ordem)
join public.evento_tipos t on t.nome = m.tipo_nome;

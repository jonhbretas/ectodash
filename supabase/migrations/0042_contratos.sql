-- supabase/migrations/0042_contratos.sql
-- Módulo de Contratos: modelos padronizados com variáveis, contratos gerados
-- por aluno/evento, integração com Google Drive (pastas automáticas) e com a
-- API de assinatura Assinafy (envio, signatários e webhook de retorno).
--
-- Estrutura de pastas no Drive:
--   Contratos Ectolab (central)/
--     {título do evento}/           ← 1 pasta por evento (ou "Avulsos")
--       {nome do aluno}/            ← 1 pasta por contrato, PDFs dentro
--
-- contrato_settings: chave/valor globais (pasta central, pasta de avulsos).
-- contrato_evento_pastas: pasta do Drive por evento.
-- contrato_webhook_log: dedup de eventos recebidos do webhook da Assinafy
-- (a API não assina o payload; o id do evento + account_id são a verificação).

create type public.contrato_status as enum (
  'gerado',
  'assinando',
  'assinado',
  'recusado',
  'cancelado'
);

create table public.contrato_modelos (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(trim(titulo)) > 0),
  categoria text not null check (char_length(trim(categoria)) > 0),
  descricao text,
  conteudo text not null check (char_length(trim(conteudo)) > 0),
  ativo boolean not null default true,
  criado_por uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contratos (
  id bigint generated always as identity primary key,
  modelo_id bigint not null references public.contrato_modelos(id),
  evento_id bigint references public.eventos(id),
  aluno_nome text not null check (char_length(trim(aluno_nome)) > 0),
  aluno_email text,
  aluno_documento text,
  aluno_telefone text,
  valor numeric(10, 2),
  status public.contrato_status not null default 'gerado',
  drive_pasta_id text,
  drive_pasta_url text,
  drive_arquivo_id text,
  drive_arquivo_url text,
  drive_assinado_id text,
  drive_assinado_url text,
  assinafy_document_id text,
  assinafy_assignment_id text,
  criado_por uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contrato_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table public.contrato_evento_pastas (
  evento_id bigint primary key references public.eventos(id) on delete cascade,
  drive_folder_id text,
  drive_folder_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contrato_webhook_log (
  id bigint primary key,
  event text not null,
  account_id text,
  payload jsonb,
  received_at timestamptz not null default now()
);

create index contratos_modelo_id_idx on public.contratos (modelo_id);
create index contratos_evento_id_idx on public.contratos (evento_id);
create index contratos_status_idx on public.contratos (status);
create index contratos_criado_por_idx on public.contratos (criado_por);
create index contrato_modelos_criado_por_idx on public.contrato_modelos (criado_por);

alter table public.contrato_modelos enable row level security;
alter table public.contratos enable row level security;
alter table public.contrato_settings enable row level security;
alter table public.contrato_evento_pastas enable row level security;
alter table public.contrato_webhook_log enable row level security;

-- Modelos: leitura para todos os autenticados (necessário para a tela de
-- novo contrato e para o download do PDF); escrita só do criador ou do
-- coordenador geral.
create policy "authenticated users can view contrato_modelos"
  on public.contrato_modelos
  for select
  to authenticated
  using (true);

create policy "creator or coordinator can create contrato_modelos"
  on public.contrato_modelos
  for insert
  to authenticated
  with check (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

create policy "creator or coordinator can update contrato_modelos"
  on public.contrato_modelos
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

create policy "creator or coordinator can delete contrato_modelos"
  on public.contrato_modelos
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

-- Contratos: contêm dados pessoais de alunos — leitura e escrita restritas
-- ao criador ou ao coordenador geral. As policies de SELECT/UPDATE são
-- byte-idênticas (o UPDATE só é alcançável quando o SELECT deixa passar).
create policy "creator or coordinator can view contratos"
  on public.contratos
  for select
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

create policy "creator or coordinator can create contratos"
  on public.contratos
  for insert
  to authenticated
  with check (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

create policy "creator or coordinator can update contratos"
  on public.contratos
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

create policy "creator or coordinator can delete contratos"
  on public.contratos
  for delete
  to authenticated
  using (
    criado_por = (select auth.uid())
    or (select public.has_role('coordenador_geral'))
  );

-- Pastas/config: qualquer autenticado lê e gerencia (mesmo padrão do PROEP).
create policy "authenticated can view contrato_settings"
  on public.contrato_settings
  for select
  to authenticated
  using (true);

create policy "authenticated can manage contrato_settings"
  on public.contrato_settings
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated can view contrato_evento_pastas"
  on public.contrato_evento_pastas
  for select
  to authenticated
  using (true);

create policy "authenticated can manage contrato_evento_pastas"
  on public.contrato_evento_pastas
  for all
  to authenticated
  using (true)
  with check (true);

-- contrato_webhook_log: sem policies — escrito apenas pela rota de webhook
-- via service role (sem sessão de usuário, como /api/cron/*).

create trigger contrato_modelos_set_updated_at
  before update on public.contrato_modelos
  for each row
  execute function public.set_updated_at();

create trigger contratos_set_updated_at
  before update on public.contratos
  for each row
  execute function public.set_updated_at();

create trigger contrato_settings_set_updated_at
  before update on public.contrato_settings
  for each row
  execute function public.set_updated_at();

create trigger contrato_evento_pastas_set_updated_at
  before update on public.contrato_evento_pastas
  for each row
  execute function public.set_updated_at();

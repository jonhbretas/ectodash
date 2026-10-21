-- supabase/migrations/20261021190000_contrato_formularios.sql
-- Formulário público de contrato: o coordenador gera um link por
-- modelo/evento (painel.ectolab.org/contrato/<token>); o aluno preenche os
-- próprios dados, confere e confirma; o sistema cria o contrato e envia para
-- assinatura na Assinafy (ou deixa aguardando aprovação do coordenador).
--
-- Travas contra contrato duplicado / gasto de cota:
--   • 1 resposta ativa por CPF e por e-mail em cada formulário (índices
--     únicos parciais — também protegem contra duplo clique simultâneo);
--   • limite de respostas e data de expiração por formulário;
--   • ip_hash para limitar envios por origem (rate limit na action).
-- A página pública acessa estas tabelas só pelo servidor (service role);
-- anon não tem nenhuma policy.

create table public.contrato_formularios (
  id bigint generated always as identity primary key,
  token text not null unique check (char_length(token) >= 16),
  modelo_id bigint not null references public.contrato_modelos(id),
  evento_id bigint references public.eventos(id) on delete set null,
  titulo text not null check (char_length(trim(titulo)) > 0),
  instrucoes text,
  ativo boolean not null default true,
  expira_em date,
  limite_respostas integer not null default 100 check (limite_respostas between 1 and 1000),
  envio_automatico boolean not null default true,
  prazo_assinatura_dias integer not null default 15 check (prazo_assinatura_dias between 1 and 90),
  criado_por uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contrato_formulario_respostas (
  id bigint generated always as identity primary key,
  formulario_id bigint not null references public.contrato_formularios(id) on delete cascade,
  contrato_id bigint references public.contratos(id) on delete set null,
  status text not null default 'recebido'
    check (status in ('recebido', 'aguardando_aprovacao', 'enviado', 'erro_envio', 'cancelado')),
  erro text,
  aluno_nome text not null,
  aluno_email text not null,
  aluno_cpf text not null,
  aluno_telefone text,
  aluno_rg text,
  aluno_nascimento date,
  aluno_endereco text,
  aluno_nacionalidade text,
  aluno_estado_civil text,
  aluno_profissao text,
  consentimento_em timestamptz not null,
  ip_hash text,
  user_agent text,
  reenviado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index contrato_formulario_respostas_cpf_uniq
  on public.contrato_formulario_respostas (formulario_id, aluno_cpf)
  where status <> 'cancelado';
create unique index contrato_formulario_respostas_email_uniq
  on public.contrato_formulario_respostas (formulario_id, lower(aluno_email))
  where status <> 'cancelado';
create index contrato_formulario_respostas_ip_idx
  on public.contrato_formulario_respostas (formulario_id, ip_hash, created_at);
create index contrato_formulario_respostas_contrato_idx
  on public.contrato_formulario_respostas (contrato_id);
create index contrato_formularios_modelo_idx on public.contrato_formularios (modelo_id);
create index contrato_formularios_evento_idx on public.contrato_formularios (evento_id);
create index contrato_formularios_criado_por_idx on public.contrato_formularios (criado_por);

-- Reenvio do e-mail de assinatura sem criar documento novo.
alter table public.contratos add column assinafy_signer_id text;

alter table public.contrato_formularios enable row level security;
alter table public.contrato_formulario_respostas enable row level security;

create policy "coordinator manages contrato_formularios"
  on public.contrato_formularios
  for all
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create policy "coordinator manages contrato_formulario_respostas"
  on public.contrato_formulario_respostas
  for all
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

-- Envios feitos pelo formulário público rodam sem sessão (service role):
-- enviado_por passa a aceitar o criador do formulário explicitamente e o
-- default auth.uid() continua valendo para envios com sessão.

-- supabase/migrations/0095_ouvidoria.sql
-- Ouvidoria / compliance dos voluntários ("caixinha de Pandora"):
-- espaço de escuta anônima focado em sentimentos para reciclagem
-- institucional (coordenação geral, coordenação diária, convivência
-- entre voluntários, vivências).
--
-- Decisões (respostas do usuário):
--   1. Leitura dos relatos anonimizados = SÓ colegiado gestor
--      (coordenador_geral + coordenador_area + cargos de coordenação).
--   2. Ciclo mensal LACRADO: relatos ficam invisíveis até a abertura
--      mensal pelo colegiado; depois de aberto, leitura anonimizada.
--   3. Quebra de sigilo = SÓ coordenador_geral, com motivo obrigatório
--      e log append-only auditável.
--
-- Privacidade por construção (RLS não esconde coluna, só linha):
--   - ouvidoria_relatos NÃO tem NENHUMA policy de SELECT/INSERT/
--     UPDATE/DELETE para authenticated → acesso direto pela Data API
--     é sempre negado, então author_id nunca vaza por SELECT *.
--   - Todo acesso passa por funções SECURITY DEFINER com check de
--     auth.uid() no corpo (mesmo idiom de meus_cargos/
--     criar_voluntario em 0043): enviar, meus envios, listagem
--     anonimizada (sem author_id), abrir/concluir ciclo, atualizar
--     status/nota, quebra de sigilo.
--   - ouvidoria_ciclos tem SELECT liberado para authenticated
--     (só referência/status/datas — nada sensível) para o voluntário
--     ver se a caixinha do mês está lacrada ou aberta.
--   - ouvidoria_quebra_log: leitura só coordenador_geral; escrita só
--     via função (sem policy de escrita).
--   - Audit trail reutiliza registrar_audit() de 0059 (leitura do
--     audit_log é só coordenador_geral, então o author_id no
--     after_data não vaza para o colegiado).

-- ---------------------------------------------------------------------------
-- Helper: é do colegiado gestor?
-- coordenador_geral, coordenador_area (role global) ou qualquer cargo
-- de coordenação (0043). Mesmo shape de has_role()/coordena_area().
-- ---------------------------------------------------------------------------
create or replace function public.eh_colegiado()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('coordenador_geral', 'coordenador_area')
  )
  or exists (
    select 1
    from public.cargos c
    where c.profile_id = (select auth.uid())
  );
$$;

revoke execute on function public.eh_colegiado() from public, anon;
grant execute on function public.eh_colegiado() to authenticated;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.ouvidoria_ciclos (
  id uuid primary key default gen_random_uuid(),
  referencia text not null unique
    check (referencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'coletando'
    check (status in ('coletando', 'aberto', 'concluido')),
  opened_at timestamptz,
  opened_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  resumo_colegiado text,
  encaminhamentos text,
  created_at timestamptz not null default now()
);

create index ouvidoria_ciclos_status_idx on public.ouvidoria_ciclos (status);
create index ouvidoria_ciclos_referencia_idx on public.ouvidoria_ciclos (referencia desc);

create table public.ouvidoria_relatos (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references public.ouvidoria_ciclos(id) on delete cascade,
  categoria text not null check (categoria in (
    'coordenacao_geral', 'coordenacao_diaria',
    'convivencia_voluntarios', 'vivencia_pessoal', 'outro'
  )),
  sentimento text check (sentimento in (
    'acolhido', 'preocupado', 'frustrado', 'desmotivado',
    'esperancoso', 'grato', 'inseguro', 'outro'
  )),
  mensagem text not null check (length(trim(mensagem)) between 10 and 4000),
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'novo' check (status in (
    'novo', 'em_analise', 'encaminhado', 'concluido'
  )),
  nota_colegiado text,
  identidade_revelada boolean not null default false,
  revelado_em timestamptz,
  revelado_por uuid references public.profiles(id) on delete set null,
  motivo_revelacao text,
  created_at timestamptz not null default now()
);

create index ouvidoria_relatos_ciclo_idx on public.ouvidoria_relatos (ciclo_id);
create index ouvidoria_relatos_status_idx on public.ouvidoria_relatos (status);
create index ouvidoria_relatos_created_idx on public.ouvidoria_relatos (created_at desc);

-- Log append-only da quebra de sigilo (quem revelou o quê, quando, por quê).
create table public.ouvidoria_quebra_log (
  id bigint generated always as identity primary key,
  relato_id uuid not null references public.ouvidoria_relatos(id) on delete cascade,
  revelado_por uuid references public.profiles(id) on delete set null,
  autor_revelado uuid references public.profiles(id) on delete set null,
  motivo text not null check (length(trim(motivo)) between 10 and 1000),
  created_at timestamptz not null default now()
);

create index ouvidoria_quebra_relato_idx on public.ouvidoria_quebra_log (relato_id);

alter table public.ouvidoria_ciclos enable row level security;
alter table public.ouvidoria_relatos enable row level security;
alter table public.ouvidoria_quebra_log enable row level security;

-- Ciclos: qualquer autenticado vê referência/status/datas (nada sensível).
-- NENHUMA policy de escrita: mudanças só via funções do colegiado.
create policy "ouvidoria ciclos select authenticated"
  on public.ouvidoria_ciclos
  for select
  to authenticated
  using (true);

-- Relatos: SEM policies para authenticated → Data API direta sempre nega
-- (nem SELECT nem INSERT). Acesso exclusivo via funções abaixo.
-- (Intencional: RLS habilitada + zero policies = deny all.)

-- Quebra-log: só coordenador_geral lê; escrita só via função.
create policy "ouvidoria quebra select coordenador"
  on public.ouvidoria_quebra_log
  for select
  to authenticated
  using ((select public.has_role('coordenador_geral')));

grant select on table public.ouvidoria_ciclos to authenticated;
-- Sem GRANT em ouvidoria_relatos / ouvidoria_quebra_log: só via RPC.

-- ---------------------------------------------------------------------------
-- Funções (todas SECURITY DEFINER + check de auth.uid() no corpo, padrão
-- 0043 — revoke de public/anon, grant a authenticated)
-- ---------------------------------------------------------------------------

-- Garante o ciclo do mês corrente (YYYY-MM) e devolve o id.
create or replace function public.ouvidoria_ciclo_atual()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := to_char(now(), 'YYYY-MM');
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado.';
  end if;
  select id into v_id from public.ouvidoria_ciclos where referencia = v_ref;
  if v_id is null then
    insert into public.ouvidoria_ciclos (referencia)
    values (v_ref)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.ouvidoria_ciclo_atual() from public, anon;
grant execute on function public.ouvidoria_ciclo_atual() to authenticated;

-- Envio anônimo: qualquer voluntário autenticado escreve; author_id é o
-- auth.uid() gravado no banco mas NUNCA exposto nas listagens.
create or replace function public.enviar_relato_ouvidoria(
  p_categoria text,
  p_sentimento text,
  p_mensagem text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ciclo uuid;
  v_id uuid;
  v_msg text := trim(coalesce(p_mensagem, ''));
begin
  if v_uid is null then
    raise exception 'Não autenticado.';
  end if;
  if p_categoria not in (
    'coordenacao_geral', 'coordenacao_diaria',
    'convivencia_voluntarios', 'vivencia_pessoal', 'outro'
  ) then
    raise exception 'Categoria inválida.';
  end if;
  if p_sentimento is not null and p_sentimento not in (
    'acolhido', 'preocupado', 'frustrado', 'desmotivado',
    'esperancoso', 'grato', 'inseguro', 'outro'
  ) then
    raise exception 'Sentimento inválido.';
  end if;
  if length(v_msg) < 10 or length(v_msg) > 4000 then
    raise exception 'O relato precisa ter entre 10 e 4000 caracteres.';
  end if;

  v_ciclo := public.ouvidoria_ciclo_atual();

  insert into public.ouvidoria_relatos (ciclo_id, categoria, sentimento, mensagem, author_id)
  values (v_ciclo, p_categoria, nullif(trim(coalesce(p_sentimento, '')), ''), v_msg, v_uid)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.enviar_relato_ouvidoria(text, text, text) from public, anon;
grant execute on function public.enviar_relato_ouvidoria(text, text, text) to authenticated;

-- Meus envios: o próprio autor vê o que escreveu (sem expor ninguém mais).
create or replace function public.meus_relatos_ouvidoria()
returns table (
  id uuid,
  categoria text,
  sentimento text,
  mensagem text,
  status text,
  created_at timestamptz,
  ciclo_referencia text,
  ciclo_status text,
  nota_colegiado text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    r.id, r.categoria, r.sentimento, r.mensagem, r.status, r.created_at,
    c.referencia, c.status, r.nota_colegiado
  from public.ouvidoria_relatos r
  join public.ouvidoria_ciclos c on c.id = r.ciclo_id
  where r.author_id = (select auth.uid())
  order by r.created_at desc;
$$;

revoke execute on function public.meus_relatos_ouvidoria() from public, anon;
grant execute on function public.meus_relatos_ouvidoria() to authenticated;

-- Listagem ANONIMIZADA para o colegiado — SEM author_id. Exige ciclo aberto
-- ou concluído (lacrado = erro). É a "abertura da caixinha".
create or replace function public.listar_relatos_anonimos(p_ciclo_id uuid)
returns table (
  id uuid,
  categoria text,
  sentimento text,
  mensagem text,
  status text,
  created_at timestamptz,
  nota_colegiado text,
  identidade_revelada boolean
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.eh_colegiado() then
    raise exception 'Exclusivo do colegiado gestor.';
  end if;
  select status into v_status from public.ouvidoria_ciclos where id = p_ciclo_id;
  if v_status is null then
    raise exception 'Ciclo não encontrado.';
  end if;
  if v_status = 'coletando' then
    raise exception 'Ciclo ainda lacrado — abra o ciclo na reunião do colegiado.';
  end if;

  return query
  select
    r.id, r.categoria, r.sentimento, r.mensagem, r.status,
    r.created_at, r.nota_colegiado, r.identidade_revelada
  from public.ouvidoria_relatos r
  where r.ciclo_id = p_ciclo_id
  order by r.created_at asc;
end;
$$;

revoke execute on function public.listar_relatos_anonimos(uuid) from public, anon;
grant execute on function public.listar_relatos_anonimos(uuid) to authenticated;

-- Totais por ciclo para o colegiado (contagem sem expor conteúdo).
create or replace function public.listar_ciclos_colegiado()
returns table (
  id uuid,
  referencia text,
  status text,
  total_relatos bigint,
  total_novos bigint,
  opened_at timestamptz,
  closed_at timestamptz,
  resumo_colegiado text,
  encaminhamentos text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.eh_colegiado() then
    raise exception 'Exclusivo do colegiado gestor.';
  end if;

  return query
  select
    c.id, c.referencia, c.status,
    count(r.id)::bigint,
    count(r.id) filter (where r.status = 'novo')::bigint,
    c.opened_at, c.closed_at, c.resumo_colegiado, c.encaminhamentos
  from public.ouvidoria_ciclos c
  left join public.ouvidoria_relatos r on r.ciclo_id = c.id
  group by c.id
  order by c.referencia desc;
end;
$$;

revoke execute on function public.listar_ciclos_colegiado() from public, anon;
grant execute on function public.listar_ciclos_colegiado() to authenticated;

-- Abertura mensal: lacrado → aberto. Registra quem/quando abriu.
create or replace function public.abrir_ciclo_ouvidoria(p_ciclo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.eh_colegiado() then
    raise exception 'Exclusivo do colegiado gestor.';
  end if;
  update public.ouvidoria_ciclos
  set status = 'aberto', opened_at = now(), opened_by = v_uid
  where id = p_ciclo_id and status = 'coletando';
  if not found then
    raise exception 'Ciclo não está lacrado (ou não existe).';
  end if;
end;
$$;

revoke execute on function public.abrir_ciclo_ouvidoria(uuid) from public, anon;
grant execute on function public.abrir_ciclo_ouvidoria(uuid) to authenticated;

-- Conclusão do ciclo com resumo e encaminhamentos da reunião.
create or replace function public.concluir_ciclo_ouvidoria(
  p_ciclo_id uuid,
  p_resumo text,
  p_encaminhamentos text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.eh_colegiado() then
    raise exception 'Exclusivo do colegiado gestor.';
  end if;
  update public.ouvidoria_ciclos
  set status = 'concluido',
      closed_at = now(),
      closed_by = v_uid,
      resumo_colegiado = nullif(trim(coalesce(p_resumo, '')), ''),
      encaminhamentos = nullif(trim(coalesce(p_encaminhamentos, '')), '')
  where id = p_ciclo_id and status = 'aberto';
  if not found then
    raise exception 'Ciclo precisa estar aberto para ser concluído.';
  end if;
end;
$$;

revoke execute on function public.concluir_ciclo_ouvidoria(uuid, text, text) from public, anon;
grant execute on function public.concluir_ciclo_ouvidoria(uuid, text, text) to authenticated;

-- Acompanhamento do colegiado: status + nota (sem tocar na autoria).
create or replace function public.atualizar_relato_colegiado(
  p_relato_id uuid,
  p_status text,
  p_nota text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ciclo_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.eh_colegiado() then
    raise exception 'Exclusivo do colegiado gestor.';
  end if;
  if p_status not in ('novo', 'em_analise', 'encaminhado', 'concluido') then
    raise exception 'Status inválido.';
  end if;
  select c.status into v_ciclo_status
  from public.ouvidoria_relatos r
  join public.ouvidoria_ciclos c on c.id = r.ciclo_id
  where r.id = p_relato_id;
  if v_ciclo_status is null then
    raise exception 'Relato não encontrado.';
  end if;
  if v_ciclo_status = 'coletando' then
    raise exception 'Ciclo ainda lacrado.';
  end if;
  update public.ouvidoria_relatos
  set status = p_status,
      nota_colegiado = nullif(trim(coalesce(p_nota, '')), '')
  where id = p_relato_id;
end;
$$;

revoke execute on function public.atualizar_relato_colegiado(uuid, text, text) from public, anon;
grant execute on function public.atualizar_relato_colegiado(uuid, text, text) to authenticated;

-- QUEBRA DE SIGILO (exclusivo coordenador_geral, motivo obrigatório):
-- devolve a identidade do autor e registra tudo em ouvidoria_quebra_log.
create or replace function public.revelar_identidade_relato(
  p_relato_id uuid,
  p_motivo text
)
returns table (
  autor_id uuid,
  full_name text,
  email text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_autor uuid;
  v_motivo text := trim(coalesce(p_motivo, ''));
begin
  if v_uid is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.has_role('coordenador_geral') then
    raise exception 'Quebra de sigilo exclusiva do coordenador geral.';
  end if;
  if length(v_motivo) < 10 or length(v_motivo) > 1000 then
    raise exception 'Informe o motivo (10 a 1000 caracteres).';
  end if;
  select author_id into v_autor
  from public.ouvidoria_relatos
  where id = p_relato_id;
  if v_autor is null then
    raise exception 'Relato não encontrado.';
  end if;

  update public.ouvidoria_relatos
  set identidade_revelada = true,
      revelado_em = now(),
      revelado_por = v_uid,
      motivo_revelacao = v_motivo
  where id = p_relato_id;

  insert into public.ouvidoria_quebra_log (relato_id, revelado_por, autor_revelado, motivo)
  values (p_relato_id, v_uid, v_autor, v_motivo);

  return query
  select p.id, p.full_name, p.email
  from public.profiles p
  where p.id = v_autor;
end;
$$;

revoke execute on function public.revelar_identidade_relato(uuid, text) from public, anon;
grant execute on function public.revelar_identidade_relato(uuid, text) to authenticated;

-- Histórico de quebras (só coordenador_geral).
create or replace function public.listar_quebras_ouvidoria()
returns table (
  id bigint,
  relato_id uuid,
  motivo text,
  created_at timestamptz,
  revelado_por_nome text,
  autor_nome text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.has_role('coordenador_geral') then
    raise exception 'Exclusivo do coordenador geral.';
  end if;
  return query
  select
    q.id, q.relato_id, q.motivo, q.created_at,
    rp.full_name, ap.full_name
  from public.ouvidoria_quebra_log q
  left join public.profiles rp on rp.id = q.revelado_por
  left join public.profiles ap on ap.id = q.autor_revelado
  order by q.created_at desc;
end;
$$;

revoke execute on function public.listar_quebras_ouvidoria() from public, anon;
grant execute on function public.listar_quebras_ouvidoria() to authenticated;

-- Audit trail (0059): leitura do audit_log é só coordenador_geral, então o
-- author_id gravado no after_data não vaza para o colegiado.
create trigger audit_ouvidoria_ciclos
  after insert or update or delete on public.ouvidoria_ciclos
  for each row execute function public.registrar_audit('id');
create trigger audit_ouvidoria_relatos
  after insert or update or delete on public.ouvidoria_relatos
  for each row execute function public.registrar_audit('id');

comment on table public.ouvidoria_ciclos is 'Ouvidoria: ciclos mensais da caixinha (lacrado → aberto → concluído).';
comment on table public.ouvidoria_relatos is 'Ouvidoria: relatos anônimos; author_id NUNCA exposto — só via quebra do coordenador geral.';
comment on table public.ouvidoria_quebra_log is 'Ouvidoria: log append-only de quebras de sigilo (motivo obrigatório).';

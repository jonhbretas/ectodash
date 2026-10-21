-- supabase/migrations/20261021150000_pautas_votacao_anexo.sql
-- "Pedir pauta" em etapas: prioridade, tipo (informativa/deliberativa), anexo
-- opcional no Google Drive e votação prévia das pautas deliberativas.
--   * pautas ganha prioridade, tipo, anexo_*, quorum_minimo e o estado da
--     votação (votacao_status/encerrada_em/encerrada_por);
--   * o criador pode atualizar QUALQUER coluna da própria pauta (0076), então
--     um trigger BEFORE protege tipo/quórum/votação: só coordenador_geral mexe;
--   * pauta_votos guarda 1 voto por usuário (upsert), editável enquanto a
--     votação estiver aberta;
--   * encerrar/reabrir votação são funções SECURITY DEFINER (coordenador_geral)
--     que calculam o resultado em SQL: aprovada = aprovar > rejeitar e total
--     (com abstenções) >= quorum_minimo; senão rejeitada ou sem_quorum.
-- ATENÇÃO PostgREST: votacao_encerrada_por cria uma 2ª FK de pautas para
-- profiles; todo embed deve usar profiles!pautas_criado_por_fkey (corrigido
-- no código antes desta migration).

alter table public.pautas
  add column prioridade text not null default 'media'
    check (prioridade in ('baixa', 'media', 'alta')),
  add column tipo text not null default 'informativa'
    check (tipo in ('informativa', 'deliberativa')),
  add column anexo_drive_id text,
  add column anexo_url text,
  add column anexo_nome text,
  add column quorum_minimo integer not null default 3
    check (quorum_minimo between 1 and 100),
  add column votacao_status text
    check (votacao_status in ('aberta', 'aprovada', 'rejeitada', 'sem_quorum')),
  add column votacao_encerrada_em timestamptz,
  add column votacao_encerrada_por uuid references public.profiles(id) on delete set null;

alter table public.pautas
  add constraint pautas_votacao_tipo_check check (
    (tipo = 'informativa' and votacao_status is null)
    or (tipo = 'deliberativa' and votacao_status is not null)
  );

create index pautas_votacao_encerrada_por_idx on public.pautas (votacao_encerrada_por);
create index pautas_tipo_votacao_status_idx on public.pautas (tipo, votacao_status);

-- ---------------------------------------------------------------------------
-- Guard: só a coordenação geral altera tipo/quórum/votação.
-- auth.uid() nulo = service role / SQL editor / migrations: passa direto.
-- ---------------------------------------------------------------------------
create or replace function public.pautas_guard_votacao()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_coord boolean;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  is_coord := coalesce(public.has_role('coordenador_geral'), false);

  if tg_op = 'INSERT' then
    if not is_coord then
      new.quorum_minimo := 3;
    end if;
    if new.tipo = 'deliberativa' then
      new.votacao_status := 'aberta';
    else
      new.votacao_status := null;
    end if;
    new.votacao_encerrada_em := null;
    new.votacao_encerrada_por := null;
    return new;
  end if;

  -- UPDATE
  if not is_coord and (
    new.tipo is distinct from old.tipo
    or new.quorum_minimo is distinct from old.quorum_minimo
    or new.votacao_status is distinct from old.votacao_status
    or new.votacao_encerrada_em is distinct from old.votacao_encerrada_em
    or new.votacao_encerrada_por is distinct from old.votacao_encerrada_por
  ) then
    raise exception 'Somente a coordenação geral pode alterar a votação da pauta.'
      using errcode = '42501';
  end if;

  if new.tipo = 'informativa' then
    new.votacao_status := null;
    new.votacao_encerrada_em := null;
    new.votacao_encerrada_por := null;
  elsif new.tipo = 'deliberativa' and new.votacao_status is null then
    new.votacao_status := 'aberta';
  end if;

  return new;
end;
$$;

drop trigger if exists pautas_guard_votacao_trg on public.pautas;
create trigger pautas_guard_votacao_trg
  before insert or update on public.pautas
  for each row execute function public.pautas_guard_votacao();

-- ---------------------------------------------------------------------------
-- Votos
-- ---------------------------------------------------------------------------
create table public.pauta_votos (
  id bigint generated always as identity primary key,
  pauta_id bigint not null references public.pautas(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  voto text not null check (voto in ('aprovar', 'rejeitar', 'abster')),
  comentario text check (comentario is null or char_length(comentario) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pauta_votos_pauta_user_key unique (pauta_id, user_id)
);

create index pauta_votos_user_id_idx on public.pauta_votos (user_id);

alter table public.pauta_votos enable row level security;

create policy "authenticated users can view pauta votos"
  on public.pauta_votos
  for select
  to authenticated
  using (true);

create policy "users vote on open deliberative pautas"
  on public.pauta_votos
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.pautas p
      where p.id = pauta_id
        and p.tipo = 'deliberativa'
        and p.votacao_status = 'aberta'
    )
  );

create policy "users change own vote while open"
  on public.pauta_votos
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.pautas p
      where p.id = pauta_id
        and p.tipo = 'deliberativa'
        and p.votacao_status = 'aberta'
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.pautas p
      where p.id = pauta_id
        and p.tipo = 'deliberativa'
        and p.votacao_status = 'aberta'
    )
  );

create policy "users withdraw own vote while open"
  on public.pauta_votos
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.pautas p
      where p.id = pauta_id
        and p.tipo = 'deliberativa'
        and p.votacao_status = 'aberta'
    )
  );

drop trigger if exists pauta_votos_set_updated_at on public.pauta_votos;
create trigger pauta_votos_set_updated_at
  before update on public.pauta_votos
  for each row execute function public.set_updated_at();

create trigger audit_pauta_votos
  after insert or update or delete on public.pauta_votos
  for each row execute function public.registrar_audit('id');

-- ---------------------------------------------------------------------------
-- Encerrar / reabrir votação (coordenador_geral)
-- ---------------------------------------------------------------------------
create or replace function public.encerrar_votacao_pauta(p_pauta_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
  v_status text;
  v_quorum integer;
  v_aprovar integer;
  v_rejeitar integer;
  v_total integer;
  v_resultado text;
begin
  if not coalesce(public.has_role('coordenador_geral'), false) then
    raise exception 'Somente a coordenação geral pode encerrar a votação.'
      using errcode = '42501';
  end if;

  select tipo, votacao_status, quorum_minimo
    into v_tipo, v_status, v_quorum
    from public.pautas
   where id = p_pauta_id
   for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;
  if v_tipo <> 'deliberativa' then
    raise exception 'Esta pauta não tem votação.';
  end if;
  if v_status <> 'aberta' then
    raise exception 'A votação já está encerrada.';
  end if;

  select count(*) filter (where voto = 'aprovar'),
         count(*) filter (where voto = 'rejeitar'),
         count(*)
    into v_aprovar, v_rejeitar, v_total
    from public.pauta_votos
   where pauta_id = p_pauta_id;

  if v_total < v_quorum then
    v_resultado := 'sem_quorum';
  elsif v_aprovar > v_rejeitar then
    v_resultado := 'aprovada';
  else
    v_resultado := 'rejeitada';
  end if;

  update public.pautas
     set votacao_status = v_resultado,
         votacao_encerrada_em = now(),
         votacao_encerrada_por = (select auth.uid())
   where id = p_pauta_id;

  return v_resultado;
end;
$$;

create or replace function public.reabrir_votacao_pauta(p_pauta_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
  v_status text;
begin
  if not coalesce(public.has_role('coordenador_geral'), false) then
    raise exception 'Somente a coordenação geral pode reabrir a votação.'
      using errcode = '42501';
  end if;

  select tipo, votacao_status
    into v_tipo, v_status
    from public.pautas
   where id = p_pauta_id
   for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;
  if v_tipo <> 'deliberativa' then
    raise exception 'Esta pauta não tem votação.';
  end if;
  if v_status = 'aberta' then
    raise exception 'A votação já está aberta.';
  end if;

  update public.pautas
     set votacao_status = 'aberta',
         votacao_encerrada_em = null,
         votacao_encerrada_por = null
   where id = p_pauta_id;
end;
$$;

revoke execute on function public.encerrar_votacao_pauta(bigint) from public, anon;
grant execute on function public.encerrar_votacao_pauta(bigint) to authenticated;
revoke execute on function public.reabrir_votacao_pauta(bigint) from public, anon;
grant execute on function public.reabrir_votacao_pauta(bigint) to authenticated;

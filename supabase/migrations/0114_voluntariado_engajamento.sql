-- supabase/migrations/0114_voluntariado_engajamento.sql
-- Gestão da coordenação de voluntariado (RH da Ectolab):
--   1. voluntarios.engajamento — 'engajado' | 'atencao' (não engajado) |
--      'sumido' | 'afastado'. "Sumido" é marcação manual; a tela sugere
--      quem está sem contato há 30+ dias (derivado, não gravado).
--   2. voluntarios.ultimo_contato_em + contato_obs — a coordenação registra
--      cada conversa (WhatsApp etc.) com um toque.
--   3. voluntario_movimentacoes — histórico append-only de admissão,
--      afastamento, retorno, desligamento, troca de área, contato e ajustes.
--   4. registrar_cuidado_voluntario() — ÚNICO caminho de escrita (SECURITY
--      DEFINER + voluntario_manager_role() de 0017, mesmo idiom de
--      atualizar_situacao_voluntario em 0026): grava o log e aplica o
--      efeito colateral (afastar/desligar com data_saída/retornar/
--      trocar área/atualizar contato). Desligar = ativo=false (reversível,
--      nunca apaga histórico).
--
-- A tabela de log não tem policy de escrita: só via RPC. Leitura = os
-- mesmos gestores do roster + o próprio voluntário (suas movimentações).

alter table public.voluntarios
  add column if not exists engajamento text not null default 'engajado'
    check (engajamento in ('engajado', 'atencao', 'sumido', 'afastado')),
  add column if not exists ultimo_contato_em date,
  add column if not exists contato_obs text;

create index if not exists voluntarios_engajamento_idx on public.voluntarios (engajamento);

create table public.voluntario_movimentacoes (
  id bigint generated always as identity primary key,
  voluntario_id bigint not null references public.voluntarios(id) on delete cascade,
  tipo text not null check (tipo in (
    'admissao', 'afastamento', 'retorno', 'desligamento',
    'troca_area', 'contato', 'ajuste'
  )),
  detalhes text,
  area_origem text,
  area_destino text,
  criado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index voluntario_movimentacoes_voluntario_idx
  on public.voluntario_movimentacoes (voluntario_id, created_at desc);

alter table public.voluntario_movimentacoes enable row level security;

-- Gestores do roster veem tudo (mesmo idiom de 0017).
create policy "roster managers can view movimentacoes"
  on public.voluntario_movimentacoes
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('voluntariado'))
    or exists (
      select 1
      from public.voluntarios v
      join public.profiles p on p.voluntario_id = v.id
      where v.id = public.voluntario_movimentacoes.voluntario_id
        and p.id = (select auth.uid())
    )
  );

-- Sem policies de escrita: só via registrar_cuidado_voluntario().

create or replace function public.registrar_cuidado_voluntario(
  p_voluntario_id bigint,
  p_tipo text,
  p_detalhes text,
  p_area text,
  p_engajamento text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  manager public.app_role;
  target_area text;
begin
  if p_tipo not in (
    'contato', 'ajuste', 'afastamento', 'retorno',
    'desligamento', 'admissao', 'troca_area'
  ) then
    return false;
  end if;
  if p_engajamento is not null and p_engajamento not in (
    'engajado', 'atencao', 'sumido', 'afastado'
  ) then
    return false;
  end if;

  select v.area_atuacao
  into target_area
  from public.voluntarios v
  where v.id = p_voluntario_id;
  if not found then
    return false;
  end if;

  manager := public.voluntario_manager_role(target_area);
  if manager is null then
    return false;
  end if;

  insert into public.voluntario_movimentacoes
    (voluntario_id, tipo, detalhes, area_origem, area_destino, criado_por)
  values (
    p_voluntario_id,
    p_tipo,
    nullif(trim(coalesce(p_detalhes, '')), ''),
    case when p_tipo = 'troca_area' then target_area else null end,
    case when p_tipo = 'troca_area'
      then nullif(trim(coalesce(p_area, '')), '')
      else null end,
    (select auth.uid())
  );

  if p_tipo in ('contato', 'retorno') then
    update public.voluntarios
    set ultimo_contato_em = current_date
    where id = p_voluntario_id;
  end if;

  if p_engajamento is not null then
    update public.voluntarios
    set engajamento = p_engajamento
    where id = p_voluntario_id;
  end if;

  if p_tipo = 'afastamento' then
    update public.voluntarios
    set engajamento = 'afastado'
    where id = p_voluntario_id;
  elsif p_tipo = 'retorno' or p_tipo = 'admissao' then
    update public.voluntarios
    set ativo = true,
        engajamento = 'engajado',
        data_saida = null
    where id = p_voluntario_id;
  elsif p_tipo = 'desligamento' then
    update public.voluntarios
    set ativo = false,
        data_saida = current_date
    where id = p_voluntario_id;
  elsif p_tipo = 'troca_area'
    and nullif(trim(coalesce(p_area, '')), '') is not null then
    update public.voluntarios
    set area_atuacao = trim(p_area),
        engajamento = 'engajado'
    where id = p_voluntario_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.registrar_cuidado_voluntario(bigint, text, text, text, text) from public, anon;
grant execute on function public.registrar_cuidado_voluntario(bigint, text, text, text, text) to authenticated;

comment on table public.voluntario_movimentacoes is 'Histórico de cuidado do voluntário: admissão, afastamento, retorno, desligamento, troca de área, contatos e ajustes de engajamento.';

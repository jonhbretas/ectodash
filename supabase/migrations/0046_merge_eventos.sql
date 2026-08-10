-- supabase/migrations/0046_merge_eventos.sql
-- Merge de eventos duplicados: junta dois eventos (um "duplicado" num
-- "definitivo"), movendo todas as referências do duplicado para o definitivo
-- e apagando o duplicado.
--
-- Caso de uso: a análise automática de atas (reunioes/analise-actions.ts)
-- pode extrair o mesmo evento de duas atas diferentes — criando dois eventos
-- com o mesmo título/data. O coordenador escolhe qual fica (definitivo) e
-- qual é absorvido.
--
-- Referências movidas (remover -> manter):
--   - demandas.evento_id            (0008, on delete set null)  — move, dedupe por título
--   - proep_* .edition_id           (0033/0037, on delete cascade) — move
--   - proep_edition_config.edition_id (0038, PK, cascade)       — move (mantém o do definitivo em conflito)
--   - contratos.evento_id           (0042, sem ON DELETE!)      — move (obrigatório antes do delete)
--   - contrato_evento_pastas.evento_id (0042, PK, cascade)      — move (mantém o do definitivo em conflito)
--
-- Dados do próprio evento: o definitivo mantém título/data/criado_por;
-- descricao, local e tipo_evento_id vazios no definitivo são preenchidos
-- com os do duplicado (nunca o contrário).
--
-- Caller: coordenador_geral (operação destrutiva que mexe em demandas,
-- contratos e turmas PROEP de todos — mesmo espírito do 0028).
-- Sources: 0028_merge_voluntario.sql dedupe idiom [CITED: this repo];
-- 0008/0011/0033/0037/0038/0042 FK shapes [CITED: this repo].

create or replace function public.mesclar_eventos(
  p_manter_id bigint,
  p_remover_id bigint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titulo_remover text;
  v_descricao_remover text;
  v_local_remover text;
  v_tipo_remover bigint;
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role = 'coordenador_geral'
  ) then
    return 'sem_permissao';
  end if;

  if p_manter_id = p_remover_id then
    return 'mesmo_evento';
  end if;

  if not exists (select 1 from public.eventos where id = p_manter_id) then
    return 'evento_nao_encontrado';
  end if;

  if not exists (select 1 from public.eventos where id = p_remover_id) then
    return 'evento_nao_encontrado';
  end if;

  -- Demandas: move as do duplicado, removendo antes as que já existem com o
  -- mesmo título no definitivo (mesma regra de idempotência do modelo de
  -- tarefas em adicionarTarefasDoModelo).
  delete from public.demandas t
  where t.evento_id = p_remover_id
    and exists (
      select 1 from public.demandas o
      where o.evento_id = p_manter_id
        and lower(trim(o.titulo)) = lower(trim(t.titulo))
    );
  update public.demandas
    set evento_id = p_manter_id
    where evento_id = p_remover_id;

  -- Turmas PROEP (sem chave natural única — move sem dedupe).
  update public.proep_students
    set edition_id = p_manter_id
    where edition_id = p_remover_id;
  update public.proep_materials
    set edition_id = p_manter_id
    where edition_id = p_remover_id;
  update public.proep_checklist
    set edition_id = p_manter_id
    where edition_id = p_remover_id;
  update public.proep_assignments
    set edition_id = p_manter_id
    where edition_id = p_remover_id;
  update public.proep_progression
    set edition_id = p_manter_id
    where edition_id = p_remover_id;

  -- Config de pasta no Drive: PK é edition_id — se o definitivo já tem
  -- pasta, descarta a do duplicado; senão, reaponta.
  delete from public.proep_edition_config
  where edition_id = p_remover_id
    and exists (select 1 from public.proep_edition_config o where o.edition_id = p_manter_id);
  update public.proep_edition_config
    set edition_id = p_manter_id
    where edition_id = p_remover_id;

  -- Contratos: a FK de contratos.evento_id não tem ON DELETE — mover é
  -- obrigatório para o delete do duplicado não falhar.
  update public.contratos
    set evento_id = p_manter_id
    where evento_id = p_remover_id;

  -- Pastas de contrato no Drive (PK evento_id) — mesma regra da config PROEP.
  delete from public.contrato_evento_pastas
  where evento_id = p_remover_id
    and exists (select 1 from public.contrato_evento_pastas o where o.evento_id = p_manter_id);
  update public.contrato_evento_pastas
    set evento_id = p_manter_id
    where evento_id = p_remover_id;

  -- Campos vazios do definitivo ganham os do duplicado (o inverso nunca).
  select titulo, descricao, local, tipo_evento_id
    into v_titulo_remover, v_descricao_remover, v_local_remover, v_tipo_remover
  from public.eventos
  where id = p_remover_id;

  update public.eventos
    set descricao = case
        when (descricao is null or btrim(descricao) = '') and v_descricao_remover is not null
          then v_descricao_remover
        else descricao
      end,
      local = case
        when (local is null or btrim(local) = '') and v_local_remover is not null
          then v_local_remover
        else local
      end,
      tipo_evento_id = case
        when tipo_evento_id is null then v_tipo_remover
        else tipo_evento_id
      end
  where id = p_manter_id;

  -- Remove o duplicado (todas as referências já foram movidas).
  delete from public.eventos where id = p_remover_id;

  return 'ok';
end;
$$;

revoke execute on function public.mesclar_eventos(bigint, bigint) from public, anon;
grant execute on function public.mesclar_eventos(bigint, bigint) to authenticated;

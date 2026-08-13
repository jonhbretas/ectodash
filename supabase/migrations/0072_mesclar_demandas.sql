-- supabase/migrations/0072_mesclar_demandas.sql
-- Merge de demandas duplicadas: junta várias demandas numa só, movendo
-- responsáveis, membros, comentários e itens de checklist das absorvidas
-- para a mantida, preenchendo campos vazios da mantida com os das
-- absorvidas, e apagando as absorvidas.
--
-- Caso de uso: o kanban acumula demandas duplicadas (mesma tarefa criada
-- por engano duas vezes, ou extraídas de atas diferentes). O coordenador
-- seleciona as demandas, escolhe qual fica e o resto é absorvido.
--
-- Regras de merge (mesmo espírito do 0046_merge_eventos):
--   - responsáveis/membros: união com dedupe pelos índices parciais
--     únicos (demanda, profile_id) e (demanda, voluntario_id) — a demanda
--     mantida nunca fica com a mesma pessoa atribuída duas vezes.
--   - comentários/checklist: movidos sem dedupe (sem chave natural).
--   - campos vazios da mantida (descricao, area, projeto, etiqueta_id,
--     evento_id) são preenchidos com os da primeira absorvida que os tiver
--     (o inverso nunca).
--   - titulo/prazo/status/criado_por da mantida são preservados.
--
-- Permissão: mesma regra da policy de DELETE role-scoped (0053) — o
-- chamador precisa poder excluir CADA demanda envolvida (coordenador
-- geral, líder da área, criador ou responsável). A função é security
-- definer e aplica o gate dentro, como 0046.
-- Sources: 0046_merge_eventos.sql dedupe idiom [CITED: this repo];
-- 0020 partial unique indexes shape [CITED: this repo]; 0053 delete
-- predicate [CITED: this repo].

create or replace function public.mesclar_demandas(
  p_manter_id bigint,
  p_remover_ids bigint[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total bigint;
  v_count bigint;
begin
  -- Deduplica os ids absorvidos (o resto das validações assume sem repetição).
  select coalesce(array_agg(distinct x order by x), '{}')
    into p_remover_ids
  from unnest(p_remover_ids) as x;

  -- Nenhum id absorvido = nada a fazer.
  v_total := coalesce(cardinality(p_remover_ids), 0);
  if v_total = 0 then
    return 'sem_removidas';
  end if;

  -- Os ids não podem se repetir nem incluir a mantida.
  if p_manter_id = any(p_remover_ids) then
    return 'mesma_demanda';
  end if;

  -- Gate de permissão: o chamador precisa satisfazer a mesma regra da
  -- policy de DELETE (0053) para TODAS as demandas envolvidas.
  if exists (
    select 1 from public.demandas d
    where d.id in (select unnest(array_append(p_remover_ids, p_manter_id)))
      and not (
        (select public.has_role('coordenador_geral'))
        or (d.area is not null and (select public.is_lider_of_area(d.area)))
        or d.criado_por = (select auth.uid())
        or (select public.is_responsavel_for(d.id))
      )
  ) then
    return 'sem_permissao';
  end if;

  -- Todas as demandas precisam existir (a mantida e cada absorvida).
  select count(*) into v_count
  from public.demandas d
  where d.id in (select unnest(array_append(p_remover_ids, p_manter_id)));
  if v_count <> v_total + 1 then
    return 'demanda_nao_encontrada';
  end if;

  -- Responsáveis: remove da mantida quem já está atribuído a uma
  -- absorvida (dedupe pelos índices parciais únicos de 0020), depois
  -- move o restante — com DISTINCT ON porque duas absorvidas podem ter a
  -- mesma pessoa atribuída, e o insert violaria o índice único.
  delete from public.demanda_responsaveis d
  using public.demanda_responsaveis r
  where r.demanda_id = any(p_remover_ids)
    and d.demanda_id = p_manter_id
    and (
      (d.profile_id is not null and d.profile_id = r.profile_id)
      or (d.voluntario_id is not null and d.voluntario_id = r.voluntario_id)
    );

  insert into public.demanda_responsaveis (demanda_id, profile_id, voluntario_id, created_at)
  select distinct on (profile_id, voluntario_id)
    p_manter_id, r.profile_id, r.voluntario_id, r.created_at
  from public.demanda_responsaveis r
  where r.demanda_id = any(p_remover_ids);

  -- Membros (acompanhantes): mesmo dedupe + move.
  delete from public.demanda_membros d
  using public.demanda_membros r
  where r.demanda_id = any(p_remover_ids)
    and d.demanda_id = p_manter_id
    and (
      (d.profile_id is not null and d.profile_id = r.profile_id)
      or (d.voluntario_id is not null and d.voluntario_id = r.voluntario_id)
    );

  insert into public.demanda_membros (demanda_id, profile_id, voluntario_id, created_at)
  select distinct on (profile_id, voluntario_id)
    p_manter_id, r.profile_id, r.voluntario_id, r.created_at
  from public.demanda_membros r
  where r.demanda_id = any(p_remover_ids);

  -- Comentários e checklist: move sem dedupe (sem chave natural).
  update public.demanda_comentarios
    set demanda_id = p_manter_id
    where demanda_id = any(p_remover_ids);

  update public.demanda_checklist
    set demanda_id = p_manter_id
    where demanda_id = any(p_remover_ids);

  -- Campos vazios da mantida ganham os da primeira absorvida que os tiver.
  if exists (
    select 1 from public.demandas d
    where d.id = any(p_remover_ids)
      and (
        (d.descricao is not null and btrim(d.descricao) <> '')
        or (d.area is not null and btrim(d.area) <> '')
        or (d.projeto is not null and btrim(d.projeto) <> '')
        or d.etiqueta_id is not null
        or d.evento_id is not null
      )
  ) then
    update public.demandas m
      set descricao = case
          when (m.descricao is null or btrim(m.descricao) = '') and r.descricao is not null
            then r.descricao
          else m.descricao
        end,
        area = case
          when (m.area is null or btrim(m.area) = '') and r.area is not null
            then r.area
          else m.area
        end,
        projeto = case
          when (m.projeto is null or btrim(m.projeto) = '') and r.projeto is not null
            then r.projeto
          else m.projeto
        end,
        etiqueta_id = case
          when m.etiqueta_id is null then r.etiqueta_id
          else m.etiqueta_id
        end,
        evento_id = case
          when m.evento_id is null then r.evento_id
          else m.evento_id
        end
    from (
      select d.descricao, d.area, d.projeto, d.etiqueta_id, d.evento_id
      from public.demandas d
      where d.id = any(p_remover_ids)
        and (
          (d.descricao is not null and btrim(d.descricao) <> '')
          or (d.area is not null and btrim(d.area) <> '')
          or (d.projeto is not null and btrim(d.projeto) <> '')
          or d.etiqueta_id is not null
          or d.evento_id is not null
        )
      order by d.id
      limit 1
    ) r
    where m.id = p_manter_id;
  end if;

  -- Remove as absorvidas (cascade limpa o que restou: reminders log etc.).
  delete from public.demandas where id = any(p_remover_ids);

  return 'ok';
end;
$$;

revoke execute on function public.mesclar_demandas(bigint, bigint[]) from public, anon;
grant execute on function public.mesclar_demandas(bigint, bigint[]) to authenticated;

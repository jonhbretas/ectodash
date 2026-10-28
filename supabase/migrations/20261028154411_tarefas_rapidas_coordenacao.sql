-- Only private coordination tasks may start without a deadline.
alter table public.demandas alter column prazo drop not null;
alter table public.demandas add constraint demandas_publicas_exigem_prazo
  check (restrita_coordenacao_geral or prazo is not null);

-- Confidential tasks can never become public through a direct API update.
create or replace function public.preservar_privacidade_demanda()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.restrita_coordenacao_geral and not new.restrita_coordenacao_geral then
    raise exception 'Demandas da coordena??o devem permanecer privadas.';
  end if;
  return new;
end;
$$;
revoke execute on function public.preservar_privacidade_demanda() from public, anon, authenticated;
create trigger demandas_preservar_privacidade
before update of restrita_coordenacao_geral on public.demandas
for each row execute function public.preservar_privacidade_demanda();

-- Merge must obey RLS and cannot move private content to public tasks.
create or replace function public.mesclar_demandas(
  p_manter_id bigint,
  p_remover_ids bigint[]
)
returns text
language plpgsql
security invoker
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

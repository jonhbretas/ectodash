-- Run with: supabase db query --linked --file tests/db/coordination-privacy.sql
-- All fixtures and audit records roll back; no emails or external calls.
begin;
create temp table coordination_fixture (
  coord uuid default gen_random_uuid(),
  assigned uuid default gen_random_uuid(),
  private_id bigint,
  public_id bigint,
  merge_id bigint
);
insert into coordination_fixture default values;
grant all on coordination_fixture to authenticated;

insert into auth.users (id, email)
select coord, 'coord-' || coord || '@example.invalid' from coordination_fixture
union all
select assigned, 'assigned-' || assigned || '@example.invalid' from coordination_fixture;
update public.profiles set role = 'coordenador_geral'
where id = (select coord from coordination_fixture);

select set_config('request.jwt.claim.sub', (select coord::text from coordination_fixture), true);
set local role authenticated;
do $$
declare
  v_private bigint;
  v_public bigint;
  v_merge bigint;
  v_result text;
begin
  insert into public.demandas (titulo, restrita_coordenacao_geral)
  values ('Fixture privada somente nome', true) returning id into v_private;
  insert into public.demandas (titulo, prazo)
  values ('Fixture pública', '2027-01-15') returning id into v_public;
  insert into public.demandas (titulo, restrita_coordenacao_geral)
  values ('Fixture privada para mesclar', true) returning id into v_merge;
  update coordination_fixture set private_id = v_private, public_id = v_public, merge_id = v_merge;

  insert into public.demanda_responsaveis (demanda_id, profile_id)
  select v_private, assigned from coordination_fixture;
  insert into public.demanda_membros (demanda_id, profile_id)
  select v_private, assigned from coordination_fixture;
  insert into public.demanda_checklist (demanda_id, item) values (v_private, 'Confidencial');
  insert into public.demanda_comentarios (demanda_id, conteudo) values (v_private, '@assigned comentário interno');
  if not exists (select 1 from public.demandas where id = v_private and prazo is null and status = 'pendente') then
    raise exception 'Title-only creation failed';
  end if;

  begin
    update public.demandas set restrita_coordenacao_geral = false, prazo = '2027-01-15' where id = v_private;
    raise exception 'Privacy downgrade was allowed';
  exception when raise_exception then
    if sqlerrm = 'Privacy downgrade was allowed' then raise; end if;
  end;
  v_result := public.mesclar_demandas(v_public, array[v_private]);
  if v_result <> 'escopos_diferentes' then
    raise exception 'Unexpected cross-scope merge result: %', v_result;
  end if;
  if public.mesclar_demandas(v_private, array[v_merge]) <> 'ok' then
    raise exception 'Private merge failed';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', (select assigned::text from coordination_fixture), true);
set local role authenticated;
do $$
declare
  v_id bigint := (select private_id from coordination_fixture);
  v_rows bigint;
begin
  if exists (select 1 from public.demandas where id = v_id)
    or exists (select 1 from public.demandas_com_status where id = v_id)
    or exists (select 1 from public.demanda_responsaveis where demanda_id = v_id)
    or exists (select 1 from public.demanda_membros where demanda_id = v_id)
    or exists (select 1 from public.demanda_comentarios where demanda_id = v_id)
    or exists (select 1 from public.demanda_checklist where demanda_id = v_id) then
    raise exception 'Assigned person can read private data';
  end if;
  update public.demandas set titulo = 'Unauthorized change' where id = v_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Assigned person can edit private data'; end if;
  delete from public.demandas where id = v_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'Assigned person can delete private data'; end if;
  if public.mesclar_demandas((select public_id from coordination_fixture), array[v_id]) = 'ok' then
    raise exception 'Assigned person can merge private data';
  end if;
  begin
    insert into public.demanda_comentarios (demanda_id, conteudo) values (v_id, 'Unauthorized');
    raise exception 'Assigned person can comment';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.demandas (titulo, restrita_coordenacao_geral) values ('Unauthorized private task', true);
    raise exception 'Assigned person can create private tasks';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.demandas (titulo) values ('Public task without deadline');
    raise exception 'Public task can omit deadline';
  exception when check_violation then null;
  end;
end;
$$;
reset role;
select 'PASS: title-only creation, RLS on task and children, immutable privacy, safe merges' as result;
rollback;

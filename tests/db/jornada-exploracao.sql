-- Roda via: supabase db query --linked --file tests/db/jornada-exploracao.sql
-- Usa duas identidades existentes somente dentro da transação e desfaz
-- todas as escritas. Não altera cursos, perfis ou progresso real.
begin;
select set_config('test.jornada_pessoa_a', (select id::text from auth.users order by id limit 1), true);
select set_config('test.jornada_pessoa_b', (select id::text from auth.users order by id offset 1 limit 1), true);
do $$ begin
  if nullif(current_setting('test.jornada_pessoa_b'), '') is null then
    raise exception 'São necessárias duas contas para testar isolamento';
  end if;
end $$;

-- Remove apenas nesta transação os registros de teste escolhidos, caso existam.
delete from public.jornada_exploracao
where profile_id = current_setting('test.jornada_pessoa_a')::uuid;
select set_config('request.jwt.claim.sub', current_setting('test.jornada_pessoa_a'), true);
set local role authenticated;

insert into public.jornada_exploracao (etapa_id) values ('voluntario:boas-vindas')
on conflict (profile_id, etapa_id) do nothing;
insert into public.jornada_exploracao (etapa_id) values ('voluntario:boas-vindas')
on conflict (profile_id, etapa_id) do nothing;

do $$ begin
  if (select count(*) from public.jornada_exploracao) <> 1 then
    raise exception 'Falha na persistência ou deduplicação';
  end if;
  begin
    insert into public.jornada_exploracao (etapa_id) values ('xp-infinito');
    raise exception 'Etapa inválida foi aceita';
  exception when check_violation then null; end;
  begin
    update public.jornada_exploracao set etapa_id = 'docente:livro';
    raise exception 'Alteração de histórico foi aceita';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.jornada_exploracao;
    raise exception 'Exclusão de histórico foi aceita';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.jornada_pessoa_b'), true);
do $$ begin
  if exists (select 1 from public.jornada_exploracao where profile_id = current_setting('test.jornada_pessoa_a')::uuid) then
    raise exception 'Leitura de outra pessoa foi aceita';
  end if;
  begin
    insert into public.jornada_exploracao (profile_id, etapa_id)
    values (current_setting('test.jornada_pessoa_a')::uuid, 'docente:livro');
    raise exception 'Gravação para outra pessoa foi aceita';
  exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$ begin
  begin
    perform 1 from public.jornada_exploracao;
    raise exception 'Acesso anônimo foi aceito';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'Persistência, duplicatas, etapas válidas e RLS verificadas; transação desfeita' as resultado;

-- Executar: supabase db query --linked --file tests/db/reunioes-por-data.sql
-- Usa os perfis existentes apenas como contexto RLS; todo dado de teste sofre ROLLBACK.
begin;
set local statement_timeout = '20s';

do $$
declare coordenador uuid; outro uuid;
begin
  select id into strict coordenador from public.profiles where role='coordenador_geral' order by id limit 1;
  select id into strict outro from public.profiles where role<>'coordenador_geral' order by id limit 1;
  perform set_config('request.jwt.claim.sub',coordenador::text,true);
  perform set_config('test.outro_usuario',outro::text,true);
end
$$;
set local role authenticated;

do $$
declare
  primeira bigint;
  segunda bigint;
  separada bigint;
  atual public.reunioes;
  resumo_anterior text;
begin
  if exists(select 1 from public.reunioes where data_reuniao between '2099-12-27' and '2099-12-28') then
    raise exception 'Datas reservadas para este teste já estão ocupadas';
  end if;
  primeira := public.salvar_reuniao_por_data('{"titulo":"Reunião teste agendada","data_reuniao":"2099-12-27","horario":"19:00","status":"agendada","resumo":"Informação anterior.","decisoes":["A"]}');
  segunda := public.salvar_reuniao_por_data('{"titulo":"Ata teste realizada","data_reuniao":"2099-12-27","horario":"18:56","status":"realizada","resumo":"Informação nova.","decisoes":["A","B"]}');
  if primeira<>segunda then raise exception 'Mesmo dia gerou dois IDs'; end if;
  select * into strict atual from public.reunioes where id=primeira;
  if atual.horario<>'18:56'::time or atual.status<>'realizada' then raise exception 'Horário/status incorretos'; end if;
  if atual.resumo not like '%Informação anterior.%' or atual.resumo not like '%Informação nova.%' then
    raise exception 'Uma das atas perdeu conteúdo';
  end if;
  if atual.decisoes<>'["A","B"]'::jsonb then raise exception 'Decisões não foram unificadas'; end if;
  if atual.observacoes not like '%18:56:00 / 19:00:00%' then raise exception 'Horários originais não foram preservados'; end if;
  resumo_anterior:=atual.resumo;
  perform public.salvar_reuniao_por_data('{"titulo":"Ata teste realizada","data_reuniao":"2099-12-27","horario":"18:56","status":"realizada","resumo":"Informação nova.","decisoes":["A","B"]}');
  if (select resumo from public.reunioes where id=primeira)<>resumo_anterior then raise exception 'Reimportação duplicou conteúdo'; end if;
  perform public.salvar_reuniao_por_data('{"titulo":"Reunião teste agendada","data_reuniao":"2099-12-27","horario":"19:00","status":"agendada"}');
  if (select status from public.reunioes where id=primeira)<>'realizada' then raise exception 'Agendamento reverteu a ata pronta'; end if;
  separada := public.salvar_reuniao_por_data('{"titulo":"Outro dia","data_reuniao":"2099-12-28","horario":"18:56"}');
  if separada=primeira then raise exception 'Dias diferentes foram mesclados'; end if;
  begin
    insert into public.reunioes(titulo,data_reuniao) values('Duplicada','2099-12-27');
    raise exception 'Constraint permitiu duas reuniões no mesmo dia';
  exception when unique_violation then null;
  end;
  -- Outro usuário pode ler a ata, mas a RPC não pode ultrapassar a política de edição.
  perform set_config('request.jwt.claim.sub',current_setting('test.outro_usuario'),true);
  begin
    perform public.salvar_reuniao_por_data('{"titulo":"Sem permissão","data_reuniao":"2099-12-27","resumo":"Não deve ser salvo"}');
    raise exception 'RLS permitiu mesclar ata de outro usuário';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;
rollback;

-- Uma reunião por dia, independentemente do horário de início ou do status.
-- A consolidação preserva os IDs mais antigos, todos os vínculos e os dados originais.
create or replace function public.mesclar_texto_reuniao(anterior text, novo text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case
    when nullif(btrim(anterior), '') is null then nullif(btrim(novo), '')
    when nullif(btrim(novo), '') is null then anterior
    when strpos(anterior, btrim(novo)) > 0 then anterior
    when strpos(novo, btrim(anterior)) > 0 then novo
    else anterior || E'\n\n' || novo
  end
$$;

create or replace function public.mesclar_campos_reuniao(anterior jsonb, novo jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare
  resultado jsonb := anterior;
  campo text;
  texto text;
  itens jsonb;
  hora_anterior time := nullif(anterior->>'horario', '')::time;
  hora_nova time := nullif(novo->>'horario', '')::time;
begin
  foreach campo in array array['resumo','participantes','pontos_principais','deliberacoes',
    'texto','arquivo_nome','duracao','formato','conducao','observacoes'] loop
    texto := public.mesclar_texto_reuniao(anterior->>campo, novo->>campo);
    resultado := jsonb_set(resultado, array[campo], coalesce(to_jsonb(texto), 'null'::jsonb));
  end loop;
  foreach campo in array array['saidas_antecipadas','decisoes','calendario'] loop
    select coalesce(jsonb_agg(valor order by primeira), '[]'::jsonb) into itens
    from (
      select valor, min(ordem) as primeira
      from jsonb_array_elements(
        (case when jsonb_typeof(anterior->campo) = 'array' then anterior->campo else '[]'::jsonb end) ||
        (case when jsonb_typeof(novo->campo) = 'array' then novo->campo else '[]'::jsonb end)
      ) with ordinality as e(valor, ordem)
      group by valor
    ) unicos;
    resultado := jsonb_set(resultado, array[campo], itens);
  end loop;
  -- O horário mais cedo fica no cabeçalho; os horários distintos continuam registrados.
  resultado := jsonb_set(resultado, '{horario}', coalesce(to_jsonb(least(hora_anterior, hora_nova)), 'null'::jsonb));
  if hora_anterior is not null and hora_nova is not null and hora_anterior <> hora_nova then
    texto := 'Horários informados nas atas: ' || least(hora_anterior,hora_nova)::text || ' / ' || greatest(hora_anterior,hora_nova)::text;
    resultado := jsonb_set(resultado, '{observacoes}', to_jsonb(public.mesclar_texto_reuniao(resultado->>'observacoes', texto)));
  end if;
  resultado := jsonb_set(resultado, '{proxima_reuniao}', coalesce(nullif(novo->'proxima_reuniao', 'null'::jsonb), anterior->'proxima_reuniao', 'null'::jsonb));
  if nullif(novo->>'proxima_reuniao','') is not null and nullif(anterior->>'proxima_reuniao','') is not null
    and novo->>'proxima_reuniao' <> anterior->>'proxima_reuniao' then
    texto := 'Próximas datas informadas: ' || (anterior->>'proxima_reuniao') || ' / ' || (novo->>'proxima_reuniao');
    resultado := jsonb_set(resultado, '{observacoes}', to_jsonb(public.mesclar_texto_reuniao(resultado->>'observacoes', texto)));
  end if;
  if nullif(anterior->>'titulo','') is null or (anterior->>'status' = 'agendada' and novo->>'status' = 'realizada') then
    resultado := jsonb_set(resultado, '{titulo}', coalesce(novo->'titulo', anterior->'titulo'));
  elsif nullif(novo->>'titulo','') is not null and novo->>'titulo' <> anterior->>'titulo' and novo->>'status' = 'realizada' then
    resultado := jsonb_set(resultado, '{observacoes}', to_jsonb(public.mesclar_texto_reuniao(resultado->>'observacoes', 'Título em outra importação: ' || (novo->>'titulo'))));
  end if;
  resultado := jsonb_set(resultado, '{status}', to_jsonb(case
    when anterior->>'status' = 'realizada' or novo->>'status' = 'realizada' then 'realizada'
    else coalesce(nullif(novo->>'status',''), anterior->>'status', 'agendada') end));
  return resultado;
end
$$;

revoke all on function public.mesclar_texto_reuniao(text,text) from public, anon;
revoke all on function public.mesclar_campos_reuniao(jsonb,jsonb) from public, anon;
grant execute on function public.mesclar_texto_reuniao(text,text) to authenticated;
grant execute on function public.mesclar_campos_reuniao(jsonb,jsonb) to authenticated;

-- Arquivo privado: permite recuperar integralmente qualquer registro consolidado.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.reunioes_antes_mesclagem (
  id_original bigint primary key,
  id_definitivo bigint not null,
  dados jsonb not null,
  arquivado_em timestamptz not null default now()
);
alter table private.reunioes_antes_mesclagem enable row level security;
revoke all on private.reunioes_antes_mesclagem from public, anon, authenticated;

lock table public.reunioes, public.ata_participantes, public.dips, public.pautas,
  public.demandas, public.eventos, public.demanda_comentarios in share row exclusive mode;

create temporary table reunioes_a_mesclar on commit drop as
select id, min(id) over(partition by data_reuniao) as manter_id
from public.reunioes
where data_reuniao in (select data_reuniao from public.reunioes group by data_reuniao having count(*) > 1);

insert into private.reunioes_antes_mesclagem(id_original,id_definitivo,dados)
select r.id,m.manter_id,to_jsonb(r) from public.reunioes r join reunioes_a_mesclar m on m.id=r.id;

do $$
declare
  par record;
  atual public.reunioes;
  duplicada public.reunioes;
  mesclada public.reunioes;
begin
  for par in select * from reunioes_a_mesclar where id <> manter_id order by manter_id,id loop
    select * into atual from public.reunioes where id=par.manter_id;
    select * into duplicada from public.reunioes where id=par.id;
    mesclada := jsonb_populate_record(null::public.reunioes, public.mesclar_campos_reuniao(to_jsonb(atual),to_jsonb(duplicada)));
    update public.reunioes set titulo=mesclada.titulo, horario=mesclada.horario,
      resumo=mesclada.resumo, participantes=mesclada.participantes, pontos_principais=mesclada.pontos_principais,
      deliberacoes=mesclada.deliberacoes, texto=mesclada.texto, arquivo_nome=mesclada.arquivo_nome,
      duracao=mesclada.duracao, formato=mesclada.formato, conducao=mesclada.conducao,
      proxima_reuniao=mesclada.proxima_reuniao, saidas_antecipadas=mesclada.saidas_antecipadas,
      decisoes=mesclada.decisoes, calendario=mesclada.calendario, observacoes=mesclada.observacoes,
      status=mesclada.status where id=par.manter_id;
  end loop;
end
$$;

insert into public.ata_participantes(ata_id,voluntario_id,criado_por,created_at)
select m.manter_id,p.voluntario_id,p.criado_por,p.created_at
from public.ata_participantes p join reunioes_a_mesclar m on m.id=p.ata_id
where m.id <> m.manter_id on conflict(ata_id,voluntario_id) do nothing;

update public.dips d set ata_id=m.manter_id from reunioes_a_mesclar m where d.ata_id=m.id and m.id<>m.manter_id;
update public.pautas p set ata_id=m.manter_id from reunioes_a_mesclar m where p.ata_id=m.id and m.id<>m.manter_id;
update public.pautas p set ata_discutida_id=m.manter_id from reunioes_a_mesclar m where p.ata_discutida_id=m.id and m.id<>m.manter_id;
update public.pautas p set reuniao_selecionada_id=m.manter_id from reunioes_a_mesclar m where p.reuniao_selecionada_id=m.id and m.id<>m.manter_id;
update public.demandas d set origem_ata_id=m.manter_id from reunioes_a_mesclar m where d.origem_ata_id=m.id and m.id<>m.manter_id;
update public.eventos e set origem_ata_id=m.manter_id from reunioes_a_mesclar m where e.origem_ata_id=m.id and m.id<>m.manter_id;
update public.demanda_comentarios c set origem_ata_id=m.manter_id from reunioes_a_mesclar m where c.origem_ata_id=m.id and m.id<>m.manter_id;
delete from public.reunioes r using reunioes_a_mesclar m where r.id=m.id and m.id<>m.manter_id;

alter table public.reunioes add constraint reunioes_data_reuniao_unique unique(data_reuniao);

-- Inserção/mesclagem na mesma transação. SECURITY INVOKER mantém as políticas RLS.
create or replace function public.salvar_reuniao_por_data(p_dados jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  entrada public.reunioes;
  atual public.reunioes;
  mesclada public.reunioes;
  resultado bigint;
begin
  if (select auth.uid()) is null then raise exception 'Sessão expirada' using errcode='42501'; end if;
  entrada := jsonb_populate_record(null::public.reunioes,p_dados);
  if entrada.data_reuniao is null or nullif(btrim(entrada.titulo),'') is null then
    raise exception 'Informe o título e a data da reunião' using errcode='22023';
  end if;
  insert into public.reunioes(titulo,data_reuniao,horario,resumo,participantes,pontos_principais,deliberacoes,
    texto,arquivo_nome,duracao,formato,conducao,proxima_reuniao,saidas_antecipadas,decisoes,calendario,observacoes,status)
  values(entrada.titulo,entrada.data_reuniao,entrada.horario,entrada.resumo,entrada.participantes,
    entrada.pontos_principais,entrada.deliberacoes,entrada.texto,entrada.arquivo_nome,entrada.duracao,
    entrada.formato,entrada.conducao,entrada.proxima_reuniao,coalesce(entrada.saidas_antecipadas,'[]'::jsonb),
    coalesce(entrada.decisoes,'[]'::jsonb),coalesce(entrada.calendario,'[]'::jsonb),entrada.observacoes,coalesce(entrada.status,'realizada'))
  on conflict(data_reuniao) do nothing returning id into resultado;
  if resultado is not null then return resultado; end if;
  select * into atual from public.reunioes where data_reuniao=entrada.data_reuniao for update;
  if not found then raise exception 'Sem permissão para mesclar esta reunião' using errcode='42501'; end if;
  mesclada := jsonb_populate_record(null::public.reunioes,public.mesclar_campos_reuniao(to_jsonb(atual),p_dados));
  update public.reunioes set titulo=mesclada.titulo,horario=mesclada.horario,resumo=mesclada.resumo,
    participantes=mesclada.participantes,pontos_principais=mesclada.pontos_principais,deliberacoes=mesclada.deliberacoes,
    texto=mesclada.texto,arquivo_nome=mesclada.arquivo_nome,duracao=mesclada.duracao,formato=mesclada.formato,
    conducao=mesclada.conducao,proxima_reuniao=mesclada.proxima_reuniao,saidas_antecipadas=mesclada.saidas_antecipadas,
    decisoes=mesclada.decisoes,calendario=mesclada.calendario,observacoes=mesclada.observacoes,status=mesclada.status
  where id=atual.id returning id into resultado;
  if resultado is null then raise exception 'Sem permissão para atualizar esta reunião' using errcode='42501'; end if;
  return resultado;
end
$$;
revoke all on function public.salvar_reuniao_por_data(jsonb) from public, anon;
grant execute on function public.salvar_reuniao_por_data(jsonb) to authenticated;

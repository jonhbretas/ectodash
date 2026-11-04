create function public.finance_move_import(p_import uuid,p_month date) returns void
language plpgsql security invoker set search_path='' as $$
declare source public.finance_imports;
begin
  if auth.uid() is null or not public.pode_acessar_financeiro() then raise exception 'Sem acesso ao financeiro.'; end if;
  if extract(day from p_month)<>1 then raise exception 'Competência inválida.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(136034,1);
  select * into source from public.finance_imports where id=p_import for update;
  if source.id is null or source.status='PROCESSING' then raise exception 'Documento indisponível.'; end if;
  if exists(select 1 from public.finance_periods where status='FECHADO' and competencia=p_month) then raise exception 'Competência de destino fechada.'; end if;
  update public.finance_imports set metadata=jsonb_set(metadata,'{competencia}',to_jsonb(to_char(p_month,'YYYY-MM'))) where id=source.id;
  update public.finance_exceptions set status='RESOLVED',resolved_by=auth.uid(),resolved_at=now()
    where import_id=source.id and status='OPEN' and problem like 'Período fora da competência%';
  if exists(select 1 from public.finance_ledger where import_id=source.id and reconciliation_status not in ('IGNORADO','DUPLICADO') and date_trunc('month',movement_date)::date<>p_month) then
    insert into public.finance_exceptions(import_id,problem,affected_amount,recommendation)
      values(source.id,'Período fora da competência: o documento ainda contém movimentos de outras competências.',0,'Confira as datas antes de confirmar a competência.');
  end if;
  insert into public.finance_audit_log(import_id,action,actor,before_data,after_data)
    values(source.id,'IMPORT_PERIOD_ADJUSTED',auth.uid()::text,jsonb_build_object('competencia',source.metadata->>'competencia'),jsonb_build_object('competencia',to_char(p_month,'YYYY-MM')));
end $$;
revoke execute on function public.finance_move_import(uuid,date) from public,anon;
grant execute on function public.finance_move_import(uuid,date) to authenticated;

create or replace function public.finance_ai_merge_duplicate(p_exception uuid,p_ledger uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare pending public.finance_exceptions; target public.finance_ledger; alternative jsonb; source_row jsonb;
begin
  if auth.uid() is null or not public.pode_acessar_financeiro() then raise exception 'Sem acesso ao financeiro.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(136034,1);
  select * into pending from public.finance_exceptions where id=p_exception for update;
  select * into target from public.finance_ledger where id=p_ledger for update;
  if pending.id is null or pending.status<>'OPEN' or target.id is null then raise exception 'Pendência ou lançamento indisponível.'; end if;
  select a into alternative from jsonb_array_elements(pending.alternatives) a where a->>'kind'='POSSIBLE_DUPLICATE' and a->'candidates' @> jsonb_build_array(jsonb_build_object('id',p_ledger)) limit 1;
  source_row:=alternative->'row';
  if alternative is null or target.type<>source_row->>'type' or target.movement_date<>(source_row->>'date')::date or target.net_amount<>(source_row->>'net')::numeric or target.reconciliation_status in ('DUPLICADO','IGNORADO') then raise exception 'O candidato mudou; confira novamente.'; end if;
  if target.external_transaction_id is not null and source_row->>'externalId' is not null and target.external_transaction_id<>source_row->>'externalId' then raise exception 'IDs de transação distintos; escolha o registro correspondente.'; end if;
  update public.finance_ledger set external_transaction_id=coalesce(external_transaction_id,source_row->>'externalId'),expected_date=coalesce(expected_date,(source_row->>'expectedDate')::date),updated_at=now() where id=target.id;
  insert into public.finance_audit_log(ledger_id,import_id,action,actor,before_data,after_data) values(target.id,pending.import_id,'AI_DUPLICATE_MERGED',auth.uid()::text,to_jsonb(target),jsonb_build_object('exception_id',pending.id,'source_row',source_row));
  update public.finance_exceptions set status='RESOLVED',resolved_by=auth.uid(),resolved_at=now() where id=pending.id;
end $$;

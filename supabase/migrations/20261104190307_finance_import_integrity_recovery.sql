-- Ledger, exceptions, audit and final status must commit together. In mixed
-- PostgREST batches missing fields otherwise become SQL NULL, not DEFAULT.
create function public.finance_commit_import(p_import uuid, p_rows jsonb, p_exceptions jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare source public.finance_imports; item jsonb;
begin
  if auth.uid() is null or not public.pode_acessar_financeiro() then raise exception 'Sem acesso ao financeiro.'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_typeof(p_exceptions) is distinct from 'array' then raise exception 'Lote inválido.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(136034,1);
  select * into source from public.finance_imports where id=p_import for update;
  if source.id is null or source.status <> 'PROCESSING' then raise exception 'Importação indisponível.'; end if;
  if exists(select 1 from public.finance_ledger where import_id=p_import) then raise exception 'Importação já contém lançamentos; não será duplicada.'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    insert into public.finance_ledger select (jsonb_populate_record(null::public.finance_ledger,
      jsonb_build_object('currency','BRL','reconciliation_status','PENDENTE','gross_amount',0,'fee_amount',0,'tax_amount',0,'refund_amount',0,'chargeback_amount',0,'net_amount',0,'inflow',0,'outflow',0,'confidence',0)
      || item || jsonb_build_object('id',coalesce((item->>'id')::uuid,gen_random_uuid()),'import_id',p_import,'created_by','importer','created_at',now(),'updated_at',now()))).*;
  end loop;
  delete from public.finance_exceptions where import_id=p_import and status='OPEN';
  for item in select value from jsonb_array_elements(p_exceptions) loop
    insert into public.finance_exceptions select (jsonb_populate_record(null::public.finance_exceptions,
      jsonb_build_object('ledger_ids','[]'::jsonb,'alternatives','[]'::jsonb,'revenue_impact',0,'balance_impact',0)
      || item || jsonb_build_object('id',gen_random_uuid(),'import_id',p_import,'affected_amount',coalesce((item->>'affected_amount')::numeric,0),'status','OPEN','created_at',now()))).*;
  end loop;
  insert into public.finance_audit_log(import_id,action,actor,after_data) values(p_import,'IMPORT_PROCESSED',auth.uid()::text,jsonb_build_object('rows',jsonb_array_length(p_rows),'exceptions',jsonb_array_length(p_exceptions)));
  update public.finance_imports set status=case when jsonb_array_length(p_exceptions)>0 then 'PARTIAL' else 'PROCESSED' end,
    error_message=null,row_count=jsonb_array_length(p_rows),processed_at=now() where id=p_import;
end $$;
revoke execute on function public.finance_commit_import(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.finance_commit_import(uuid,jsonb,jsonb) to authenticated;

-- Repair only machine-generated, unreviewed, unreconciled records in open
-- periods, preserving every old value in the audit trail.
do $$
declare source public.finance_imports; entry public.finance_ledger; problem_text text; position boolean; was_failed boolean;
begin
  for source in select i.* from public.finance_imports i where i.metadata->'ai_document' is not null
    and not exists(select 1 from public.finance_periods p where p.status='FECHADO' and to_char(p.competencia,'YYYY-MM')=i.metadata->>'competencia')
    and not exists(select 1 from public.finance_audit_log a where a.import_id=i.id and a.action in ('MANUAL_REVIEW','PERIOD_CONFIRMED','AI_DUPLICATE_MERGED','AI_NOTE_MANUALLY_REVIEWED'))
    and not exists(select 1 from public.finance_ledger l join public.finance_periods p on p.competencia=date_trunc('month',l.movement_date)::date and p.status='FECHADO' where l.import_id=i.id)
    and not exists(select 1 from public.finance_reconciliation_items r join public.finance_ledger l on l.id=r.ledger_id where l.import_id=i.id)
    and not exists(select 1 from public.finance_ledger l where l.import_id=i.id and (l.created_by<>'importer' or l.reconciliation_status<>'PENDENTE'))
  loop
    position := exists(select 1 from jsonb_array_elements_text(coalesce(source.metadata->'ai_document'->'findings','[]')) f where f ~* 'documento de posi[çc][ãa]o de aplica|n[ãa]o comprovam resgate');
    was_failed := source.status='FAILED' and source.error_message like 'null value in column "affected_amount"%' and
      (select count(*) from public.finance_ledger where import_id=source.id)=source.row_count;
    if position then
      for entry in select * from public.finance_ledger where import_id=source.id loop
        insert into public.finance_audit_log(ledger_id,import_id,action,actor,before_data,after_data) values(entry.id,source.id,'POSITION_CASHFLOW_CORRECTED','system:finance-reading-v2',to_jsonb(entry),'{"reconciliation_status":"IGNORADO","reason":"Posição de investimento não comprova movimentação de caixa."}');
        update public.finance_ledger set reconciliation_status='IGNORADO',updated_at=now() where id=entry.id;
      end loop;
      update public.finance_imports set source_type='INVESTMENT',row_count=0,metadata=jsonb_set(metadata,'{ai_document,kind}','"POSICAO_INVESTIMENTO"') where id=source.id;
    elsif source.metadata->'ai_document'->>'kind'='EXTRATO' then
      for entry in select * from public.finance_ledger where import_id=source.id and type='RECEITA_FATURADA' loop
        insert into public.finance_audit_log(ledger_id,import_id,action,actor,before_data,after_data) values(entry.id,source.id,'BANK_CREDIT_CLASSIFICATION_CORRECTED','system:finance-reading-v2',to_jsonb(entry),jsonb_build_object('type','RECEITA_RECEBIDA','inflow',entry.net_amount));
        update public.finance_ledger set type='RECEITA_RECEBIDA',inflow=net_amount,outflow=0,updated_at=now(),classification_explanation='Crédito em extrato bancário é recebimento efetivo, não novo faturamento.' where id=entry.id;
      end loop;
    end if;
    -- Legacy findings were observations, not typed extraction errors. Preserve
    -- them visibly as information; retain structural warnings separately.
    update public.finance_imports set metadata=metadata || jsonb_build_object('information',coalesce(metadata->'ai_document'->'findings','[]'), 'warnings',
      coalesce((select jsonb_agg(w) from jsonb_array_elements_text(coalesce(source.metadata->'warnings','[]')) w
        where not coalesce(source.metadata->'ai_document'->'findings','[]') ? w and not(position and w like 'Período fora da competência%')),'[]'::jsonb)) where id=source.id;
    update public.finance_exceptions set status='RESOLVED',resolved_at=now(),recommendation='Observação documental preservada em Informações; não requer criação de lançamento.'
      where import_id=source.id and status='OPEN' and cardinality(ledger_ids)=0 and
      (coalesce(source.metadata->'ai_document'->'findings','[]') ? problem or (position and problem like 'Período fora da competência%'));
    if was_failed then
      for problem_text in select jsonb_array_elements_text(metadata->'warnings') from public.finance_imports where id=source.id loop
        if not exists(select 1 from public.finance_exceptions e where e.import_id=source.id and e.problem=problem_text and e.status='OPEN') then
          insert into public.finance_exceptions(import_id,problem,affected_amount) values(source.id,problem_text,0);
        end if;
      end loop;
      insert into public.finance_exceptions(import_id,problem,affected_amount,ledger_ids)
        select source.id,'Classificação com baixa confiança: '||l.original_description,l.net_amount,array[l.id] from public.finance_ledger l
        where l.import_id=source.id and l.confidence<0.8 and not exists(select 1 from public.finance_exceptions e where e.import_id=source.id and l.id=any(e.ledger_ids));
      update public.finance_imports set status=case when exists(select 1 from public.finance_exceptions where import_id=source.id and status='OPEN') then 'PARTIAL' else 'PROCESSED' end,error_message=null where id=source.id;
      insert into public.finance_audit_log(import_id,action,actor,after_data) values(source.id,'IMPORT_EXCEPTIONS_RECOVERED','system:finance-reading-v2',jsonb_build_object('preserved_rows',source.row_count));
    elsif source.status='PARTIAL' and not exists(select 1 from public.finance_exceptions where import_id=source.id and status='OPEN') then
      update public.finance_imports set status='PROCESSED' where id=source.id;
    end if;
  end loop;
end $$;

create or replace view public.finance_consolidated_balance with (security_invoker = true) as
select coalesce(sum(inflow-outflow) filter(where type not in ('TRANSFERENCIA_INTERNA','SALDO_FINAL')),0) as consolidated_balance,
  coalesce(sum(gross_amount-fee_amount-tax_amount-refund_amount-chargeback_amount) filter(where type='RECEITA_FATURADA'),0) as net_billing,
  coalesce(sum(inflow) filter(where type='RECEITA_RECEBIDA'),0) as received,
  coalesce(sum(outflow) filter(where type='DESPESA'),0) as expenses
from public.finance_ledger where reconciliation_status not in ('IGNORADO','DUPLICADO');
create or replace view public.finance_receivables with (security_invoker = true) as
select l.provider_id,l.company_id,coalesce(sum(l.net_amount),0) as billed,
  coalesce(sum(case when l.reconciliation_status in ('CONCILIADO','PARCIALMENTE_CONCILIADO') then l.net_amount else 0 end),0) as received,
  coalesce(sum(l.net_amount),0)-coalesce(sum(case when l.reconciliation_status in ('CONCILIADO','PARCIALMENTE_CONCILIADO') then l.net_amount else 0 end),0) as outstanding
from public.finance_ledger l where l.type='RECEITA_FATURADA' and l.reconciliation_status not in ('IGNORADO','DUPLICADO') group by l.provider_id,l.company_id;

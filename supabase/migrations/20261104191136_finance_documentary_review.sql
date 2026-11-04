create function public.finance_acknowledge_exception(p_exception uuid,p_reason text) returns void
language plpgsql security invoker set search_path='' as $$
declare pending public.finance_exceptions; source public.finance_imports;
begin
  if auth.uid() is null or not public.pode_acessar_financeiro() then raise exception 'Sem acesso ao financeiro.'; end if;
  if p_reason is null or length(trim(p_reason))<20 then raise exception 'Explique como a pendência foi conferida.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(136034,1);
  select * into pending from public.finance_exceptions where id=p_exception for update;
  if pending.id is null or pending.status<>'OPEN' or cardinality(pending.ledger_ids)>0
    or exists(select 1 from jsonb_array_elements(pending.alternatives) a where a->>'kind'='POSSIBLE_DUPLICATE') then raise exception 'Esta pendência exige corrigir ou mesclar o lançamento.'; end if;
  select * into source from public.finance_imports where id=pending.import_id;
  if source.id is null or source.status not in ('PROCESSED','PARTIAL') then raise exception 'Conclua o processamento antes de conferir.'; end if;
  update public.finance_exceptions set status='RESOLVED',resolved_by=auth.uid(),resolved_at=now() where id=pending.id;
  insert into public.finance_audit_log(import_id,action,actor,before_data,after_data)
    values(source.id,'DOCUMENT_EXCEPTION_REVIEWED',auth.uid()::text,to_jsonb(pending),jsonb_build_object('reason',trim(p_reason),'created_ledger_rows',0));
end $$;
revoke execute on function public.finance_acknowledge_exception(uuid,text) from public,anon;
grant execute on function public.finance_acknowledge_exception(uuid,text) to authenticated;

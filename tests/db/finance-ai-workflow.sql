-- Live integration verification: every fixture and audit entry is rolled back.
begin;
do $$
declare actor uuid;
begin
  select id into actor from public.profiles where role = 'coordenador_geral' limit 1;
  if actor is null then raise exception 'Integration test needs an existing coordination profile.'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$
declare
  source uuid; second_source uuid; note_source uuid; billed uuid; received uuid; pending uuid;
  report_id uuid; closed_id uuid; pair uuid; rejected boolean; ledger_count bigint;
begin
  insert into public.finance_imports(file_name,file_sha256,mime_type,file_size,status,metadata,created_by)
    values ('finance-ai-integration.csv',gen_random_uuid()::text,'text/csv',100,'PROCESSED','{"competencia":"2099-11"}',auth.uid()) returning id into source;
  insert into public.finance_imports(file_name,file_sha256,mime_type,file_size,status,metadata,created_by)
    values ('finance-ai-integration-copy.pdf',gen_random_uuid()::text,'application/pdf',100,'PARTIAL','{"competencia":"2099-11"}',auth.uid()) returning id into second_source;
  insert into public.finance_ledger(import_id,file_name,line_hash,movement_date,type,original_description,normalized_description,gross_amount,net_amount,inflow,confidence)
    values (source,'test',gen_random_uuid()::text,'2099-11-01','RECEITA_FATURADA','Venda','venda',100,100,0,.95) returning id into billed;
  insert into public.finance_ledger(import_id,file_name,line_hash,movement_date,type,original_description,normalized_description,gross_amount,net_amount,inflow,confidence)
    values (source,'test',gen_random_uuid()::text,'2099-11-02','RECEITA_RECEBIDA','Deposito','deposito',100,100,100,.95) returning id into received;
  pair := public.finance_ai_reconcile(billed,received);
  if (select count(*) from public.finance_reconciliation_items where reconciliation_id = pair) <> 2 then raise exception 'Reconciliation did not link both rows.'; end if;
  if (select count(*) from public.finance_ledger where id in (billed,received) and reconciliation_status = 'CONCILIADO') <> 2 then raise exception 'Reconciliation did not update statuses.'; end if;
  rejected := false;
  begin perform public.finance_ai_reconcile(billed,received); exception when others then rejected := true; end;
  if not rejected then raise exception 'Reconciliation accepted an already linked row.'; end if;

  insert into public.finance_exceptions(import_id,problem,alternatives)
    values (second_source,'Possible duplicate',jsonb_build_array(jsonb_build_object('kind','POSSIBLE_DUPLICATE','row',jsonb_build_object('type','RECEITA_RECEBIDA','date','2099-11-02','net',100),'candidates',jsonb_build_array(jsonb_build_object('id',received))))) returning id into pending;
  select count(*) into ledger_count from public.finance_ledger;
  perform public.finance_ai_merge_duplicate(pending,received);
  if (select count(*) from public.finance_ledger) <> ledger_count then raise exception 'Merging duplicated a monetary entry.'; end if;
  if (select status from public.finance_exceptions where id = pending) <> 'RESOLVED' then raise exception 'Merge did not resolve exception.'; end if;

  insert into public.finance_imports(file_name,file_sha256,mime_type,file_size,status,metadata,created_by)
    values ('finance-ai-note.pdf',gen_random_uuid()::text,'application/pdf',100,'PARTIAL','{"competencia":"2099-11","ai_document":{"kind":"NOTA_FISCAL","findings":["missing"]}}',auth.uid()) returning id into note_source;
  insert into public.finance_exceptions(import_id,problem) values (note_source,'Missing note data');
  perform public.finance_ai_review_note(note_source,'2099-11-01','{"number":"123","issuer":"Fixture","issuerDocument":"12345678901234","issueDate":"2099-11-01","total":100}');
  if exists(select 1 from public.finance_exceptions where import_id = note_source and status = 'OPEN') then raise exception 'Note correction did not resolve its documentary warning.'; end if;
  if (select metadata->'ai_document'->>'number' from public.finance_imports where id = note_source) <> '123' then raise exception 'Corrected note missing.'; end if;

  insert into public.finance_ai_reports(competencia,analysis_year,input_fingerprint,report,model,created_by)
    values ('2099-11-01',2099,'stale','{"blockers":[]}','integration-test',auth.uid()) returning id into report_id;
  rejected := false;
  begin perform public.finance_ai_close(report_id,true); exception when others then rejected := true; end;
  if not rejected then raise exception 'Closing accepted a stale report.'; end if;
  update public.finance_ai_reports set input_fingerprint = public.finance_ai_fingerprint('2099-11-01') where id = report_id;
  rejected := false;
  begin perform public.finance_ai_close(report_id,false); exception when others then rejected := true; end;
  if not rejected then raise exception 'Closing accepted incomplete documents.'; end if;
  closed_id := public.finance_ai_close(report_id,true);
  if (select status from public.finance_periods where id = closed_id) <> 'FECHADO' then raise exception 'Period did not close.'; end if;
  if public.finance_ai_close(report_id,true) <> closed_id then raise exception 'Repeat closing must be idempotent.'; end if;
  rejected := false;
  begin update public.finance_ledger set net_amount = 101 where id = received; exception when others then rejected := true; end;
  if not rejected then raise exception 'A closed ledger row was editable.'; end if;
  rejected := false;
  begin insert into public.finance_imports(file_name,file_sha256,mime_type,file_size,metadata) values ('closed',gen_random_uuid()::text,'text/csv',1,'{"competencia":"2099-11"}'); exception when others then rejected := true; end;
  if not rejected then raise exception 'A closed month accepted a new import.'; end if;
  rejected := false;
  begin delete from public.finance_reconciliation_items where reconciliation_id = pair; exception when others then rejected := true; end;
  if not rejected then raise exception 'Closed reconciliation links were mutable.'; end if;
  if has_function_privilege('anon','public.finance_ai_close(uuid,boolean)','EXECUTE') then raise exception 'Anonymous role can close periods.'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  if exists(select 1 from public.finance_ai_reports where id = report_id) then raise exception 'RLS exposed financial reports to an unauthorized user.'; end if;
  rejected := false;
  begin perform public.finance_ai_close(report_id,true); exception when others then rejected := true; end;
  if not rejected then raise exception 'An unauthorized user could close a period.'; end if;
end $$;
rollback;

create function public.finance_ai_review_note(p_import uuid, p_month date, p_fields jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare source public.finance_imports; checked_date date;
begin
  if auth.uid() is null or not public.pode_acessar_financeiro() then raise exception 'Sem acesso ao financeiro.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(136034, 1);
  select * into source from public.finance_imports where id = p_import for update;
  if source.id is null or source.metadata->>'competencia' <> to_char(p_month,'YYYY-MM') or source.metadata->'ai_document'->>'kind' <> 'NOTA_FISCAL' then raise exception 'Nota indisponível nesta competência.'; end if;
  if coalesce(length(trim(p_fields->>'number')),0) = 0 or coalesce(length(trim(p_fields->>'issuer')),0) = 0 or coalesce(length(p_fields->>'issuerDocument'),0) < 11
    or coalesce(p_fields->>'issueDate','') !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(p_fields->'total') is distinct from 'number' or (p_fields->>'total')::numeric < 0 then raise exception 'Preencha número, emitente, documento, data e total.'; end if;
  checked_date := (p_fields->>'issueDate')::date;
  update public.finance_imports set metadata = jsonb_set(metadata,'{ai_document}',
    (metadata->'ai_document') || (p_fields - 'kind' - 'transactions') || '{"kind":"NOTA_FISCAL","complete":true,"findings":[]}'::jsonb) || jsonb_build_object('note_reviewed_by',auth.uid(),'note_reviewed_at',now()) where id = source.id;
  update public.finance_exceptions set status = 'RESOLVED', resolved_by = auth.uid(), resolved_at = now()
    where import_id = source.id and status = 'OPEN' and cardinality(ledger_ids) = 0 and problem not like 'Período fora da competência%'
      and not exists (select 1 from jsonb_array_elements(alternatives) a where a->>'kind' = 'POSSIBLE_DUPLICATE');
  insert into public.finance_audit_log(import_id,action,actor,before_data,after_data)
    values (source.id,'AI_NOTE_MANUALLY_REVIEWED',auth.uid()::text,source.metadata->'ai_document',p_fields);
end $$;
revoke execute on function public.finance_ai_review_note(uuid,date,jsonb) from public, anon;
grant execute on function public.finance_ai_review_note(uuid,date,jsonb) to authenticated;

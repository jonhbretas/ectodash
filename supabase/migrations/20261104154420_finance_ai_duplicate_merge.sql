create function public.finance_ai_merge_duplicate(p_exception uuid, p_ledger uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare pending public.finance_exceptions; target public.finance_ledger; alternative jsonb;
begin
  if auth.uid() is null or not public.pode_acessar_financeiro() then raise exception 'Sem acesso ao financeiro.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(136034, 1);
  select * into pending from public.finance_exceptions where id = p_exception for update;
  select * into target from public.finance_ledger where id = p_ledger for update;
  if pending.id is null or pending.status <> 'OPEN' or target.id is null then raise exception 'Pendência ou lançamento indisponível.'; end if;
  select a into alternative from jsonb_array_elements(pending.alternatives) a
    where a->>'kind' = 'POSSIBLE_DUPLICATE' and a->'candidates' @> jsonb_build_array(jsonb_build_object('id',p_ledger)) limit 1;
  if alternative is null or target.type <> alternative->'row'->>'type' or target.movement_date <> (alternative->'row'->>'date')::date
    or target.net_amount <> (alternative->'row'->>'net')::numeric
    or target.reconciliation_status in ('DUPLICADO','IGNORADO') then raise exception 'O candidato mudou; confira novamente.'; end if;
  if exists (select 1 from public.finance_periods where competencia = date_trunc('month',target.movement_date)::date and status = 'FECHADO') then raise exception 'O período do lançamento está fechado.'; end if;
  -- Preserve the existing monetary record; append provenance and review audit.
  insert into public.finance_audit_log(ledger_id,import_id,action,actor,after_data)
    values (target.id,pending.import_id,'AI_DUPLICATE_MERGED',auth.uid()::text,jsonb_build_object('exception_id',pending.id,'source_row',alternative->'row'));
  update public.finance_exceptions set status = 'RESOLVED', resolved_by = auth.uid(), resolved_at = now() where id = pending.id;
end $$;
revoke execute on function public.finance_ai_merge_duplicate(uuid,uuid) from public, anon;
grant execute on function public.finance_ai_merge_duplicate(uuid,uuid) to authenticated;
create index finance_imports_competencia_lookup on public.finance_imports ((metadata->>'competencia'));

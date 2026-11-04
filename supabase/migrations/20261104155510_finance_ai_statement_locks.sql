-- Acquire the shared lock before row locks, avoiding lock-order inversions
-- between direct Data API updates and the transactional RPC functions.
create function public.finance_ai_statement_lock() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(136034, 1);
  return null;
end $$;
revoke execute on function public.finance_ai_statement_lock() from public, anon, authenticated;
create trigger finance_ai_import_statement_lock before insert or update or delete on public.finance_imports for each statement execute function public.finance_ai_statement_lock();
create trigger finance_ai_ledger_statement_lock before insert or update or delete on public.finance_ledger for each statement execute function public.finance_ai_statement_lock();
create trigger finance_ai_exception_statement_lock before insert or update or delete on public.finance_exceptions for each statement execute function public.finance_ai_statement_lock();
create trigger finance_ai_period_statement_lock before insert or update or delete on public.finance_periods for each statement execute function public.finance_ai_statement_lock();

create function public.finance_ai_reconciliation_item_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.finance_ledger l join public.finance_imports i on i.id = l.import_id
      join public.finance_periods p on p.status = 'FECHADO' and
        (p.competencia = date_trunc('month',l.movement_date)::date or to_char(p.competencia,'YYYY-MM') = i.metadata->>'competencia')
    where l.id in (case when tg_op <> 'DELETE' then new.ledger_id end, case when tg_op <> 'INSERT' then old.ledger_id end)
  ) then raise exception 'Conciliação de período fechado não pode ser alterada.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.finance_ai_reconciliation_item_guard() from public, anon, authenticated;
create trigger finance_ai_reconciliation_statement_lock before insert or update or delete on public.finance_reconciliation_items for each statement execute function public.finance_ai_statement_lock();
create trigger finance_ai_reconciliation_item_guard before insert or update or delete on public.finance_reconciliation_items for each row execute function public.finance_ai_reconciliation_item_guard();

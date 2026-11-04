-- Reports are snapshots; monetary totals are calculated by application code
-- from the complete ledger, never supplied by a language model.
create table public.finance_ai_reports (
  id uuid primary key default gen_random_uuid(),
  competencia date not null unique check (extract(day from competencia) = 1),
  analysis_year integer not null check (analysis_year between 2000 and 2200),
  input_fingerprint text not null,
  report jsonb not null check (jsonb_typeof(report) = 'object'),
  model text not null,
  created_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.finance_ai_reports enable row level security;
create policy "finance users read AI reports" on public.finance_ai_reports
  for select to authenticated using ((select public.pode_acessar_financeiro()));
create policy "finance users insert AI reports" on public.finance_ai_reports
  for insert to authenticated with check ((select public.pode_acessar_financeiro()) and created_by = (select auth.uid()));
create policy "finance users update AI reports" on public.finance_ai_reports
  for update to authenticated using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()) and created_by = (select auth.uid()));
grant select, insert, update on public.finance_ai_reports to authenticated;

-- Shared transaction lock also used by closing/reconciliation. Triggers cover
-- direct Data API writes and legacy routes, not only the new AI endpoint.
create function public.finance_ai_write_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare payload jsonb; old_payload jsonb; months date[] := '{}'; source_id uuid; month_value text;
begin
  perform pg_catalog.pg_advisory_xact_lock(136034, 1);
  if tg_op <> 'DELETE' then payload := to_jsonb(new); end if;
  if tg_op <> 'INSERT' then old_payload := to_jsonb(old); end if;
  if tg_table_name = 'finance_imports' then
    foreach month_value in array array[payload->'metadata'->>'competencia', old_payload->'metadata'->>'competencia'] loop
      if month_value ~ '^\d{4}-(0[1-9]|1[0-2])$' then months := array_append(months, (month_value || '-01')::date); end if;
    end loop;
  else
    for source_id in select distinct x from unnest(array[(payload->>'import_id')::uuid, (old_payload->>'import_id')::uuid]) x where x is not null loop
      select metadata->>'competencia' into month_value from public.finance_imports where id = source_id;
      if month_value ~ '^\d{4}-(0[1-9]|1[0-2])$' then months := array_append(months, (month_value || '-01')::date); end if;
    end loop;
    if tg_table_name = 'finance_ledger' then
      if payload->>'movement_date' is not null then months := array_append(months, date_trunc('month', (payload->>'movement_date')::date)::date); end if;
      if old_payload->>'movement_date' is not null then months := array_append(months, date_trunc('month', (old_payload->>'movement_date')::date)::date); end if;
    end if;
  end if;
  if exists (select 1 from public.finance_periods where competencia = any(months) and status = 'FECHADO') then
    raise exception 'Período financeiro fechado; alteração bloqueada.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.finance_ai_write_guard() from public, anon, authenticated;
create trigger finance_ai_import_guard before insert or update or delete on public.finance_imports for each row execute function public.finance_ai_write_guard();
create trigger finance_ai_ledger_guard before insert or update or delete on public.finance_ledger for each row execute function public.finance_ai_write_guard();
create trigger finance_ai_exception_guard before insert or update or delete on public.finance_exceptions for each row execute function public.finance_ai_write_guard();

create function public.finance_ai_fingerprint(p_month date) returns text
language sql stable security invoker set search_path = '' as $$
  select md5(coalesce(string_agg(x.value, '|' order by x.value), '')) from (
    select 'i:' || to_jsonb(i)::text as value from public.finance_imports i where i.metadata->>'competencia' = to_char(p_month, 'YYYY-MM')
    union all
    select 'l:' || to_jsonb(l)::text from public.finance_ledger l where date_trunc('month', l.movement_date)::date = p_month
      or l.import_id in (select id from public.finance_imports where metadata->>'competencia' = to_char(p_month, 'YYYY-MM'))
    union all
    select 'e:' || to_jsonb(e)::text from public.finance_exceptions e where e.import_id in
      (select id from public.finance_imports where metadata->>'competencia' = to_char(p_month, 'YYYY-MM'))
  ) x where (select public.pode_acessar_financeiro());
$$;
revoke execute on function public.finance_ai_fingerprint(date) from public, anon;
grant execute on function public.finance_ai_fingerprint(date) to authenticated;

create function public.finance_ai_reconcile(p_billed uuid, p_received uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare sale public.finance_ledger; deposit public.finance_ledger; reconciliation uuid;
begin
  if auth.uid() is null or not public.pode_acessar_financeiro() then raise exception 'Sem acesso ao financeiro.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(136034, 1);
  select * into sale from public.finance_ledger where id = p_billed for update;
  select * into deposit from public.finance_ledger where id = p_received for update;
  if sale.id is null or deposit.id is null or sale.type <> 'RECEITA_FATURADA' or deposit.type <> 'RECEITA_RECEBIDA'
     or sale.net_amount <= 0 or sale.net_amount <> deposit.net_amount
     or abs(coalesce(sale.expected_date, sale.movement_date) - deposit.movement_date) > 7
     or sale.reconciliation_status not in ('PENDENTE','DIVERGENTE') or deposit.reconciliation_status not in ('PENDENTE','DIVERGENTE') then
    raise exception 'Lançamentos incompatíveis ou já conciliados.';
  end if;
  if exists (select 1 from public.finance_reconciliation_items where ledger_id in (p_billed,p_received)) then raise exception 'Lançamento já vinculado.'; end if;
  insert into public.finance_reconciliations(kind,status,amount,difference,criteria,reviewed_by,reviewed_at)
    values ('RECEITA_PLATAFORMA_BANCO','CONCILIADO',sale.net_amount,0,'{"rule":"ai-unique-exact-pair"}',auth.uid(),now()) returning id into reconciliation;
  insert into public.finance_reconciliation_items(reconciliation_id,ledger_id) values (reconciliation,p_billed),(reconciliation,p_received);
  update public.finance_ledger set reconciliation_status = 'CONCILIADO', updated_at = now() where id in (p_billed,p_received);
  insert into public.finance_audit_log(action,actor,after_data) values ('AI_RECONCILIATION',auth.uid()::text,jsonb_build_object('reconciliation_id',reconciliation,'billed_id',p_billed,'received_id',p_received));
  return reconciliation;
end $$;
revoke execute on function public.finance_ai_reconcile(uuid,uuid) from public, anon;
grant execute on function public.finance_ai_reconcile(uuid,uuid) to authenticated;

create function public.finance_ai_period_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare month_key text;
begin
  perform pg_catalog.pg_advisory_xact_lock(136034, 1);
  if tg_op = 'UPDATE' and old.status = 'FECHADO' then raise exception 'Período fechado não pode ser alterado.'; end if;
  if new.status <> 'FECHADO' then return new; end if;
  month_key := to_char(new.competencia, 'YYYY-MM');
  if not exists (select 1 from public.finance_imports where metadata->>'competencia' = month_key) then raise exception 'Envie os documentos antes de fechar.'; end if;
  if exists (select 1 from public.finance_imports where metadata->>'competencia' = month_key and status not in ('PROCESSED','PARTIAL')) then raise exception 'Há importações não concluídas.'; end if;
  if exists (select 1 from public.finance_exceptions e join public.finance_imports i on i.id = e.import_id where i.metadata->>'competencia' = month_key and e.status = 'OPEN') then raise exception 'Há pendências de conferência.'; end if;
  if exists (select 1 from public.finance_ledger where type = 'RECEITA_FATURADA' and movement_date >= new.competencia and movement_date < new.competencia + interval '1 month' and coalesce(expected_date,movement_date) < new.competencia + interval '1 month' and reconciliation_status not in ('CONCILIADO','IGNORADO','DUPLICADO')) then raise exception 'Há recebimentos vencidos sem conciliação.'; end if;
  if exists (select 1 from unnest(array['extratos','recebimentos','conciliacao','cartao','notas','pagamentos']) k where coalesce(new.checklist->>k,'false') <> 'true') then raise exception 'Confirme a completude dos documentos.'; end if;
  return new;
end $$;
revoke execute on function public.finance_ai_period_guard() from public, anon, authenticated;
create trigger finance_ai_period_guard before insert or update on public.finance_periods for each row execute function public.finance_ai_period_guard();

create function public.finance_ai_close(p_report uuid, p_documents_complete boolean) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare saved public.finance_ai_reports; period_id uuid;
begin
  if auth.uid() is null or not public.pode_acessar_financeiro() then raise exception 'Sem acesso ao financeiro.'; end if;
  if p_documents_complete is distinct from true then raise exception 'Confirme que todos os documentos foram enviados.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(136034, 1);
  select * into saved from public.finance_ai_reports where id = p_report for update;
  if saved.id is null then raise exception 'Relatório não encontrado.'; end if;
  select id into period_id from public.finance_periods where competencia = saved.competencia and status = 'FECHADO';
  if period_id is not null then return period_id; end if;
  if saved.input_fingerprint <> public.finance_ai_fingerprint(saved.competencia) then raise exception 'Os dados mudaram. Gere novamente a análise antes de fechar.'; end if;
  if jsonb_array_length(coalesce(saved.report->'blockers','[]'::jsonb)) > 0 then raise exception 'Resolva as pendências indicadas no relatório.'; end if;
  insert into public.finance_periods(competencia,status,checklist,closed_by,closed_at,created_by)
    values (saved.competencia,'FECHADO','{"extratos":true,"recebimentos":true,"conciliacao":true,"cartao":true,"notas":true,"pagamentos":true}',auth.uid(),now(),auth.uid())
    on conflict (competencia) do update set status = 'FECHADO', checklist = excluded.checklist, closed_by = excluded.closed_by, closed_at = excluded.closed_at, updated_at = now()
    returning id into period_id;
  insert into public.finance_audit_log(action,actor,after_data) values ('AI_MONTH_CLOSED',auth.uid()::text,jsonb_build_object('report_id',saved.id,'competencia',saved.competencia));
  return period_id;
end $$;
revoke execute on function public.finance_ai_close(uuid,boolean) from public, anon;
grant execute on function public.finance_ai_close(uuid,boolean) to authenticated;

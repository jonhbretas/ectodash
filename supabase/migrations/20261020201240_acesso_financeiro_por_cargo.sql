-- Unifica o acesso financeiro pelo papel legado e pelo módulo concedido no
-- cargo. A interface já consulta meus_cargos(); esta função deixa a RLS com
-- exatamente a mesma regra, inclusive para acessos diretos pela Data API.
create or replace function public.pode_acessar_financeiro()
returns boolean
language sql
security invoker
set search_path = ''
stable
as $$
  select
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('financeiro'));
$$;

revoke execute on function public.pode_acessar_financeiro() from public, anon;
grant execute on function public.pode_acessar_financeiro() to authenticated;

-- Livro financeiro e referências mensais.
create policy "cargo financeiro pode ler lançamentos"
  on public.financial_entries for select to authenticated
  using ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode inserir lançamentos"
  on public.financial_entries for insert to authenticated
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode excluir lançamentos"
  on public.financial_entries for delete to authenticated
  using ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode ler sincronizações"
  on public.sheet_sync_runs for select to authenticated
  using ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir referências mensais"
  on public.financial_monthly_references for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));

-- Contas a pagar, débitos recorrentes e cobranças de alunos.
create policy "cargo financeiro pode gerir pagamentos ectolab"
  on public.pagamentos_ectolab for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir débitos ectolab"
  on public.debitos_ectolab for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir propostas"
  on public.propostas_financeiras for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir parcelas"
  on public.proposta_parcelas for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));

-- Importação automatizada e conciliação financeira.
create policy "cargo financeiro pode gerir importações"
  on public.finance_imports for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir entidades"
  on public.finance_entities for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir livro automatizado"
  on public.finance_ledger for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir regras"
  on public.finance_rules for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir conciliações"
  on public.finance_reconciliations for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir itens de conciliação"
  on public.finance_reconciliation_items for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir exceções"
  on public.finance_exceptions for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));
create policy "cargo financeiro pode gerir auditoria"
  on public.finance_audit_log for all to authenticated
  using ((select public.pode_acessar_financeiro()))
  with check ((select public.pode_acessar_financeiro()));

-- A Loja Ectolab não faz parte do módulo Financeiro: ela expõe pedidos e
-- dados de clientes e fica apenas com a coordenação geral, coerente com a
-- visibilidade do menu e da página /vendas.
drop policy if exists "wp_stores read" on public.wp_stores;
drop policy if exists "wp_products read" on public.wp_products;
drop policy if exists "wp_orders read" on public.wp_orders;
drop policy if exists "wp_customers read" on public.wp_customers;
drop policy if exists "wp_sync_log read" on public.wp_sync_log;

create policy "coordenação geral lê lojas"
  on public.wp_stores for select to authenticated
  using ((select public.has_role('coordenador_geral')));
create policy "coordenação geral lê produtos"
  on public.wp_products for select to authenticated
  using ((select public.has_role('coordenador_geral')));
create policy "coordenação geral lê pedidos"
  on public.wp_orders for select to authenticated
  using ((select public.has_role('coordenador_geral')));
create policy "coordenação geral lê clientes"
  on public.wp_customers for select to authenticated
  using ((select public.has_role('coordenador_geral')));
create policy "coordenação geral lê sincronizações da loja"
  on public.wp_sync_log for select to authenticated
  using ((select public.has_role('coordenador_geral')));

-- supabase/migrations/0062_limpeza_dados_teste.sql
-- Limpeza segura de lixo de testes em projeto real: contas-fantasma
-- (@example.invalid), voluntários "Novo Cadastro ..." e todos os dados
-- criados por elas (demandas, eventos, DIPs, áreas, contratos, etc.).
--
-- Por que uma função SECURITY DEFINER:
--   1. As suítes de testes (tests/db/*.test.ts) limpam o que criam no
--      afterAll, mas execução quebrada no meio (Ctrl+C, timeout do worker,
--      erro fora do afterAll) deixa contas e linhas órfãs — o projeto real
--      acumula "lixo" visível nas telas (merge, voluntários, eventos...).
--   2. Vários FKs para public.profiles são RESTRICT (demandas.criado_por,
--      eventos.criado_por, etc.) — deletar auth.users primeiro quebraria
--      a FK. A função apaga na ordem certa de dependência.
--   3. É chamada pelo globalSetup do vitest (tests/db/global-cleanup.ts)
--      antes de cada rodada de `npm test`. Também pode ser executada à
--      mão no SQL editor: `select public.limpar_dados_teste();`.
--   4. Segurança: sem grant para public/anon/authenticated — só o
--      service-role (postgres) pode chamar; RLS não se aplica dentro de
--      SECURITY DEFINER (owner postgres), então apaga tudo de verdade.
-- Fontes: 0017 criar_meu_cadastro (nomes "Novo Cadastro"), 0055 padrão de
-- regex de limpeza, FKs de profiles [CITED: this repo].

create or replace function public.limpar_dados_teste()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test_ids uuid[];
begin
  -- Perfis de contas-fantasma: qualquer auth.users com e-mail @example.invalid.
  -- Dados reais nunca usam esse domínio — é a identificação precisa do lixo.
  select array_agg(p.id) into v_test_ids
  from public.profiles p
  where exists (
    select 1 from auth.users u
    where u.id = p.id and u.email like '%@example.invalid'
  );

  -- Voluntários "Novo Cadastro ..." (criar_meu_cadastro de testes) — sem
  -- conta vinculada, filhos somem via ON DELETE CASCADE (mesmo padrão da
  -- migração 0055).
  delete from public.voluntarios
  where nome ~ '^Novo Cadastro ';

  if v_test_ids is null then
    return;
  end if;

  -- 1. Dedup/reminder log por perfil e demandas do perfil (cascade em
  --    demanda_id derruba responsáveis, membros, checklist, comentários).
  delete from public.demanda_reminders_log
  where profile_id = any (v_test_ids)
     or demanda_id in (select id from public.demandas where criado_por = any (v_test_ids));

  -- 2. Contratos ANTES de eventos: contratos.evento_id referencia eventos
  --    sem cascade (0042).
  delete from public.contratos where criado_por = any (v_test_ids);
  delete from public.contrato_modelos where criado_por = any (v_test_ids);

  -- 3. Demandas (cascade: demanda_responsaveis, demanda_membros,
  --    demanda_checklist, demanda_comentarios, demanda_reminders_log).
  delete from public.demandas where criado_por = any (v_test_ids);

  -- 4. Eventos (cascade: proep_* por edition_id, contrato_evento_* por
  --    evento_id, contrato_evento_pastas; demandas.evento_id set null).
  delete from public.eventos where criado_por = any (v_test_ids);

  -- 5. DIPs e atas: dips/ata_participantes primeiro (criado_por RESTRICT),
  --    depois reunioes (cascade em ata_id derruba o resto).
  delete from public.dips where criado_por = any (v_test_ids);
  delete from public.ata_participantes where criado_por = any (v_test_ids);
  delete from public.reunioes where criado_por = any (v_test_ids);
  delete from public.dip_localidades where criado_por = any (v_test_ids);

  -- 6. Tabelas com criado_por próprio.
  delete from public.etiquetas where criado_por = any (v_test_ids);
  delete from public.voluntario_localidades where criado_por = any (v_test_ids);
  delete from public.areas_institucionais where criado_por = any (v_test_ids);
  delete from public.projetos where criado_por = any (v_test_ids);
  delete from public.utilidades_itens where criado_por = any (v_test_ids);

  -- 7. Cargos (cargo_modulos cascade por cargo_id) e financeiro
  --    (created_by/reviewed_by/resolved_by RESTRICT).
  delete from public.cargos where criado_por = any (v_test_ids);
  delete from public.finance_imports where created_by = any (v_test_ids);
  delete from public.finance_rules where created_by = any (v_test_ids);
  delete from public.finance_reconciliations where reviewed_by = any (v_test_ids);
  delete from public.finance_exceptions where resolved_by = any (v_test_ids);

  -- 8. Audit trail (FK set null, mas lixo de teste não interessa ao log).
  delete from public.audit_log where profile_id = any (v_test_ids);

  -- 9. Por fim, as contas (cascade: profiles, user_settings, lider_areas,
  --    feedback, cargos.profile_id).
  delete from auth.users where id = any (v_test_ids);
end;
$$;

-- A função é interna (chamada pelo globalSetup / SQL editor): nenhum papel
-- de app pode invocá-la. Service-role (postgres) executa por ser o dono.
revoke execute on function public.limpar_dados_teste() from public, anon, authenticated;

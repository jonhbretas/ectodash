-- supabase/migrations/0063_security_hardening.sql
-- Endurecimento de segurança (auditoria OWASP Top 10 — 2026-08-11):
--
--   1. vincular_meu_cadastro(): NUNCA concede role elevado. Antes, quem
--      vinculava a própria conta a uma linha do roster herdava o papel
--      "intencionado" da linha (financeiro/voluntariado/coordenador_area).
--      Combinado com o auto-cadastro, qualquer pessoa podia registrar uma
--      conta e reivindicar a primeira linha não vinculada do roster,
--      escalando para financeiro (acesso total ao financeiro via RLS
--      has_role). Agora o vínculo concede sempre 'voluntario_comum'
--      (coordenador_geral mantém o próprio papel); promoções são exclusivas
--      do coordenador (atualizar_voluntario()).
--
--   2. PROEP: RLS restrito a coordenador_geral/financeiro ou cargo com o
--      módulo 'proep' (tem_cargo_modulo, 0043). Antes toda a PII de alunos
--      (nome/e-mail/telefone) e o catálogo de materiais eram lidos E
--      gravados por QUALQUER conta autenticada — inclusive recém-cadastrados.
--
--   3. proep_settings/proep_edition_config/contrato_settings/
--      contrato_evento_pastas: leitura continua aberta (URLs de pastas),
--      mas a ESCRITA passa a exigir coordenador_geral (contratos) ou
--      coordenador_geral/financeiro/cargo proep (PROEP). Antes qualquer
--      autenticado podia redirecionar a pasta central do Drive onde os
--      contratos assinados (com CPF) são arquivados.
--
--   4. Grants explícitos à Data API (mesmo padrão da 0043): a RLS governa
--      as linhas; o GRANT governa a acessibilidade do endpoint.

-- ---------------------------------------------------------------------------
-- 1. vincular_meu_cadastro — vínculo nunca concede role elevado
-- ---------------------------------------------------------------------------
create or replace function public.vincular_meu_cadastro(cadastro_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.voluntarios%rowtype;
  me uuid := (select auth.uid());
  meu_role public.app_role;
begin
  if me is null then
    return false;
  end if;

  if not exists (
    select 1 from public.profiles
    where id = me and vincular_pendente
  ) then
    return false;
  end if;

  select * into v_row from public.voluntarios where id = cadastro_id;
  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.profiles where voluntario_id = cadastro_id
  ) then
    return false;
  end if;

  select role into meu_role from public.profiles where id = me;

  -- Auditoria 0063: o papel "intencionado" do roster jamais é concedido no
  -- auto-vínculo — qualquer pessoa registrada poderia reivindicar a linha de
  -- um futuro financeiro/coordenador. Promoção é exclusiva do coordenador
  -- (atualizar_voluntario()). coordenador_geral mantém o próprio papel.
  if meu_role <> 'coordenador_geral' then
    meu_role := 'voluntario_comum';
  end if;

  update public.profiles
    set voluntario_id = cadastro_id,
        vincular_pendente = false,
        full_name = v_row.nome,
        area_atuacao = v_row.area_atuacao,
        role = meu_role,
        ativo = v_row.ativo
    where id = me;

  if meu_role = 'coordenador_area' and cardinality(v_row.areas_lideradas) > 0 then
    insert into public.lider_areas (lider_id, area)
    select distinct me, unnest(v_row.areas_lideradas)
    on conflict do nothing;
  end if;

  return true;
end;
$$;

revoke execute on function public.vincular_meu_cadastro(bigint) from public, anon;
grant execute on function public.vincular_meu_cadastro(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. PROEP — RLS restrito (coordenador_geral | financeiro | cargo 'proep')
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated can view proep_students" on public.proep_students;
drop policy if exists "authenticated can manage proep_students" on public.proep_students;
drop policy if exists "authenticated can view proep_materials" on public.proep_materials;
drop policy if exists "authenticated can manage proep_materials" on public.proep_materials;
drop policy if exists "authenticated can view proep_checklist" on public.proep_checklist;
drop policy if exists "authenticated can manage proep_checklist" on public.proep_checklist;
drop policy if exists "authenticated can view proep_assignments" on public.proep_assignments;
drop policy if exists "authenticated can manage proep_assignments" on public.proep_assignments;
drop policy if exists "authenticated can view proep_progression" on public.proep_progression;
drop policy if exists "authenticated can manage proep_progression" on public.proep_progression;
drop policy if exists "authenticated can view proep_student_materials" on public.proep_student_materials;
drop policy if exists "authenticated can manage proep_student_materials" on public.proep_student_materials;

create policy "proep roles can view proep_students"
  on public.proep_students for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );
create policy "proep roles can manage proep_students"
  on public.proep_students for all to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );

create policy "proep roles can view proep_materials"
  on public.proep_materials for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );
create policy "proep roles can manage proep_materials"
  on public.proep_materials for all to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );

create policy "proep roles can view proep_checklist"
  on public.proep_checklist for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );
create policy "proep roles can manage proep_checklist"
  on public.proep_checklist for all to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );

create policy "proep roles can view proep_assignments"
  on public.proep_assignments for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );
create policy "proep roles can manage proep_assignments"
  on public.proep_assignments for all to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );

create policy "proep roles can view proep_progression"
  on public.proep_progression for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );
create policy "proep roles can manage proep_progression"
  on public.proep_progression for all to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );

create policy "proep roles can view proep_student_materials"
  on public.proep_student_materials for select to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );
create policy "proep roles can manage proep_student_materials"
  on public.proep_student_materials for all to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );

-- ---------------------------------------------------------------------------
-- 3. Settings — leitura aberta, escrita restrita
-- ---------------------------------------------------------------------------
drop policy if exists "authenticated can manage proep_settings" on public.proep_settings;
drop policy if exists "authenticated can manage proep_edition_config" on public.proep_edition_config;

create policy "proep roles can manage proep_settings"
  on public.proep_settings for all to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );

create policy "proep roles can manage proep_edition_config"
  on public.proep_edition_config for all to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  )
  with check (
    (select public.has_role('coordenador_geral'))
    or (select public.has_role('financeiro'))
    or (select public.tem_cargo_modulo('proep'))
  );

drop policy if exists "authenticated can manage contrato_settings" on public.contrato_settings;
drop policy if exists "authenticated can manage contrato_evento_pastas" on public.contrato_evento_pastas;

-- Contratos são exclusivos do coordenador_geral (módulo restrito): as
-- configurações (pasta central do Drive, pastas por evento) só ele escreve.
create policy "coordinator can manage contrato_settings"
  on public.contrato_settings for all to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create policy "coordinator can manage contrato_evento_pastas"
  on public.contrato_evento_pastas for all to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

-- ---------------------------------------------------------------------------
-- 4. Grants explícitos à Data API (padrão 0043) — RLS governa as linhas
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on table public.proep_students to authenticated;
grant select, insert, update, delete on table public.proep_materials to authenticated;
grant select, insert, update, delete on table public.proep_checklist to authenticated;
grant select, insert, update, delete on table public.proep_assignments to authenticated;
grant select, insert, update, delete on table public.proep_progression to authenticated;
grant select, insert, update, delete on table public.proep_student_materials to authenticated;
grant select, insert, update, delete on table public.proep_settings to authenticated;
grant select, insert, update, delete on table public.proep_edition_config to authenticated;
grant select, insert, update, delete on table public.contrato_settings to authenticated;
grant select, insert, update, delete on table public.contrato_evento_pastas to authenticated;

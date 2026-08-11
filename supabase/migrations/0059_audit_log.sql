-- supabase/migrations/0059_audit_log.sql
-- Log de ações de usuários (audit trail): quem fez o que, em qual registro,
-- com o estado antes/depois em jsonb. Captura automática via trigger genérico
-- nas tabelas de negócio — nenhuma chamada explícita no código da aplicação.
--
-- Decisões (e precedentes internos):
--   - Tabela append-only com RLS de LEITURA restrita a coordenador_geral,
--     espelhando exatamente o padrão de "reminder runs"/"demanda reminders
--     log" da 0005_reminder_logs.sql (policy de SELECT com has_role +
--     NENHUMA policy de escrita) [CITED: this repo].
--   - O trigger registra auth.uid() de quem executou a operação; escritas de
--     service-role (crons de lembretes/sync) ficam com profile_id NULL =
--     "Sistema". Mesma semântica do actor text default 'system' da
--     finance_audit_log (0041) [CITED: this repo].
--   - Função de trigger SECURITY DEFINER set search_path = '' com o mesmo
--     formato de has_role()/is_lider_of_area() (0002/0004) [CITED: this repo].
--     A função retorna trigger, então não é invocável via SQL direto/RPC —
--     sem superfície de forja de logs (skill supabase: funções SECURITY
--     DEFINER em public são executáveis por todos por padrão, mas as de
--     tipo trigger só rodam dentro de CREATE TRIGGER).
--   - Identificação do registro: colunas de PK passadas como argumento do
--     trigger (tg_argv[0], separadas por vírgula) — cobre PKs compostas
--     (demanda_responsaveis, lider_areas, voluntario_areas, ata_participantes)
--     sem consulta ao catálogo pg_catalog por linha.
--   - UPDATE que não muda nada além de updated_at (touchado pelo
--     set_updated_at de 0003) não gera linha — comparação de jsonb excluindo
--     a coluna updated_at.
--   - Escopo de tabelas: as de negócio dirigidas por usuário. Excluídas de
--     propósito: wp_* (sync em lote do WooCommerce), finance_* (o módulo já
--     tem finance_audit_log próprio, 0041) e as tabelas de log do sistema
--     (reminder_runs, sheet_sync_runs, wp_sync_log, contrato_webhook_log).
--     Novas tabelas entram com uma única linha `create trigger` no final.

create table public.audit_log (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles(id) on delete set null,
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  entidade text not null,
  entidade_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- Leitura "mais recentes primeiro" (a tela do painel pagina por created_at
-- desc + id desc) — ordenação, não apenas filtro, então sem partial index.
create index audit_log_created_at_idx on public.audit_log (created_at desc);
-- Filtro por entidade (select da tela) e lookups por registro (entidade_id).
create index audit_log_entidade_idx on public.audit_log (entidade);
create index audit_log_entidade_id_idx on public.audit_log (entidade_id);
-- Lookup "o que este usuário fez" (perfil da pessoa).
create index audit_log_profile_id_idx on public.audit_log (profile_id);

alter table public.audit_log enable row level security;

-- Coordenador-geral lê tudo; nenhuma outra role lê, e NENHUMA role escreve —
-- a única escrita é a da função de trigger (SECURITY DEFINER, bypassa RLS
-- como o service-role nos logs de 0005). Sem policy de INSERT, um cliente
-- autenticado não consegue forjar linhas de log pela Data API.
create policy "coordenador can view audit log"
  on public.audit_log
  for select
  to authenticated
  using ((select public.has_role('coordenador_geral')));

-- Trigger genérico: registra OLD/NEW da linha tocada. O argumento (tg_argv[0])
-- é a lista de colunas da chave primária, separada por vírgula — colunas
-- compostas viram "v1 | v2" na entidade_id.
create or replace function public.registrar_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha_antes jsonb;
  v_linha_depois jsonb;
  v_col text;
  v_partes text[] := '{}';
  v_id text;
begin
  -- UPDATE que só tocou updated_at (set_updated_at de 0003 roda BEFORE e
  -- sempre grava now()) é ruído puro — compara o resto do registro.
  if tg_op = 'UPDATE'
     and (to_jsonb(old) - 'updated_at') is not distinct from (to_jsonb(new) - 'updated_at')
  then
    return null;
  end if;

  v_linha_antes := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_linha_depois := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  foreach v_col in array string_to_array(tg_argv[0], ',') loop
    v_col := btrim(v_col);
    if tg_op = 'DELETE' then
      v_partes := v_partes || coalesce((v_linha_antes -> v_col)::text, 'null');
    else
      v_partes := v_partes || coalesce((v_linha_depois -> v_col)::text, 'null');
    end if;
  end loop;
  v_id := nullif(array_to_string(v_partes, ' | '), '');

  insert into public.audit_log (profile_id, acao, entidade, entidade_id, before_data, after_data)
  values ((select auth.uid()), tg_op, tg_table_name, v_id, v_linha_antes, v_linha_depois);

  return null;
end;
$$;

-- Tabelas de negócio auditadas (cada uma = uma linha; adicionar tabela nova
-- é acrescentar um create trigger). Order: demandas primeiro — cascades de
-- delete (responsaveis/membros/comentarios/checklist) disparam os triggers
-- filhos com o mesmo actor do DELETE da demanda.
create trigger audit_demandas
  after insert or update or delete on public.demandas
  for each row execute function public.registrar_audit('id');
create trigger audit_demanda_responsaveis
  after insert or update or delete on public.demanda_responsaveis
  for each row execute function public.registrar_audit('demanda_id, profile_id');
create trigger audit_demanda_comentarios
  after insert or update or delete on public.demanda_comentarios
  for each row execute function public.registrar_audit('id');
create trigger audit_demanda_checklist
  after insert or update or delete on public.demanda_checklist
  for each row execute function public.registrar_audit('id');
create trigger audit_voluntarios
  after insert or update or delete on public.voluntarios
  for each row execute function public.registrar_audit('id');
create trigger audit_voluntario_areas
  after insert or update or delete on public.voluntario_areas
  for each row execute function public.registrar_audit('voluntario_id, area');
create trigger audit_eventos
  after insert or update or delete on public.eventos
  for each row execute function public.registrar_audit('id');
create trigger audit_reunioes
  after insert or update or delete on public.reunioes
  for each row execute function public.registrar_audit('id');
create trigger audit_ata_participantes
  after insert or update or delete on public.ata_participantes
  for each row execute function public.registrar_audit('ata_id, voluntario_id');
create trigger audit_areas_institucionais
  after insert or update or delete on public.areas_institucionais
  for each row execute function public.registrar_audit('id');
create trigger audit_lider_areas
  after insert or update or delete on public.lider_areas
  for each row execute function public.registrar_audit('lider_id, area');
create trigger audit_contratos
  after insert or update or delete on public.contratos
  for each row execute function public.registrar_audit('id');
create trigger audit_utilidades_itens
  after insert or update or delete on public.utilidades_itens
  for each row execute function public.registrar_audit('id');
create trigger audit_proep_students
  after insert or update or delete on public.proep_students
  for each row execute function public.registrar_audit('id');
-- Perfis: mudança de role/voluntario_id/vincular_pendente é exatamente o
-- tipo de "quem promoveu quem" que o log existe para responder. INSERT vem
-- do handle_new_user (0001, sem sessão) -> profile_id NULL = Sistema.
create trigger audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.registrar_audit('id');

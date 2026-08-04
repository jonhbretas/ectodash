-- supabase/migrations/0006_financial_entries.sql
-- Financial schema for FIN-01 (Sheets sync ingest target) and FIN-03
-- (visible sync history) — the data-layer foundation Phase 9's cron route
-- writes to and Phase 10's dashboard reads from. Two tables, mirroring
-- Phase 7's reminder_runs/demanda_reminders_log split exactly:
-- sheet_sync_runs is a per-cron-invocation summary that exists even if a
-- run crashes before parsing anything; financial_entries is the
-- system-of-record rows Phase 10 renders — written ONLY by the service-role
-- cron client (whole-table replace per run, per 09-RESEARCH.md's research),
-- never by an authenticated user session.
-- Sources: 09-RESEARCH.md Pattern 1-3 (mirror 0005_reminder_logs.sql's
-- shape byte-for-byte); 0002_profiles_role.sql's has_role() precedent
-- [CITED: this repo]; 0005_reminder_logs.sql's run-log conventions
-- [CITED: this repo].

-- sheet_sync_runs FIRST — created before any code writes to it, mirroring
-- 0005's reminder_runs-first ordering. status check mirrors reminder_runs
-- minus 'partial_failure' (a Sheets sync is all-or-nothing — a failed
-- parse leaves zero inserted rows, no partial state exists).
create table public.sheet_sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  entries_count integer not null default 0,
  error_message text
);

-- financial_entries: the parsed, validated cash-flow rows. valor is
-- numeric(12,2) — never float — because this is real money and Phase 10
-- sums it; data is a `date` (not timestamptz) because a cash-flow entry
-- belongs to a calendar day, matching the institution's spreadsheet
-- conventions. The (tipo, data) and (data) indexes serve Phase 10's
-- monthly aggregation and running-total reads.
create table public.financial_entries (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('entrada', 'saida')),
  descricao text not null check (char_length(trim(descricao)) > 0),
  valor numeric(12, 2) not null check (valor >= 0),
  data date not null,
  categoria text,
  created_at timestamptz not null default now()
);

create index financial_entries_data_idx on public.financial_entries (data);
create index financial_entries_tipo_data_idx on public.financial_entries (tipo, data);
create index financial_entries_categoria_idx on public.financial_entries (categoria);

alter table public.sheet_sync_runs enable row level security;
alter table public.financial_entries enable row level security;

-- FIN-04's data-read boundary: only coordenador_geral and financeiro can
-- read financial rows — voluntario_comum/lider_area get zero rows back
-- even via a direct API query, satisfying AUTH-02's "cannot retrieve
-- financial data even via direct API/database query". has_role() is the
-- same SECURITY DEFINER helper from 0002_profiles_role.sql, invoked once
-- per role check (two calls, OR'd — never a role array, matching the
-- project's existing per-role policy idiom).
create policy "financeiro e coordenador can view financial entries"
  on public.financial_entries
  for select
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

create policy "financeiro e coordenador can view sheet sync runs"
  on public.sheet_sync_runs
  for select
  to authenticated
  using (
    (select public.has_role('financeiro'))
    or (select public.has_role('coordenador_geral'))
  );

-- No INSERT/UPDATE/DELETE policy for `authenticated` on either table —
-- deliberately, not an oversight. Only the service-role client built in
-- Phase 9's cron route (a trusted, non-user-triggered context with no user
-- session) ever writes these tables; a service-role client bypasses RLS by
-- design, so no write policy is needed or reachable for that writer — the
-- same decision 0005_reminder_logs.sql already documents for
-- reminder_runs/demanda_reminders_log.

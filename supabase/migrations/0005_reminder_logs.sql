-- supabase/migrations/0005_reminder_logs.sql
-- Reminder-log schema for LEMB-03 (idempotent/dedup delivery) and LEMB-04
-- (visible run history) — the data-layer foundation plan 07-02's cron
-- route writes to. Two separate tables, not one: reminder_runs (created
-- FIRST — demanda_reminders_log's run_id FK references it) is a per-cron-
-- invocation summary that exists even if a run crashes before sending
-- anything; demanda_reminders_log is the per-(demanda, responsável, tipo,
-- day) dedup + send-status record, with a UNIQUE constraint that IS the
-- idempotency mechanism itself (INSERT ... ON CONFLICT, built in plan
-- 07-02) — never a check-then-insert. Both tables are coordenador-only
-- readable via RLS; NEITHER has any authenticated-role write policy,
-- because only the service-role client (plan 07-02, no user session)
-- ever writes them.
-- Sources: 07-RESEARCH.md Pattern 2 (dedup-is-the-insert, sent_on as
-- `date` not timestamptz), Pattern 3 (two tables, not one — a
-- crashed-before-sending run has no per-reminder row to attach to);
-- 0002_profiles_role.sql's has_role() SECURITY DEFINER precedent [CITED:
-- this repo]; 0003_demandas.sql's set_updated_at trigger + bigint
-- identity PK + FK-indexing conventions [CITED: this repo].

-- reminder_runs FIRST — demanda_reminders_log.run_id references it below.
create table public.reminder_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial_failure', 'failed')),
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text
);

-- reminder_runs is updated once at run end (finished_at/status/counts) —
-- unlike demanda_reminders_log below, which is append-mostly (status is
-- set once per row from 'pending' to 'sent'/'failed', never revisited
-- after that), so only reminder_runs needs the set_updated_at trigger
-- pattern is deliberately NOT reused here: the cron route itself sets
-- finished_at explicitly on its one update, so a generic updated_at
-- trigger would be redundant with that explicit write.

create table public.demanda_reminders_log (
  id bigint generated always as identity primary key,
  demanda_id bigint not null references public.demandas(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  tipo text not null check (tipo in ('atrasada', 'aproximando')),
  -- `date`, not `timestamptz`: LEMB-03's "no mesmo dia/ciclo" (same
  -- day/cycle) wording is satisfied by calendar-day granularity, which
  -- matches this job's own once-daily cadence (07-RESEARCH.md Pattern 2).
  sent_on date not null default current_date,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  error_message text,
  run_id bigint references public.reminder_runs(id),
  created_at timestamptz not null default now(),
  -- THE dedup mechanism itself (07-RESEARCH.md Pattern 2, Anti-Patterns):
  -- plan 07-02's cron route relies on this exact constraint existing so
  -- its `INSERT ... ON CONFLICT (demanda_id, profile_id, tipo, sent_on)
  -- DO NOTHING` call is meaningful. Never expressed as a check-then-insert
  -- in application code — Postgres itself rejects a duplicate tuple with
  -- error code 23505.
  unique (demanda_id, profile_id, tipo, sent_on)
);

-- Foreign keys are not auto-indexed by Postgres — index every FK column
-- per the project's own supabase-postgres-best-practices convention
-- (mirrors 0003_demandas.sql's demandas_criado_por_idx).
create index demanda_reminders_log_demanda_id_idx
  on public.demanda_reminders_log (demanda_id);
create index demanda_reminders_log_profile_id_idx
  on public.demanda_reminders_log (profile_id);
create index demanda_reminders_log_run_id_idx
  on public.demanda_reminders_log (run_id);

alter table public.reminder_runs enable row level security;
alter table public.demanda_reminders_log enable row level security;

-- Coordenador-only SELECT, mirroring migration 0002's exact
-- has_role('coordenador_geral') pattern. No other role can read either
-- table — LEMB-04's run/reminder history is institution-wide operational
-- visibility, not something a líder/voluntário/financeiro needs.
create policy "coordenador can view reminder runs"
  on public.reminder_runs
  for select
  to authenticated
  using ((select public.has_role('coordenador_geral')));

create policy "coordenador can view demanda reminders log"
  on public.demanda_reminders_log
  for select
  to authenticated
  using ((select public.has_role('coordenador_geral')));

-- No INSERT/UPDATE/DELETE policy for `authenticated` on either table —
-- deliberately, not an oversight. Only the service-role client built in
-- plan 07-02 (a trusted, non-user-triggered cron context with no user
-- session) ever writes reminder_runs or demanda_reminders_log; a
-- service-role client bypasses RLS by design, so no write policy is
-- needed or reachable for that writer, and adding an authenticated-role
-- write policy here would be an unused, unreachable privilege surface
-- with no corresponding write path in the intended flow.

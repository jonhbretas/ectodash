-- supabase/migrations/0010_user_settings.sql
-- Per-user accessibility preferences (user decision, 2026-08-04): the app
-- adapts to each audience — text size (padrão/grande/muito grande), high
-- contrast and reduced motion are stored per user and applied by a client
-- applier (documentElement font-size + data attributes consumed by
-- globals.css). Self-service only: every policy is scoped to the caller's
-- own row, so there is no privilege surface (unlike profiles.role, which
-- stays coordinator-managed).

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  text_size text not null default 'padrao'
    check (text_size in ('padrao', 'grande', 'muito_grande')),
  alto_contraste boolean not null default false,
  reduzir_animacoes boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at_user_settings()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at_user_settings();

alter table public.user_settings enable row level security;

create policy "user can view own settings"
  on public.user_settings
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "user can insert own settings"
  on public.user_settings
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "user can update own settings"
  on public.user_settings
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

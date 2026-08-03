-- supabase/migrations/0001_profiles.sql
-- Identity projection: one public.profiles row per auth.users row, created automatically
-- by a trigger (never by application code) and protected by Row Level Security.
-- Source pattern: https://supabase.com/docs/guides/auth/managing-user-data

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- supabase/migrations/0093_ai_config.sql
-- Seletor de modelo IA + nivel de uso: armazena escolha global do modelo
-- Go em uso. Apenas coordenador_geral pode alterar (RLS + gate).
-- 0093

create table if not exists public.ai_config (
  id int primary key check (id = 1),
  modelo text not null check (char_length(modelo) between 1 and 100),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- Seed inicial: mimo-v2.5 (alinhado com .env.local e DEFAULT_AI_MODEL)
insert into public.ai_config (id, modelo)
values (1, 'mimo-v2.5')
on conflict (id) do nothing;

-- RLS
alter table public.ai_config enable row level security;

-- Leitura: qualquer autenticado pode ver qual modelo esta ativo
drop policy if exists "ai_config select authenticated" on public.ai_config;
create policy "ai_config select authenticated"
  on public.ai_config for select
  to authenticated
  using (true);

-- Escrita: apenas coordenador_geral (via has_role). Insert/Update/Delete mesma regra.
drop policy if exists "ai_config write coordenador_geral" on public.ai_config;
create policy "ai_config write coordenador_geral"
  on public.ai_config for all
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

-- Trigger para updated_at
create or replace function public.touch_ai_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_config_updated_at on public.ai_config;
create trigger trg_ai_config_updated_at
  before update on public.ai_config
  for each row execute function public.touch_ai_config_updated_at();

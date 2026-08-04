-- supabase/migrations/0013_concluida_em.sql
-- demandas.concluida_em — when the demanda was actually concluded, the
-- backbone of the analysis screen's productivity metrics ("quantas tarefas
-- foram feitas [no mês]"). Set by trigger only when status flips TO
-- 'concluida', cleared when it flips away (reopened). Existing concluded
-- rows get NULL (their conclusion predates the column) and are excluded
-- from month-bucketed "done" counts, never mis-attributed to a month.

alter table public.demandas
  add column concluida_em timestamptz;

create or replace function public.set_concluida_em()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'concluida' and old.status is distinct from 'concluida' then
    new.concluida_em = now();
  elsif new.status is distinct from 'concluida' then
    new.concluida_em = null;
  end if;
  return new;
end;
$$;

drop trigger if exists demandas_set_concluida_em on public.demandas;
create trigger demandas_set_concluida_em
  before update on public.demandas
  for each row execute function public.set_concluida_em();

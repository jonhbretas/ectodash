-- supabase/migrations/0009_projeto_column.sql
-- demandas.projeto — free-text project label, distinct from area, so the
-- filter bar can offer Área and Projeto as independent dimensions (user
-- decision, 2026-08-04: filters must be Área, Projeto, Evento, Voluntário,
-- Status). Nullable like area; the view is recreated again because it fixes
-- its column list at creation time (same reason as 0008).

alter table public.demandas
  add column projeto text;

create index demandas_projeto_idx on public.demandas (projeto);

drop view public.demandas_com_status;
create view public.demandas_com_status
with (security_invoker = true) as
select
  d.*,
  (d.prazo < current_date and d.status <> 'concluida') as atrasada
from public.demandas d;

-- supabase/migrations/0014_profile_self_edit.sql
-- Self-service profile editing + coordinator volunteer management (user
-- decisions, 2026-08-04):
--   1. profiles.area_atuacao — the volunteer's field of action. There is
--      NO self-update RLS path at all, so it is coordinator-only by
--      construction: the only UPDATE policies on profiles are the
--      coordinator's (0002) and the SECURITY DEFINER function below, which
--      touches full_name ONLY.
--   2. profiles.ativo — soft-delete flag ("remover voluntário" keeps the
--      history: demandas, comentários e atas continuam intactas; a conta
--      desativada some das listas e o layout bloqueia o acesso). Also
--      coordinator-only, same construction.
--   3. atualizar_meu_perfil() — SECURITY DEFINER self-service name edit.
--      RLS policy expressions cannot compare old/new rows (documented
--      PostgreSQL limitation), so pinning "only non-privileged columns"
--      cannot be expressed as a policy; the function IS the enforcement,
--      because it sets exactly one column for exactly the caller's row.
--   4. Column-level grants: once ANY column grant exists on a table, the
--      table-level grant stops applying — the coordinator's UPDATE (via
--      the 0002 policy) must therefore be granted every column the edit
--      screen touches: full_name, area_atuacao, ativo and role. Granting
--      these to `authenticated` is safe because NO non-coordinator row
--      policy exists to pair them with.

alter table public.profiles
  add column area_atuacao text,
  add column ativo boolean not null default true;

grant update (full_name, area_atuacao, ativo, role) on public.profiles to authenticated;

create or replace function public.atualizar_meu_perfil(novo_nome text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if trim(coalesce(novo_nome, '')) = '' then
    return false;
  end if;
  update public.profiles
    set full_name = trim(novo_nome)
    where id = (select auth.uid());
  return found;
end;
$$;

revoke execute on function public.atualizar_meu_perfil(text) from public, anon;
grant execute on function public.atualizar_meu_perfil(text) to authenticated;

-- roster_basico_sem_auth_uid_check
-- Remove o filtro `auth.uid() IS NOT NULL` da primeira versão: ele quebrava
-- chamadas com service_role (cron/admin, sem JWT) retornando 0 linhas.
-- O controle de acesso é o GRANT (só authenticated executa; anon/public
-- revogados) — mesmo shape das demais funções SECURITY DEFINER do repo.
create or replace function public.roster_basico()
returns table (id bigint, nome text, tem_conta boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select
    v.id,
    v.nome,
    exists (
      select 1 from public.profiles p where p.voluntario_id = v.id
    ) as tem_conta
  from public.voluntarios v
  where v.ativo
  order by v.nome;
$$;

revoke execute on function public.roster_basico() from public, anon;
grant execute on function public.roster_basico() to authenticated;

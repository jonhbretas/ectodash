-- roster_basico_com_profile_id
-- Inclui profile_id (nulo quando sem conta) para que a página de edição
-- normalize linhas antigas de demanda_responsaveis/membros que só têm
-- profile_id, sem precisar de SELECT em profiles (RLS restrito para
-- voluntario_comum). Colunas continuam não sensíveis.
drop function if exists public.roster_basico();
create function public.roster_basico()
returns table (id bigint, nome text, tem_conta boolean, profile_id uuid)
language sql
security definer
set search_path = ''
stable
as $$
  select
    v.id,
    v.nome,
    p.id is not null as tem_conta,
    p.id as profile_id
  from public.voluntarios v
  left join public.profiles p on p.voluntario_id = v.id
  where v.ativo
  order by v.nome;
$$;

revoke execute on function public.roster_basico() from public, anon;
grant execute on function public.roster_basico() to authenticated;

-- roster_basico_para_demandas
-- Expõe o roster mínimo (id, nome, tem_conta) de voluntários ATIVOS para
-- todo usuário autenticado, sem vazar PII (telefone, codigo_pf, etc.).
--
-- Contexto: as telas de demanda (/demandas/nova e /demandas/[id]/editar)
-- carregam o roster via SELECT direto em public.voluntarios, mas o RLS
-- (0017 + 0043) libera para voluntario_comum apenas a própria linha.
-- Resultado: Margrit (voluntario_comum) via só o próprio nome no picker e
-- não encontra o Daniel. A decisão de produto (2026-08-04) é que todo
-- voluntário ativo é atribuível em demandas.
--
-- Shape segue o precedente das funções SECURITY DEFINER do repo
-- (is_lider_of_area, buscar_voluntarios em 0017): SECURITY DEFINER /
-- STABLE / search_path vazio / revoke de public+anon + grant a
-- authenticated, com checagem de auth.uid() no corpo.
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
    and (select auth.uid()) is not null
  order by v.nome;
$$;

revoke execute on function public.roster_basico() from public, anon;
grant execute on function public.roster_basico() to authenticated;

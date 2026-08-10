-- supabase/migrations/0044_fix_profiles_escopo_cargos.sql
-- Corrige a recursão infinita de RLS introduzida na 0043 (SQLSTATE 42P17
-- em SELECT de voluntarios): a política de SELECT de profiles adicionada na
-- 0043 faz subconsulta direta em public.voluntarios, e a política
-- "voluntarios self view" (0017) consulta public.profiles — as duas
-- políticas se referenciam mutuamente, e o Postgres detecta o ciclo no
-- tempo de consulta, derrubando TODO select de voluntarios com 42P17.
--
-- Correção: o lookup do roster dentro da política de profiles passa por um
-- helper SECURITY DEFINER (voluntario_em_meu_escopo), que lê voluntarios
-- com privilégios do dono (sem RLS) e portanto não fecha o ciclo —
-- mesmo padrão de is_lider_of_area()/has_role() do repositório.
-- Fontes: 0043_cargos_acesso.sql [CITED: this repo]; erro confirmado em
-- teste ao vivo contra o projeto hospedado (42P17).

create or replace function public.voluntario_em_meu_escopo(target_voluntario_id bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.voluntarios v
    where v.id = target_voluntario_id
      and (
        (v.area_id is not null and (select public.coordena_area(v.area_id)))
        or (v.localidade_id is not null and (select public.coordena_localidade(v.localidade_id)))
      )
  );
$$;

revoke execute on function public.voluntario_em_meu_escopo(bigint) from public, anon;
grant execute on function public.voluntario_em_meu_escopo(bigint) to authenticated;

drop policy "voluntariado and area coordenadores can view profiles" on public.profiles;
create policy "voluntariado and area coordenadores can view profiles"
  on public.profiles
  for select
  to authenticated
  using (
    (select public.has_role('voluntariado'))
    or (area_atuacao is not null and (select public.is_lider_of_area(area_atuacao)))
    or (
      voluntario_id is not null
      and (select public.voluntario_em_meu_escopo(voluntario_id))
    )
  );

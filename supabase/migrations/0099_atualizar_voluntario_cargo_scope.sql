-- supabase/migrations/0099_atualizar_voluntario_cargo_scope.sql
-- Restaura a semântica cargo-aware da 0045 na assinatura canônica de 16 args
-- (a 0098 manteve o corpo da 0082, que regrediu três comportamentos):
--
--   1. UPDATE em public.profiles referenciava a coluna inexistente
--      "updated_at" (42703) — profiles não tem updated_at. Qualquer edição de
--      cadastro VINCULADO a uma conta quebrava (o teste voluntarios-rls
--      "atualizar_voluntario" falha exatamente aqui).
--   2. A resolução de permissão virou role-legado pura (sem
--      voluntario_manager_scope), então coordenadores por CARGO (0043) não
--      conseguem mais editar o roster do próprio escopo — o teste
--      cargos-acesso "pinagem na área e teto de papel" falha.
--   3. `role = p_papel` incondicional permitia a um voluntariado gravar
--      'coordenador_geral' no roster (o teste exige teto: role preservado).
--
-- Esta migração mantém a assinatura de 16 args da 0098 (p_epicom DEFAULT
-- NULL = preserva o valor atual) e restaura o corpo da 0045 + epicom.

create or replace function public.atualizar_voluntario(
  p_cadastro_id bigint,
  p_nome text,
  p_codigo_pf text,
  p_unidade text,
  p_org_depto text,
  p_funcao text,
  p_data_inicio date,
  p_data_saida date,
  p_obs text,
  p_area_atuacao text,
  p_papel public.app_role,
  p_areas_lideradas text[],
  p_ativo boolean,
  p_telefone1 text,
  p_telefone2 text,
  p_epicom boolean default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  manager public.app_role;
  target_area text;
  t_area_id bigint;
  t_localidade_id bigint;
  v_epicom_atual boolean;
  linked_profile uuid;
begin
  select area_atuacao, area_id, localidade_id, epicom
  into target_area, t_area_id, t_localidade_id, v_epicom_atual
  from public.voluntarios
  where id = p_cadastro_id;

  if not found then
    return false;
  end if;

  manager := public.voluntario_manager_role(target_area);
  if manager is null then
    manager := public.voluntario_manager_scope(t_area_id, t_localidade_id);
  end if;
  if manager is null then
    return false;
  end if;

  update public.voluntarios v
    set nome = trim(p_nome),
        codigo_pf = nullif(trim(coalesce(p_codigo_pf, '')), ''),
        unidade = nullif(trim(coalesce(p_unidade, '')), ''),
        org_depto = nullif(trim(coalesce(p_org_depto, '')), ''),
        funcao = nullif(trim(coalesce(p_funcao, '')), ''),
        data_inicio = p_data_inicio,
        data_saida = p_data_saida,
        obs = nullif(trim(coalesce(p_obs, '')), ''),
        area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
        role = case
          when manager = 'coordenador_geral' then p_papel
          else v.role
        end,
        areas_lideradas = case
          when manager = 'coordenador_geral' then coalesce(p_areas_lideradas, '{}'::text[])
          else v.areas_lideradas
        end,
        ativo = p_ativo,
        telefone1 = nullif(trim(coalesce(p_telefone1, '')), ''),
        telefone2 = nullif(trim(coalesce(p_telefone2, '')), ''),
        epicom = coalesce(p_epicom, v_epicom_atual, false)
    where v.id = p_cadastro_id;

  select id into linked_profile
  from public.profiles
  where voluntario_id = p_cadastro_id;

  if linked_profile is not null then
    if manager = 'coordenador_geral' then
      update public.profiles
        set full_name = trim(p_nome),
            area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
            role = p_papel,
            ativo = p_ativo
        where id = linked_profile;

      delete from public.lider_areas where lider_id = linked_profile;
      if p_papel = 'coordenador_area' then
        insert into public.lider_areas (lider_id, area)
        select distinct linked_profile, unnest(coalesce(p_areas_lideradas, '{}'::text[]));
      end if;
    else
      update public.profiles
        set full_name = trim(p_nome),
            area_atuacao = nullif(trim(coalesce(p_area_atuacao, '')), ''),
            ativo = p_ativo
        where id = linked_profile;
    end if;
  end if;

  return true;
end;
$$;

revoke execute on function public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  public.app_role, text[], boolean, text, text, boolean
) from public, anon;
grant execute on function public.atualizar_voluntario(
  bigint, text, text, text, text, text, date, date, text, text,
  public.app_role, text[], boolean, text, text, boolean
) to authenticated;

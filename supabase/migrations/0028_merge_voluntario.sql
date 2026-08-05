-- supabase/migrations/0028_merge_voluntario.sql
-- Merge de cadastros repetidos: vincula um cadastro "perdido" (roster sem
-- conta) a um perfil já cadastrado pelo link, movendo todas as referências
-- (responsáveis, membros, participantes de atas, atividades, áreas extras)
-- do cadastro antigo para o definitivo e apagando o duplicado.
--
-- Casos tratados:
--   - perfil já vinculado ao mesmo cadastro        -> 'ok'
--   - cadastro já vinculado a OUTRA conta          -> 'cadastro_ja_vinculado'
--   - perfil vinculado a um cadastro DIFERENTE     -> merge (move e apaga)
--   - perfil sem vínculo                           -> vincula direto
-- Caller: coordenador_geral | voluntariado (os gestores do roster).
-- Sources: 0017 vincular_meu_cadastro [CITED: this repo]; 0020/0023/0026
-- join-table shapes [CITED: this repo].

create or replace function public.mesclar_cadastro_voluntario(
  p_cadastro_id bigint,
  p_profile_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_id bigint;
  v_nome text;
  v_area text;
  v_ativo boolean;
  v_role public.app_role;
  v_cadastro_role public.app_role;
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid())
      and role in ('coordenador_geral', 'voluntariado')
  ) then
    return 'sem_permissao';
  end if;

  if not exists (select 1 from public.voluntarios where id = p_cadastro_id) then
    return 'cadastro_nao_encontrado';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    return 'perfil_nao_encontrado';
  end if;

  -- O cadastro alvo não pode estar vinculado a outra conta.
  if exists (
    select 1 from public.profiles
    where voluntario_id = p_cadastro_id and id <> p_profile_id
  ) then
    return 'cadastro_ja_vinculado';
  end if;

  select nome, area_atuacao, ativo, role
    into v_nome, v_area, v_ativo, v_cadastro_role
  from public.voluntarios
  where id = p_cadastro_id;

  -- Cadastro atualmente vinculado ao perfil (se houver) — será mesclado.
  select voluntario_id into v_old_id
  from public.profiles
  where id = p_profile_id;

  if v_old_id is not null and v_old_id <> p_cadastro_id then
    -- Nenhuma outra conta pode apontar para o cadastro antigo.
    if exists (
      select 1 from public.profiles
      where voluntario_id = v_old_id and id <> p_profile_id
    ) then
      return 'cadastro_ja_vinculado';
    end if;

    -- Move as referências (dedupe: remove conflitos no destino primeiro).
    delete from public.demanda_responsaveis t
    where t.voluntario_id = p_cadastro_id
      and exists (
        select 1 from public.demanda_responsaveis o
        where o.voluntario_id = v_old_id and o.demanda_id = t.demanda_id
      );
    update public.demanda_responsaveis
      set voluntario_id = p_cadastro_id
      where voluntario_id = v_old_id;

    delete from public.demanda_membros t
    where t.voluntario_id = p_cadastro_id
      and exists (
        select 1 from public.demanda_membros o
        where o.voluntario_id = v_old_id and o.demanda_id = t.demanda_id
      );
    update public.demanda_membros
      set voluntario_id = p_cadastro_id
      where voluntario_id = v_old_id;

    delete from public.ata_participantes t
    where t.voluntario_id = p_cadastro_id
      and exists (
        select 1 from public.ata_participantes o
        where o.voluntario_id = v_old_id and o.ata_id = t.ata_id
      );
    update public.ata_participantes
      set voluntario_id = p_cadastro_id
      where voluntario_id = v_old_id;

    update public.voluntario_atividades
      set voluntario_id = p_cadastro_id
      where voluntario_id = v_old_id
        and not exists (
          select 1 from public.voluntario_atividades o
          where o.voluntario_id = p_cadastro_id and o.atividade = voluntario_atividades.atividade
        );
    delete from public.voluntario_atividades
      where voluntario_id = v_old_id;

    update public.voluntario_areas
      set voluntario_id = p_cadastro_id
      where voluntario_id = v_old_id
        and not exists (
          select 1 from public.voluntario_areas o
          where o.voluntario_id = p_cadastro_id and o.area = voluntario_areas.area
        );
    delete from public.voluntario_areas
      where voluntario_id = v_old_id;

    -- Remove o duplicado (cascades limpam o que restou).
    delete from public.voluntarios where id = v_old_id;
  end if;

  -- Papel do perfil: mantém coordenador_geral já concedido; caso contrário
  -- aplica o papel pretendido do cadastro, com teto (nunca auto-concede
  -- coordenador_geral) — mesma regra do vincular_meu_cadastro (0017).
  select role into v_role from public.profiles where id = p_profile_id;
  if v_role <> 'coordenador_geral' then
    v_role := case
      when v_cadastro_role in ('financeiro', 'voluntariado', 'coordenador_area', 'voluntario_comum')
        then v_cadastro_role
      else 'voluntario_comum'
    end;
  end if;

  update public.profiles
    set voluntario_id = p_cadastro_id,
        vincular_pendente = false,
        full_name = v_nome,
        area_atuacao = v_area,
        role = v_role,
        ativo = v_ativo
    where id = p_profile_id;

  return 'ok';
end;
$$;

revoke execute on function public.mesclar_cadastro_voluntario(bigint, uuid) from public, anon;
grant execute on function public.mesclar_cadastro_voluntario(bigint, uuid) to authenticated;

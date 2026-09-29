-- supabase/migrations/0109_ouvidoria_identificada.sql
-- Ouvidoria IDENTIFICADA (fim do anonimato):
-- a pessoa passa a ser identificada ao enviar, para evitar uso anti
-- cosmoético do canal. O colegiado gestor vê autor (nome + e-mail) em
-- todos os relatos; a quebra de sigilo deixa de existir.
--
-- Compatibilidade:
--   - listar_relatos_anonimos(p_ciclo_id) é REDEFINIDA para devolver as
--     colunas de autoria (autor_id, autor_nome, autor_email). O app passa
--     a usar listar_relatos_ouvidoria(), que é um alias com o mesmo corpo.
--   - revelar_identidade_relato() e listar_quebras_ouvidoria() são mantidas
--     apenas para histórico/auditoria, mas o front não chama mais.
--   - ouvidoria_quebra_log é preservada (audit trail antigo).

-- ---------------------------------------------------------------------------
-- Listagem IDENTIFICADA para o colegiado — com autor (nome + e-mail).
-- Exige ciclo aberto ou concluído (lacrado = erro). Mesmos checks de
-- colegiado da 0095.
-- ---------------------------------------------------------------------------
create or replace function public.listar_relatos_ouvidoria(p_ciclo_id uuid)
returns table (
  id uuid,
  categoria text,
  sentimento text,
  mensagem text,
  status text,
  created_at timestamptz,
  nota_colegiado text,
  identidade_revelada boolean,
  autor_id uuid,
  autor_nome text,
  autor_email text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.eh_colegiado() then
    raise exception 'Exclusivo do colegiado gestor.';
  end if;
  select status into v_status from public.ouvidoria_ciclos where id = p_ciclo_id;
  if v_status is null then
    raise exception 'Ciclo não encontrado.';
  end if;
  if v_status = 'coletando' then
    raise exception 'Ciclo ainda lacrado — abra o ciclo na reunião do colegiado.';
  end if;

  return query
  select
    r.id, r.categoria, r.sentimento, r.mensagem, r.status,
    r.created_at, r.nota_colegiado, r.identidade_revelada,
    r.author_id, p.full_name, p.email
  from public.ouvidoria_relatos r
  left join public.profiles p on p.id = r.author_id
  where r.ciclo_id = p_ciclo_id
  order by r.created_at asc;
end;
$$;

revoke execute on function public.listar_relatos_ouvidoria(uuid) from public, anon;
grant execute on function public.listar_relatos_ouvidoria(uuid) to authenticated;

-- Redefine a função legada com o mesmo corpo identificado (compat: o app
-- antigo continua funcionando e já passa a ver a autoria).
-- DROP antes do CREATE: o Postgres não permite CREATE OR REPLACE quando o
-- tipo de retorno muda (SQLSTATE 42P13).
drop function if exists public.listar_relatos_anonimos(uuid);

create function public.listar_relatos_anonimos(p_ciclo_id uuid)
returns table (
  id uuid,
  categoria text,
  sentimento text,
  mensagem text,
  status text,
  created_at timestamptz,
  nota_colegiado text,
  identidade_revelada boolean,
  autor_id uuid,
  autor_nome text,
  autor_email text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado.';
  end if;
  if not public.eh_colegiado() then
    raise exception 'Exclusivo do colegiado gestor.';
  end if;
  select status into v_status from public.ouvidoria_ciclos where id = p_ciclo_id;
  if v_status is null then
    raise exception 'Ciclo não encontrado.';
  end if;
  if v_status = 'coletando' then
    raise exception 'Ciclo ainda lacrado — abra o ciclo na reunião do colegiado.';
  end if;

  return query
  select
    r.id, r.categoria, r.sentimento, r.mensagem, r.status,
    r.created_at, r.nota_colegiado, r.identidade_revelada,
    r.author_id, p.full_name, p.email
  from public.ouvidoria_relatos r
  left join public.profiles p on p.id = r.author_id
  where r.ciclo_id = p_ciclo_id
  order by r.created_at asc;
end;
$$;

revoke execute on function public.listar_relatos_anonimos(uuid) from public, anon;
grant execute on function public.listar_relatos_anonimos(uuid) to authenticated;

comment on table public.ouvidoria_relatos is 'Ouvidoria IDENTIFICADA: author_id visível ao colegiado gestor (fim do anonimato — uso responsável/cosmoético).';

-- Mesclagem de registros da Dinâmica DIP a partir de atas analisadas.
--
-- Problema: a análise de ata "incrementava" um DIP existente com UPDATE
-- direto, mas a política de UPDATE de public.dips (0043) só permite o
-- criador, o coordenador_geral ou o coordenador da localidade. Para os
-- demais analistas (coordenador_area / cargo com módulo 'analisar') o
-- PostgREST não alterava nenhuma linha e não retornava erro — o app
-- mostrava "DIP atualizado" sem nada mudar. Além disso o UPDATE
-- sobrescrevia participantes/observações (apagando dados antigos).
--
-- Solução: RPC SECURITY DEFINER estritamente ADITIVA, liberada para quem
-- pode analisar atas com IA (mesma regra de requireAnaliseComIA):
--   * participantes: o valor novo só substitui quando informado;
--   * observacoes: textos somados sem duplicar (mesclar_texto_reuniao);
--   * data_dip / pais: só preenchidos quando estavam vazios;
--   * nunca troca localidade, autoria nem a ata de origem.
-- A política de UPDATE direta continua igual (edição livre segue restrita).

create or replace function public.mesclar_dip_da_ata(
  p_dip_id bigint,
  p_participantes integer default null,
  p_observacoes text default null,
  p_data date default null,
  p_pais text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  atual public.dips;
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'Sessão expirada' using errcode = '42501';
  end if;

  select * into atual from public.dips where id = p_dip_id for update;
  if not found then
    raise exception 'Registro DIP % não encontrado', p_dip_id using errcode = 'P0002';
  end if;

  if not (
    atual.criado_por = uid
    or public.has_role('coordenador_geral')
    or public.has_role('coordenador_area')
    or public.tem_cargo_modulo('analisar')
    or (atual.localidade_id is not null and public.coordena_localidade(atual.localidade_id))
  ) then
    raise exception 'Sem permissão para atualizar este registro DIP' using errcode = '42501';
  end if;

  if p_participantes is not null and p_participantes < 0 then
    raise exception 'Participantes inválido' using errcode = '22023';
  end if;

  update public.dips set
    participantes = coalesce(p_participantes, atual.participantes),
    observacoes = public.mesclar_texto_reuniao(atual.observacoes, p_observacoes),
    data_dip = coalesce(atual.data_dip, p_data),
    pais = coalesce(nullif(btrim(atual.pais), ''), nullif(btrim(p_pais), ''), atual.pais)
  where id = atual.id;

  return atual.id;
end
$$;

revoke all on function public.mesclar_dip_da_ata(bigint, integer, text, date, text) from public, anon;
grant execute on function public.mesclar_dip_da_ata(bigint, integer, text, date, text) to authenticated;

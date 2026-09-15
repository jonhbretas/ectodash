-- supabase/migrations/0101_corrige_reuniao_14_09_2026.sql
-- Corrige a reunião auto-criada com data errada 14/09/2026 (segunda-feira).
-- Causa raiz: criarPauta/marcarPautaDiscutida formatavam o Date da
-- proximaTerca() via Intl com timeZone America/Sao_Paulo no servidor (UTC),
-- o que voltava um dia — 15/09 (terça, hoje) virava 14/09 (segunda).
-- O código agora usa formatarDataISO() (único formato seguro).
--
-- Reuniões acontecem sempre às terças; 14/09/2026 foi segunda. Esta migração
-- move a linha auto-criada ("Reunião 14/09/2026", status agendada, sem ata
-- preenchida) para 15/09/2026. Se já existir uma linha em 15/09, as pautas
-- vinculadas são re-apontadas para a linha mantida e a duplicada é removida.
-- Linhas com ata preenchida (resumo/pontos/deliberacoes) nunca são tocadas.

do $$
declare
  v_errada_id bigint;
  v_certa_id bigint;
begin
  select id into v_errada_id
  from public.reunioes
  where data_reuniao = date '2026-09-14'
    and titulo = 'Reunião 14/09/2026'
    and status = 'agendada'
    and coalesce(trim(resumo), '') = ''
    and coalesce(trim(pontos_principais), '') = ''
    and coalesce(trim(deliberacoes), '') = ''
  order by id
  limit 1;

  if v_errada_id is null then
    return;
  end if;

  select id into v_certa_id
  from public.reunioes
  where data_reuniao = date '2026-09-15'
  order by id
  limit 1;

  if v_certa_id is null then
    update public.reunioes
    set data_reuniao = date '2026-09-15',
        titulo = 'Reunião 15/09/2026'
    where id = v_errada_id;
  else
    -- Re-aponta vínculos da duplicada para a linha mantida
    update public.pautas
    set reuniao_selecionada_id = v_certa_id
    where reuniao_selecionada_id = v_errada_id;

    update public.pautas
    set ata_id = v_certa_id
    where ata_id = v_errada_id;

    update public.pautas
    set ata_discutida_id = v_certa_id
    where ata_discutida_id = v_errada_id;

    update public.dips
    set ata_id = v_certa_id
    where ata_id = v_errada_id;

    update public.ata_participantes
    set ata_id = v_certa_id
    where ata_id = v_errada_id;

    delete from public.reunioes where id = v_errada_id;
  end if;
end
$$;

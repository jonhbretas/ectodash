-- supabase/migrations/0075_vincular_participantes_atas.sql
-- Backfill: associa os participantes em texto livre das atas existentes
-- (reunioes.participantes) aos cadastros do roster (ata_participantes).
--
-- Antes desta migration nenhuma ata tinha vínculo estruturado — o contador
-- "Participação em reuniões gerais" no perfil do voluntário ficava zerado.
-- A lógica espelha o matcher do app (src/lib/ai/match-responsavel.ts):
--   1. match exato (nome normalizado: minúsculas + sem acentos)
--   2. primeiro token + último token (lida com nomes encurtados no roster:
--      "Almir dos Santos Pereira" -> "Almir Pereira")
--   3. menção contida no nome do roster (min 5 chars):
--      "Jaqueline" -> "Jaqueline Barcellos"
--   4. nome do roster contido na menção (min 5 chars):
--      "Mariana Cabral Schveitzer" -> "Mariana Cabral"
-- Ambiguidade no topo (dois voluntários com o mesmo score) => sem vínculo;
-- o criador vincula manualmente na tela da ata. Só voluntários ativos.
-- criado_por herda o criador da ata (auth.uid() é null fora de sessão).

-- Normalização de nome idêntica à do app (NFD + minúsculas): translate
-- remove acentos sem depender da extensão unaccent.
create or replace function public.normalizar_nome(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(translate(
    trim(coalesce(value, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
  ))
$$;

revoke all on function public.normalizar_nome(text) from public, anon, authenticated;

-- Tenta vincular um nome de participante ao melhor voluntário do roster.
create or replace function public.vincular_participante_ata(p_ata_id bigint, p_nome text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_needle text := public.normalizar_nome(p_nome);
  v_tokens text[];
  v_hay text;
  v_hay_tokens text[];
  v_score int;
  v_best_vol bigint := null;
  v_best_score int := 0;
  v_ties boolean := false;
  v_criado_por uuid;
  v_row record;
begin
  if v_needle = '' then
    return;
  end if;

  v_tokens := regexp_split_to_array(v_needle, '\s+');
  if v_tokens is null or array_length(v_tokens, 1) = 0 then
    return;
  end if;

  select criado_por into v_criado_por
  from public.reunioes
  where id = p_ata_id;
  if v_criado_por is null then
    return;
  end if;

  for v_row in
    select v.id, public.normalizar_nome(v.nome) as h
    from public.voluntarios v
    where v.ativo
  loop
    v_hay := v_row.h;
    v_hay_tokens := regexp_split_to_array(v_hay, '\s+');
    if v_hay = '' or v_hay_tokens is null or array_length(v_hay_tokens, 1) = 0 then
      continue;
    end if;

    if v_hay = v_needle then
      v_score := 5;
    elsif array_length(v_tokens, 1) >= 2
      and array_length(v_hay_tokens, 1) >= 2
      and v_hay_tokens[1] = v_tokens[1]
      and v_hay_tokens[array_length(v_hay_tokens, 1)]
        = v_tokens[array_length(v_tokens, 1)] then
      v_score := 4;
    elsif length(v_needle) >= 5 and position(v_needle in v_hay) > 0 then
      v_score := 3;
    elsif length(v_hay) >= 5 and position(v_hay in v_needle) > 0 then
      v_score := 2;
    else
      v_score := 0;
    end if;

    if v_score = 0 then
      continue;
    end if;

    if v_score > v_best_score then
      v_best_vol := v_row.id;
      v_best_score := v_score;
      v_ties := false;
    elsif v_score = v_best_score then
      if v_row.id is distinct from v_best_vol then
        v_ties := true;
      end if;
    end if;
  end loop;

  if v_best_vol is not null and not v_ties then
    insert into public.ata_participantes (ata_id, voluntario_id, criado_por)
    values (p_ata_id, v_best_vol, v_criado_por)
    on conflict (ata_id, voluntario_id) do nothing;
  end if;
end;
$$;

revoke all on function public.vincular_participante_ata(bigint, text) from public, anon, authenticated;

-- Backfill: cada linha de participantes vira um nome candidato (suporta
-- separador de vírgula além da quebra de linha usada pelo app).
do $$
declare
  v_ata record;
  v_nome text;
begin
  for v_ata in
    select id, participantes
    from public.reunioes
    where participantes is not null
      and btrim(participantes) <> ''
  loop
    for v_nome in
      select btrim(unnest(string_to_array(
        regexp_replace(v_ata.participantes, '\s*,\s*', E'\n', 'g'),
        E'\n'
      ))) as n
    loop
      if v_nome <> '' then
        perform public.vincular_participante_ata(v_ata.id, v_nome);
      end if;
    end loop;
  end loop;
end;
$$;

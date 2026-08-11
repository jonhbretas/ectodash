-- supabase/migrations/0060_fix_audit_entidade_id_texto.sql
-- Correção no trigger do audit_log (0059): extrair o valor da PK composta com
-- `jsonb ->` e depois `::text` mantém as ASPAS literais de colunas text/uuid
-- (ex.: '2685 | "abc-1234..."') — quebra o formato "id1 | id2" das PKs
-- compostas (demanda_responsaveis, lider_areas, voluntario_areas,
-- ata_participantes), onde o perfil é uuid. `#>>` devolve o valor como texto
-- puro sem aspas. Colunas numéricas não eram afetadas (jsonb number ::text
-- não tem aspas), por isso as entidade_id simples de bigint seguem intactas
-- nas linhas já gravadas.
create or replace function public.registrar_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_linha_antes jsonb;
  v_linha_depois jsonb;
  v_col text;
  v_partes text[] := '{}';
  v_id text;
begin
  if tg_op = 'UPDATE'
     and (to_jsonb(old) - 'updated_at') is not distinct from (to_jsonb(new) - 'updated_at')
  then
    return null;
  end if;

  v_linha_antes := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_linha_depois := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;

  foreach v_col in array string_to_array(tg_argv[0], ',') loop
    v_col := btrim(v_col);
    if tg_op = 'DELETE' then
      v_partes := v_partes || coalesce((v_linha_antes #>> v_col), 'null');
    else
      v_partes := v_partes || coalesce((v_linha_depois #>> v_col), 'null');
    end if;
  end loop;
  v_id := nullif(array_to_string(v_partes, ' | '), '');

  insert into public.audit_log (profile_id, acao, entidade, entidade_id, before_data, after_data)
  values ((select auth.uid()), tg_op, tg_table_name, v_id, v_linha_antes, v_linha_depois);

  return null;
end;
$$;

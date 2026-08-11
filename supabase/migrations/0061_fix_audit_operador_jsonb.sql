-- supabase/migrations/0061_fix_audit_operador_jsonb.sql
-- Correção do operador jsonb na função registrar_audit: a 0060 usou `#>>`
-- que NÃO existe como `jsonb #>> text` no Postgres (só `#>> text[]`) — o
-- operador de extração de texto de uma única chave é `->>` (retorna text
-- sem as aspas literais que o `-> ... ::text` da 0059 produzia). Efeito
-- colateral da 0060: QUALQUER escrita em tabela auditada falhava no
-- trigger (ex.: "Database error creating new user" no signup, via
-- handle_new_user -> profiles -> audit trigger).
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
      v_partes := v_partes || coalesce((v_linha_antes ->> v_col), 'null');
    else
      v_partes := v_partes || coalesce((v_linha_depois ->> v_col), 'null');
    end if;
  end loop;
  v_id := nullif(array_to_string(v_partes, ' | '), '');

  insert into public.audit_log (profile_id, acao, entidade, entidade_id, before_data, after_data)
  values ((select auth.uid()), tg_op, tg_table_name, v_id, v_linha_antes, v_linha_depois);

  return null;
end;
$$;

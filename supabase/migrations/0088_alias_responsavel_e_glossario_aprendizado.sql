-- supabase/migrations/0088_alias_responsavel_e_glossario_aprendizado.sql
-- Aliases de responsável + aprendizado automático do dicionário.
--
-- 1) alias_responsaveis — quando a IA extrai "dar o van brum" mas o
--    operador corrige manualmente para "Dalvan Brum" (voluntarios.id),
--    a correção é salva como alias. Próximas análises que trouxerem
--    "dar o van brum" já resolvem automaticamente para o voluntário
--    correto via buscar_alias(), sem nova intervenção manual.
--
-- 2) registrar_aprendizado_glossario() — SECURITY DEFINER que permite
--    que qualquer análise (coordenador_geral, coordenador_area etc.)
--    registre automaticamente um novo termo no dicionário (glossary_terms)
--    quando o operador corrige um erro de transcrição como "DEEEP" → "DIP"
--    ou "D e P" → "DIP". A RLS de glossary_terms só deixa coordenador_geral
--    escrever direto; esta função é a porteira controlada para o aprendizado
--    automático (on conflict = já existe, não duplica).
--
-- 3) buscar_alias(termo_busca) — lookup case/acento-insensível usado
--    por analisarComIA antes do fallback heurístico de nome.

-- Extensão para comparação sem acento (se disponível no projeto; falha
-- silenciosa se já existir ou se a permissão não permitir).
create extension if not exists unaccent with schema public;

create table if not exists public.alias_responsaveis (
  id bigint generated always as identity primary key,
  termo text not null unique check (char_length(trim(termo)) > 0),
  voluntario_id bigint not null references public.voluntarios(id) on delete cascade,
  criado_por uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists alias_responsaveis_voluntario_id_idx on public.alias_responsaveis (voluntario_id);
create index if not exists alias_responsaveis_termo_idx on public.alias_responsaveis (termo);

alter table public.alias_responsaveis enable row level security;

drop policy if exists "authenticated users can view alias_responsaveis" on public.alias_responsaveis;
create policy "authenticated users can view alias_responsaveis"
  on public.alias_responsaveis for select to authenticated using (true);

drop policy if exists "authenticated users can create alias_responsaveis" on public.alias_responsaveis;
create policy "authenticated users can create alias_responsaveis"
  on public.alias_responsaveis for insert to authenticated
  with check (criado_por = (select auth.uid()));

drop policy if exists "creator or coordinator can update alias_responsaveis" on public.alias_responsaveis;
create policy "creator or coordinator can update alias_responsaveis"
  on public.alias_responsaveis for update to authenticated
  using (criado_por = (select auth.uid()) or (select public.has_role('coordenador_geral')))
  with check (criado_por = (select auth.uid()) or (select public.has_role('coordenador_geral')));

drop policy if exists "creator or coordinator can delete alias_responsaveis" on public.alias_responsaveis;
create policy "creator or coordinator can delete alias_responsaveis"
  on public.alias_responsaveis for delete to authenticated
  using (criado_por = (select auth.uid()) or (select public.has_role('coordenador_geral')));

-- Normalização usada por buscar_alias: lower + trim + unaccent quando disponível.
-- Fallback para lower(trim) se unaccent não estiver instalada.
create or replace function public._normalize_alias(p_input text)
returns text language plpgsql immutable
set search_path = ''
as $$
declare
  v text;
begin
  v := lower(trim(p_input));
  -- Tenta unaccent se a extensão estiver disponível; ignora erro caso não esteja.
  begin
    v := public.unaccent(v);
  exception when others then
    -- sem unaccent — segue só com lower/trim
    null;
  end;
  -- Remove acentos restantes via translate como fallback leve
  v := translate(v,
    'áàãâäéèêëíìîïóòõôöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn');
  return v;
end;
$$;

create or replace function public.buscar_alias(termo_busca text)
returns bigint
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_norm text;
  v_id bigint;
begin
  if termo_busca is null or char_length(trim(termo_busca)) = 0 then
    return null;
  end if;
  v_norm := public._normalize_alias(termo_busca);
  select voluntario_id into v_id
  from public.alias_responsaveis
  where public._normalize_alias(termo) = v_norm
  limit 1;
  return v_id;
end;
$$;

-- Aprendizado do dicionário: qualquer análise autenticada pode registrar
-- um novo termo. A função roda como DEFINER para contornar a RLS de
-- glossary_terms (que só permite coordenador_geral), mas com checagem
-- mínima: termo e replacement não vazios e termo ainda não existe.
create or replace function public.registrar_aprendizado_glossario(
  p_term text,
  p_replacement text,
  p_description text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_term text := trim(p_term);
  v_repl text := trim(p_replacement);
begin
  if char_length(v_term) = 0 or char_length(v_repl) = 0 then
    return null;
  end if;
  -- Evita duplicar exatamente o mesmo termo (case/acento-insensível aproximado
  -- via índice unique em term já cobre case sensível; aqui só evita óbvio).
  insert into public.glossary_terms (term, replacement, description, active)
  values (v_term, v_repl, p_description, true)
  on conflict (term) do nothing
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.registrar_aprendizado_glossario(text, text, text) from public;
grant execute on function public.registrar_aprendizado_glossario(text, text, text) to authenticated;

revoke all on function public.buscar_alias(text) from public;
grant execute on function public.buscar_alias(text) to authenticated;

revoke all on function public._normalize_alias(text) from public;
grant execute on function public._normalize_alias(text) to authenticated;

-- Auditoria (mesma trilha 0059)
drop trigger if exists audit_alias_responsaveis on public.alias_responsaveis;
create trigger audit_alias_responsaveis
  after insert or update or delete on public.alias_responsaveis
  for each row execute function public.registrar_audit('id');

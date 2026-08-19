-- supabase/migrations/0079_glossary_terms.sql
-- Dicionário de termos para a IA: palavras do jargão da conscienciologia
-- (e siglas erradas de transcrição, ex.: "SIAEC" → "CEAEC") que são
-- traduzidas automaticamente para o termo correto antes de qualquer
-- análise de transcrição de reunião (reunioes/analise-actions) ou geração
-- de cards (utilidades).
--
-- Leitura é aberta a todo voluntário autenticado (a IA usa a mesma
-- sessão do operador). Cadastro/edição/exclusão são exclusivos do
-- coordenador_geral: o dicionário é configuração do sistema e a RLS é a
-- fronteira real (os gates de servidor são só a primeira barreira).
-- Usa o trigger set_updated_at (0003) e o trilho de auditoria (0059).

create table public.glossary_terms (
  id bigint generated always as identity primary key,
  term text not null unique check (char_length(trim(term)) > 0),
  replacement text not null check (char_length(trim(replacement)) > 0),
  description text,
  active boolean not null default true,
  criado_por uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index glossary_terms_active_idx on public.glossary_terms (active);

alter table public.glossary_terms enable row level security;

-- Todo autenticado pode ler — o dicionário também alimenta a análise de
-- transcrições executada com a sessão de cada operador.
create policy "authenticated users can view glossary terms"
  on public.glossary_terms
  for select
  to authenticated
  using (true);

-- Gestão restrita ao coordenador_geral (has_role, 0016).
create policy "coordenador_geral can insert glossary terms"
  on public.glossary_terms
  for insert
  to authenticated
  with check (
    criado_por = (select auth.uid())
    and (select public.has_role('coordenador_geral'))
  );

create policy "coordenador_geral can update glossary terms"
  on public.glossary_terms
  for update
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create policy "coordenador_geral can delete glossary terms"
  on public.glossary_terms
  for delete
  to authenticated
  using ((select public.has_role('coordenador_geral')));

drop trigger if exists glossary_terms_set_updated_at on public.glossary_terms;
create trigger glossary_terms_set_updated_at
  before update on public.glossary_terms
  for each row execute function public.set_updated_at();

-- Trilho de auditoria genérico (0059).
create trigger audit_glossary_terms
  after insert or update or delete on public.glossary_terms
  for each row execute function public.registrar_audit('id');

-- Termos iniciais: erros típicos de transcrição automática de reuniões.
insert into public.glossary_terms (term, replacement, description, criado_por)
select 'SIAEC', 'CEAEC', 'Erro comum de transcrição: sigla do Centro Internacional de Estudos da Conscienciologia.', p.id
from public.profiles p
order by p.created_at
limit 1
on conflict (term) do nothing;

insert into public.glossary_terms (term, replacement, description, criado_por)
select 'UNISSIM', 'UNICIN', 'Erro comum de transcrição: sigla do Instituto de Projeciologia e Conscienciologia.', p.id
from public.profiles p
order by p.created_at
limit 1
on conflict (term) do nothing;

-- Exploração do sistema e leitura dos roteiros; não certifica formação.
create table public.jornada_exploracao (
  profile_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  etapa_id text not null check (etapa_id in (
    'voluntario:boas-vindas', 'voluntario:fundamentos', 'voluntario:intermediario',
    'voluntario:docencia', 'voluntario:especializacao',
    'docente:livro', 'docente:curso-ead', 'docente:curso-autoorg',
    'docente:proep', 'docente:ogb', 'docente:dip', 'docente:proposicao',
    'sistema:perfil', 'sistema:eventos', 'sistema:utilidades'
  )),
  explorada_em timestamptz not null default now(),
  primary key (profile_id, etapa_id)
);

alter table public.jornada_exploracao enable row level security;
revoke all on public.jornada_exploracao from anon, authenticated;
grant select, insert on public.jornada_exploracao to authenticated;
grant all on public.jornada_exploracao to service_role;

create policy "Pessoa consulta sua exploração"
  on public.jornada_exploracao for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "Pessoa registra sua exploração"
  on public.jornada_exploracao for insert to authenticated
  with check (profile_id = (select auth.uid()));

comment on table public.jornada_exploracao is
  'Marcos pessoais de exploração. Cada etapa pontua uma vez; não representa conclusão de cursos.';

-- supabase/migrations/20261020231500_feedback_comentarios.sql
-- Conversa em cada relato de bug/sugestão: o autor do relato e a
-- coordenação geral comentam no mesmo fio (pedir detalhes, avisar
-- correção, confirmar que resolveu). Cada comentário notifica o outro
-- lado pela tabela notificacoes (0070).

create table public.feedback_comentarios (
  id bigint generated always as identity primary key,
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conteudo text not null check (length(trim(conteudo)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index feedback_comentarios_feedback_idx
  on public.feedback_comentarios (feedback_id, created_at);

alter table public.feedback_comentarios enable row level security;

-- Mesmo escopo de leitura do relato: o autor dele ou o coordenador geral.
create policy "feedback comentarios select autor ou coordenador"
  on public.feedback_comentarios
  for select
  to authenticated
  using (
    exists (
      select 1 from public.feedback f
      where f.id = feedback_id
        and (
          f.user_id = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'coordenador_geral'
          )
        )
    )
  );

create policy "feedback comentarios insert autor ou coordenador"
  on public.feedback_comentarios
  for insert
  to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (
      select 1 from public.feedback f
      where f.id = feedback_id
        and (
          f.user_id = (select auth.uid())
          or exists (
            select 1 from public.profiles p
            where p.id = (select auth.uid()) and p.role = 'coordenador_geral'
          )
        )
    )
  );

-- Sem update/delete: o fio é histórico, como demanda_comentarios.

create trigger audit_feedback_comentarios
  after insert or update or delete on public.feedback_comentarios
  for each row execute function public.registrar_audit('id');

alter table public.notificacoes drop constraint if exists notificacoes_tipo_check;
alter table public.notificacoes
  add constraint notificacoes_tipo_check
  check (tipo in ('feedback_resolvido', 'feedback_comentario'));

-- Comentário do autor → avisa cada coordenador geral ativo.
-- Comentário da coordenação → avisa o autor do relato.
create or replace function public.notificar_feedback_comentario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rel public.feedback%rowtype;
  nome_autor text;
  trecho text;
begin
  select * into rel from public.feedback where id = new.feedback_id;
  if not found then
    return new;
  end if;

  select coalesce(nullif(trim(full_name), ''), email, 'Alguém')
    into nome_autor
    from public.profiles where id = new.autor_id;

  trecho := left(trim(new.conteudo), 140);
  if length(trim(new.conteudo)) > 140 then
    trecho := trecho || '…';
  end if;

  if new.autor_id = rel.user_id then
    insert into public.notificacoes (user_id, tipo, titulo, mensagem, link)
    select p.id,
           'feedback_comentario',
           'Novo comentário em um relato',
           nome_autor || ' comentou: "' || trecho || '"',
           '/feedback'
      from public.profiles p
     where p.role = 'coordenador_geral'
       and p.ativo
       and p.id <> new.autor_id;
  else
    insert into public.notificacoes (user_id, tipo, titulo, mensagem, link)
    values (
      rel.user_id,
      'feedback_comentario',
      'Resposta no seu relato',
      nome_autor || ' respondeu: "' || trecho || '"',
      '/feedback'
    );
  end if;
  return new;
end;
$$;

create trigger trg_notificar_feedback_comentario
  after insert on public.feedback_comentarios
  for each row
  execute function public.notificar_feedback_comentario();

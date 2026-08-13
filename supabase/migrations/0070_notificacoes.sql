-- supabase/migrations/0070_notificacoes.sql
-- Notificações para usuários: quando um feedback (bug ou sugestão) do
-- autor é marcado como "resolvido" pelo coordenador, o autor ganha uma
-- notificação que aparece ao logar — "Sua solicitação foi atendida".
--
-- A tabela só recebe inserts via trigger SECURITY DEFINER (o trigger roda
-- com o owner da tabela, sem RLS), então não há policy de insert: nenhum
-- usuário consegue criar notificações para si ou para outros.

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('feedback_resolvido')),
  titulo text not null,
  mensagem text not null,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index notificacoes_user_lida_idx on public.notificacoes (user_id, lida);

alter table public.notificacoes enable row level security;

create policy "notificacoes select own"
  on public.notificacoes
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "notificacoes update own"
  on public.notificacoes
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Dispara uma notificação para o autor quando o status do feedback muda
-- para "resolvido". Guard na transição: só dispara quando o status antigo
-- não era resolvido, então re-salar um relato já resolvido não duplica.
create or replace function public.notificar_feedback_resolvido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trecho text;
begin
  if new.status = 'resolvido' and old.status is distinct from 'resolvido' then
    trecho := left(trim(new.mensagem), 140);
    if length(trim(new.mensagem)) > 140 then
      trecho := trecho || '…';
    end if;

    insert into public.notificacoes (user_id, tipo, titulo, mensagem, link)
    values (
      new.user_id,
      'feedback_resolvido',
      'Sua solicitação foi atendida',
      case
        when new.tipo = 'bug'
          then 'O bug que você reportou foi resolvido: "' || trecho || '"'
        else 'A melhoria que você sugeriu foi realizada: "' || trecho || '"'
      end,
      '/feedback'
    );
  end if;
  return new;
end;
$$;

create trigger trg_notificar_feedback_resolvido
  after update of status on public.feedback
  for each row
  execute function public.notificar_feedback_resolvido();

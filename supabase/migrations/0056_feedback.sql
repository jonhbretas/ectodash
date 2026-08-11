-- supabase/migrations/0056_feedback.sql
-- Feedback dos usuários: reportar bugs ou sugerir melhorias pelo botão
-- flutuante do EctoDash. Autosserviço: cada usuário insere e consulta os
-- próprios envios; coordenadores gerais enxergam tudo e podem atualizar o
-- status de acompanhamento.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('bug', 'sugestao')),
  mensagem text not null check (length(trim(mensagem)) between 5 and 2000),
  pagina text,
  navegador text,
  status text not null default 'novo' check (status in ('novo', 'visto', 'resolvido')),
  created_at timestamptz not null default now()
);

create index feedback_user_id_idx on public.feedback (user_id);
create index feedback_status_idx on public.feedback (status);

alter table public.feedback enable row level security;

create policy "feedback select own"
  on public.feedback
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "feedback select all for coordinators"
  on public.feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'coordenador_geral'
    )
  );

create policy "feedback insert own"
  on public.feedback
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "feedback update status for coordinators"
  on public.feedback
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'coordenador_geral'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'coordenador_geral'
    )
  );

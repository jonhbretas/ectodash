-- supabase/migrations/0069_feedback_anexos.sql
-- Anexos de imagem no feedback (bug/sugestão). O usuário envia até 3
-- imagens junto com a mensagem; os arquivos ficam num bucket privado com
-- caminho {user_id}/{uuid}.{ext} — o dono vê os próprios, o coordenador
-- geral vê todos (mesmo modelo de RLS da tabela feedback, migration 0056).

alter table public.feedback
  add column anexos jsonb;

insert into storage.buckets (id, name, public)
values ('feedback-anexos', 'feedback-anexos', false)
on conflict (id) do nothing;

create policy "feedback anexos insert own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'feedback-anexos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "feedback anexos select owner or coordinator"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'feedback-anexos'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role = 'coordenador_geral'
      )
    )
  );

create policy "feedback anexos delete own folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'feedback-anexos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

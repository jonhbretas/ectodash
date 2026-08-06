-- supabase/migrations/0038_proep_drive_folders.sql
-- Estrutura de pastas do PROEP no Google Drive:
--   PROEP (central)/
--     Comum/                        ← materiais compartilhados (criado manualmente)
--     PROEP AGO 26/                 ← 1 pasta por turma (edição)
--       Alunos/...                  ← pasta do aluno com arquivos clonados
--
-- proep_settings: chave/valor globais (ex.: id da pasta central).
-- proep_edition_config: pasta do Drive por turma (edition_id → eventos.id).

create table public.proep_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create table public.proep_edition_config (
  edition_id bigint primary key references public.eventos(id) on delete cascade,
  drive_folder_id text,
  drive_folder_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proep_settings enable row level security;
alter table public.proep_edition_config enable row level security;

create policy "authenticated can view proep_settings" on public.proep_settings for select to authenticated using (true);
create policy "authenticated can manage proep_settings" on public.proep_settings for all to authenticated using (true) with check (true);

create policy "authenticated can view proep_edition_config" on public.proep_edition_config for select to authenticated using (true);
create policy "authenticated can manage proep_edition_config" on public.proep_edition_config for all to authenticated using (true) with check (true);

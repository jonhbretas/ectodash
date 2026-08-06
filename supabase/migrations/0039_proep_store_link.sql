-- supabase/migrations/0039_proep_store_link.sql
-- Vínculo entre a loja (WooCommerce) e o PROEP:
-- 1. wp_customers.courses: nomes dos cursos/produtos comprados (para exibir na tela Alunos)
-- 2. proep_students.source: origem do registro ('manual' | 'store')
-- 3. proep_students.wp_customer_id: id do cliente WooCommerce (vínculo dedup)

alter table public.wp_customers add column if not exists courses text[];

alter table public.proep_students add column if not exists source text not null default 'manual';
alter table public.proep_students add column if not exists wp_customer_id bigint;

-- Evita duplicar participante com o mesmo e-mail dentro da mesma turma
create unique index if not exists proep_students_edition_email_idx
  on public.proep_students (edition_id, lower(email)) where email is not null;

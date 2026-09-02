-- supabase/migrations/0092_ata_origem_cascade.sql
-- Excluir ata deve zerar tudo que foi adicionado por ela (user request).
-- Demandas/Eventos/Comentários gerados a partir da análise não tinham vínculo
-- com a ata — ficavam órfãos após delete. Agora cada insert carrega
-- origem_ata_id e a FK faz CASCADE, então excluir a ata limpa demandas,
-- eventos, comentários de atualização e pautas originadas dela.

-- Demandas originadas da ata
alter table public.demandas
  add column if not exists origem_ata_id bigint references public.reunioes(id) on delete cascade;
create index if not exists demandas_origem_ata_id_idx on public.demandas (origem_ata_id);

-- Eventos originados da ata (ex.: 25/06/2027 DIP à 8ª potência)
alter table public.eventos
  add column if not exists origem_ata_id bigint references public.reunioes(id) on delete cascade;
create index if not exists eventos_origem_ata_id_idx on public.eventos (origem_ata_id);

-- Comentários de atualização ("Atualização da reunião ...") — também origem da ata
alter table public.demanda_comentarios
  add column if not exists origem_ata_id bigint references public.reunioes(id) on delete cascade;
create index if not exists demanda_comentarios_origem_ata_id_idx on public.demanda_comentarios (origem_ata_id);

-- Pautas: já tem ata_id, mas estava ON DELETE SET NULL — vira CASCADE para pautas de origem 'ata'
-- (manuais têm ata_id NULL e não são afetadas)
do $$
begin
  -- tenta remover a FK antiga (nome padrão do Postgres); ignora se não existir
  begin
    alter table public.pautas drop constraint if exists pautas_ata_id_fkey;
  exception when others then null;
  end;
  begin
    alter table public.pautas drop constraint if exists pautas_ata_id_fkey1;
  exception when others then null;
  end;
end $$;

alter table public.pautas
  add constraint pautas_ata_id_fkey foreign key (ata_id) references public.reunioes(id) on delete cascade;

-- Recria view que depende de demandas (adicionou coluna, precisa refrescar)
drop view if exists public.demandas_com_status;
create view public.demandas_com_status
with (security_invoker = true) as
select
  d.*,
  (d.prazo < current_date and d.status <> 'concluida') as atrasada
from public.demandas d;

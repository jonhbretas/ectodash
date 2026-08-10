-- supabase/migrations/0047_contratos_eventos.sql
-- Gestão de contratos POR EVENTO (decisão 2026-08-10):
--   - contrato_evento_modelos: modelos habilitados por evento, com texto
--     personalizado opcional por evento (override individual);
--   - contrato_evento_produtos: vínculo evento ↔ produto da loja (WooCommerce)
--     — alunos inscritos = clientes que compraram esses produtos
--     (wp_customers.courses contém os nomes dos produtos comprados);
--   - contratos.expira_em: prazo de assinatura (15 dias padrão) — vencido é
--     derivado na leitura (expira_em < hoje e status em gerado/assinando);
--   - contratos.conteudo_utilizado: snapshot do texto efetivamente usado na
--     geração (override do evento ou texto do modelo) — o PDF regenerado e o
--     reenvio para assinatura usam SEMPRE o mesmo texto gerado.

create table public.contrato_evento_modelos (
  evento_id bigint not null references public.eventos(id) on delete cascade,
  modelo_id bigint not null references public.contrato_modelos(id) on delete cascade,
  conteudo_personalizado text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (evento_id, modelo_id)
);

create table public.contrato_evento_produtos (
  evento_id bigint not null references public.eventos(id) on delete cascade,
  wp_product_id bigint not null,
  nome_produto text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (evento_id, wp_product_id)
);

alter table public.contratos add column expira_em date;
alter table public.contratos add column conteudo_utilizado text;

alter table public.contrato_evento_modelos enable row level security;
alter table public.contrato_evento_produtos enable row level security;

create policy "authenticated can view contrato_evento_modelos"
  on public.contrato_evento_modelos
  for select
  to authenticated
  using (true);

create policy "coordinator manages contrato_evento_modelos"
  on public.contrato_evento_modelos
  for all
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create policy "authenticated can view contrato_evento_produtos"
  on public.contrato_evento_produtos
  for select
  to authenticated
  using (true);

create policy "coordinator manages contrato_evento_produtos"
  on public.contrato_evento_produtos
  for all
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create trigger contrato_evento_modelos_set_updated_at
  before update on public.contrato_evento_modelos
  for each row
  execute function public.set_updated_at();

create trigger contrato_evento_produtos_set_updated_at
  before update on public.contrato_evento_produtos
  for each row
  execute function public.set_updated_at();

-- "quais contratos estão pendentes de assinatura e podem vencer"
create index contratos_expira_em_idx
  on public.contratos (expira_em)
  where status in ('gerado', 'assinando');

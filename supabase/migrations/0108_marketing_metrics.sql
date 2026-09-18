-- supabase/migrations/0108_marketing_metrics.sql
-- Métricas máximas por campanha:
-- 1. recipients.delivered_at (evento email.delivered).
-- 2. marketing_link_clicks (evento email.clicked, 1 linha por clique,
--    com dedup por svix-id). Leitura coordenador_geral OU
--    tem_cargo_modulo('marketing'); escrita só service-role.

alter table public.marketing_recipients
  add column delivered_at timestamptz;

create table public.marketing_link_clicks (
  id bigint generated always as identity primary key,
  campaign_id bigint not null
    references public.marketing_campaigns(id) on delete cascade,
  recipient_id bigint references public.marketing_recipients(id) on delete set null,
  url text not null,
  clicked_at timestamptz not null default now(),
  svix_id text unique
);

create index marketing_link_clicks_campaign_id_idx
  on public.marketing_link_clicks (campaign_id);
create index marketing_link_clicks_recipient_id_idx
  on public.marketing_link_clicks (recipient_id);

alter table public.marketing_link_clicks enable row level security;

create policy "marketing viewers can view link clicks"
  on public.marketing_link_clicks
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.tem_cargo_modulo('marketing'))
  );

-- Sem INSERT/UPDATE/DELETE p/ authenticated — só service-role (webhook).

-- supabase/migrations/0106_marketing_ab.sql
-- Teste A/B de assunto: a campanha guarda até 10 assuntos; a fase de
-- teste envia 100 e-mails por variante (A..J) e o webhook
-- (/api/marketing/webhook) registra aberturas por destinatário; a
-- vencedora é apurada por taxa de abertura e dispara o restante.
--
-- Escrita continua só service-role (actions + webhook); leitura
-- coordenador_geral OU tem_cargo_modulo('marketing') — herda as
-- policies de 0104 sem alteração.

alter table public.marketing_campaigns
  add column ab_test boolean not null default false,
  add column subjects jsonb not null default '[]',
  add column winner_subject text,
  add column test_sent_at timestamptz,
  add column test_per_variant integer not null default 100;

-- Novo status "testing" (fase de teste no ar, aguardando aberturas).
alter table public.marketing_campaigns
  drop constraint marketing_campaigns_status_check;

alter table public.marketing_campaigns
  add constraint marketing_campaigns_status_check check (
    status in ('draft', 'queued', 'testing', 'sending', 'sent', 'failed')
  );

alter table public.marketing_recipients
  add column variant text,
  add column opened_at timestamptz,
  add column open_count integer not null default 0;

create index marketing_recipients_variant_idx
  on public.marketing_recipients (campaign_id, variant);

-- Idempotência do webhook (delivery at-least-once do Resend): svix-id
-- já processado é ignorado. Sem policies — só service-role escreve/lê.
create table public.marketing_webhook_events (
  svix_id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

alter table public.marketing_webhook_events enable row level security;

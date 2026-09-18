-- supabase/migrations/0102_marketing.sql
-- Módulo de e-mail marketing (disparo via API transacional Resend):
-- marketing_leads (base de 15k com sanitização + opt-out LGPD),
-- marketing_campaigns (assunto + HTML colado) e
-- marketing_recipients (snapshot por campanha p/ rastrear envio).
--
-- Escrita SOMENTE via service-role (Server Actions com gate
-- coordenador_geral + rota pública de descadastro por token); leitura
-- via RLS só p/ coordenador_geral. Espelha o padrão de
-- 0005_reminder_logs.sql (sem write policy p/ authenticated).

-- ── Leads ──────────────────────────────────────────────────────────
create table public.marketing_leads (
  id bigint generated always as identity primary key,
  -- Sempre normalizado (lowercase + trim) na aplicação; a UNIQUE
  -- garante que o mesmo e-mail nunca entra 2x, mesmo reimportado.
  email text not null unique
    check (char_length(email) between 3 and 254),
  nome text,
  status text not null default 'active'
    check (status in ('active', 'unsubscribed', 'invalid')),
  -- Capacidade secreta p/ o link de descadastro (LGPD). Nunca exposto
  -- em listagem — só no rodapé do e-mail enviado ao próprio lead.
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  source text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create index marketing_leads_status_idx
  on public.marketing_leads (status);

-- ── Campanhas ──────────────────────────────────────────────────────
create table public.marketing_campaigns (
  id bigint generated always as identity primary key,
  titulo text not null check (char_length(titulo) between 1 and 200),
  assunto text not null check (char_length(assunto) between 1 and 200),
  html text not null check (char_length(html) between 1 and 500000),
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'sending', 'sent', 'failed')),
  total integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- ── Destinatários (snapshot da campanha) ───────────────────────────
-- Congela email+token no momento do enfileiramento: se o lead for
-- editado/removido depois, o disparo em andamento não muda de alvo.
create table public.marketing_recipients (
  id bigint generated always as identity primary key,
  campaign_id bigint not null
    references public.marketing_campaigns(id) on delete cascade,
  lead_id bigint references public.marketing_leads(id) on delete set null,
  email text not null,
  unsubscribe_token uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  resend_id text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (campaign_id, lead_id)
);

create index marketing_recipients_campaign_id_idx
  on public.marketing_recipients (campaign_id);
create index marketing_recipients_status_idx
  on public.marketing_recipients (campaign_id, status);

-- ── RLS: leitura só coordenador_geral, escrita só service-role ─────
alter table public.marketing_leads enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_recipients enable row level security;

create policy "coordenador can view marketing leads"
  on public.marketing_leads
  for select
  to authenticated
  using ((select public.has_role('coordenador_geral')));

create policy "coordenador can view marketing campaigns"
  on public.marketing_campaigns
  for select
  to authenticated
  using ((select public.has_role('coordenador_geral')));

create policy "coordenador can view marketing recipients"
  on public.marketing_recipients
  for select
  to authenticated
  using ((select public.has_role('coordenador_geral')));

-- Sem INSERT/UPDATE/DELETE p/ authenticated em nenhuma das três —
-- deliberado (mesmo padrão de 0005): só o service-role escreve.

-- ── Função pública de descadastro (SECURITY DEFINER) ───────────────
-- A página /descadastrar?token=... chama esta função com o cliente
-- comum (sem sessão): o token UUID é a capacidade — sem ele, nada é
-- alcançável. Marca o lead como unsubscribed (idempotente) para que
-- ele saia da base de disparos futuros automaticamente.
create or replace function public.marketing_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  select id into v_id
  from public.marketing_leads
  where unsubscribe_token = p_token;

  if v_id is null then
    return false;
  end if;

  update public.marketing_leads
  set status = 'unsubscribed',
      unsubscribed_at = coalesce(unsubscribed_at, now())
  where id = v_id;

  return true;
end;
$$;

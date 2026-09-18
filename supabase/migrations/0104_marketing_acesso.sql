-- supabase/migrations/0104_marketing_acesso.sql
-- Marketing passa a ser acessível ao coordenador_geral OU a quem tem
-- um cargo com o módulo "marketing" concedido (ex.: equipe de
-- comunicação) — mesmo padrão de acesso.ts/0043 para os demais módulos.
--
-- 1. Registra "marketing" nos CHECKs de módulos (mesmo gesto de 0051
--    para "contratos"): sem isso a tela /painel/acessos rejeita a
--    concessão.
-- 2. Reforça que contém PII (15k e-mails): RLS de leitura = geral OU
--    tem_cargo_modulo('marketing'); escrita continua só service-role.

alter table public.cargo_modulos
  drop constraint cargo_modulos_modulo_check;

alter table public.cargo_modulos
  add constraint cargo_modulos_modulo_check check (
    modulo in (
      'demandas', 'reunioes', 'dips', 'voluntarios', 'eventos',
      'projetos', 'pesquisas', 'proep', 'analise', 'analisar',
      'vendas', 'financeiro', 'utilidades', 'contratos', 'marketing'
    )
  );

alter table public.cargo_modelos
  drop constraint cargo_modelos_modulos_check;

alter table public.cargo_modelos
  add constraint cargo_modelos_modulos_check check (
    modulos <@ array[
      'demandas', 'reunioes', 'dips', 'voluntarios', 'eventos',
      'projetos', 'pesquisas', 'proep', 'analise', 'analisar',
      'vendas', 'financeiro', 'utilidades', 'marketing'
    ]
  );

-- Leitura: coordenador_geral OU cargo com módulo marketing.
drop policy "coordenador can view marketing leads"
  on public.marketing_leads;

create policy "marketing viewers can view marketing leads"
  on public.marketing_leads
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.tem_cargo_modulo('marketing'))
  );

drop policy "coordenador can view marketing campaigns"
  on public.marketing_campaigns;

create policy "marketing viewers can view marketing campaigns"
  on public.marketing_campaigns
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.tem_cargo_modulo('marketing'))
  );

drop policy "coordenador can view marketing recipients"
  on public.marketing_recipients;

create policy "marketing viewers can view marketing recipients"
  on public.marketing_recipients
  for select
  to authenticated
  using (
    (select public.has_role('coordenador_geral'))
    or (select public.tem_cargo_modulo('marketing'))
  );

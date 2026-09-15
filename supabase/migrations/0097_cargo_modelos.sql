-- supabase/migrations/0097_cargo_modelos.sql
-- Modelos de cargo reutilizáveis (presets) para a tela /painel/acessos:
--
--   1. `cargo_modelos`: preset = nome + nível + área opcional + módulos.
--      Aplicar um modelo a uma pessoa = criar um `cargo` (0043) com os
--      mesmos módulos — a RLS de cargos continua sendo o limite real.
--   2. RLS: leitura para qualquer autenticado (a tela de voluntários
--      precisa ler o preset para aplicar); escrita exclusiva do
--      coordenador_geral (a página /painel/acessos tem gate de UX igual).
--   3. Seeds dos presets institucionais (idempotentes por nome).
--
-- Módulos seguem o CHECK de cargo_modulos (0043) — painel/áreas/contratos
-- ficam de fora (exclusivos do coordenador_geral, como em acesso.ts).

create table public.cargo_modelos (
  id bigint generated always as identity primary key,
  nome text not null unique,
  descricao text not null default '',
  nivel public.nivel_acesso not null default 'coordenador_area',
  area_id bigint references public.areas_institucionais(id) on delete set null,
  modulos text[] not null default '{}'::text[],
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cargo_modelos_modulos_check check (
    modulos <@ array[
      'demandas', 'reunioes', 'dips', 'voluntarios', 'eventos',
      'projetos', 'pesquisas', 'proep', 'analise', 'analisar',
      'vendas', 'financeiro', 'utilidades'
    ]
  )
);

create index cargo_modelos_area_idx on public.cargo_modelos (area_id);

alter table public.cargo_modelos enable row level security;

create policy "authenticated can view cargo_modelos"
  on public.cargo_modelos
  for select
  to authenticated
  using (true);

create policy "coordenador_geral can insert cargo_modelos"
  on public.cargo_modelos
  for insert
  to authenticated
  with check ((select public.has_role('coordenador_geral')));

create policy "coordenador_geral can update cargo_modelos"
  on public.cargo_modelos
  for update
  to authenticated
  using ((select public.has_role('coordenador_geral')))
  with check ((select public.has_role('coordenador_geral')));

create policy "coordenador_geral can delete cargo_modelos"
  on public.cargo_modelos
  for delete
  to authenticated
  using ((select public.has_role('coordenador_geral')));

grant select on table public.cargo_modelos to authenticated;
grant insert, update, delete on table public.cargo_modelos to authenticated;

-- ---------------------------------------------------------------------------
-- Seeds: presets institucionais (nome = chave de idempotência)
-- ---------------------------------------------------------------------------

-- Todos os módulos concedíveis (administrador / coordenador geral)
-- Nota: contratos/painel/áreas são exclusivos do coordenador_geral por
-- papel (RLS + acesso.ts) e não entram em preset nenhum.

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Administrador de sistema',
  'Acesso total aos módulos — gestão da plataforma.',
  'coordenador_area', null,
  array['demandas','reunioes','dips','voluntarios','eventos','projetos','pesquisas','proep','analise','analisar','vendas','financeiro','utilidades']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Coordenador geral',
  'Visão e gestão plena de todos os módulos.',
  'coordenador_area', null,
  array['demandas','reunioes','dips','voluntarios','eventos','projetos','pesquisas','proep','analise','analisar','vendas','financeiro','utilidades']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Coordenador de área',
  'Base para coordenadores: demandas, reuniões, equipe e projetos da área.',
  'coordenador_area', null,
  array['demandas','reunioes','dips','voluntarios','eventos','projetos','pesquisas','utilidades','analise']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Financeiro',
  'Gestão financeira + acompanhamento de demandas e reuniões.',
  'coordenador_area',
  (select id from public.areas_institucionais where nome = 'Financeiro' limit 1),
  array['financeiro','demandas','reunioes']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Eventos',
  'Gestão de eventos + demandas, reuniões e equipe envolvida.',
  'coordenador_area', null,
  array['eventos','demandas','reunioes','voluntarios']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Comunicação',
  'Utilidades, eventos e análise + demandas e reuniões.',
  'coordenador_area', null,
  array['utilidades','eventos','demandas','reunioes','analise']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Bioenergologia',
  'Preset da sub-área Bioenergologia (Paratecnológico).',
  'coordenador_area',
  (select id from public.areas_institucionais where nome = 'Bioenergologia' limit 1),
  array['demandas','reunioes','voluntarios','projetos','pesquisas','utilidades']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Parapedagógico',
  'Preset da área Parapedagógico (inclui PROEP).',
  'coordenador_area',
  (select id from public.areas_institucionais where nome = 'Parapedagógico' limit 1),
  array['demandas','reunioes','voluntarios','projetos','proep','utilidades']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Paratecnológico',
  'Preset da área Paratecnológico (inclui DIPs e pesquisas).',
  'coordenador_area',
  (select id from public.areas_institucionais where nome = 'Paratecnológico' limit 1),
  array['demandas','reunioes','dips','voluntarios','projetos','pesquisas','utilidades']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Dinâmica DIP',
  'Preset operacional da Dinâmica DIP.',
  'coordenador_area',
  (select id from public.areas_institucionais where nome = 'DIP' limit 1),
  array['dips','demandas','reunioes','voluntarios']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Voluntariado',
  'Gestão da equipe de voluntários.',
  'coordenador_area',
  (select id from public.areas_institucionais where nome = 'Voluntariado' limit 1),
  array['voluntarios','demandas','reunioes','eventos']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Internacional',
  'Preset da área Internacional.',
  'coordenador_area',
  (select id from public.areas_institucionais where nome = 'Internacional' limit 1),
  array['demandas','reunioes','voluntarios','projetos','utilidades']
)
on conflict (nome) do nothing;

insert into public.cargo_modelos (nome, descricao, nivel, area_id, modulos)
values (
  'Loja Ectolab',
  'Gestão da loja (vendas) + demandas de apoio.',
  'coordenador_area', null,
  array['vendas','demandas','reunioes']
)
on conflict (nome) do nothing;

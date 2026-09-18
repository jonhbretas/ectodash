-- supabase/migrations/0105_system_module_flags.sql
-- Kill switch global de módulos (pedido do coordenador): permite
-- ativar/desativar cada módulo do sistema em /painel/acessos para
-- ocultar ou isolar um módulo com problema, sem deploy.
--
-- Semântica (src/lib/acesso.ts): módulo desativado some do menu e da
-- home para todos, EXCETO o coordenador_geral (que mantém acesso para
-- diagnosticar e reativar). O limite real continua sendo a RLS de cada
-- módulo; aqui é o interruptor de visibilidade global.
-- Linha ausente = módulo ativo (fail-open p/ módulos futuros).

create table public.system_module_flags (
  modulo text primary key,
  ativo boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.system_module_flags enable row level security;

-- Leitura p/ qualquer autenticado: o layout monta a sidebar a partir
-- daqui para todo usuário logado.
create policy "authenticated can view module flags"
  on public.system_module_flags
  for select
  to authenticated
  using (true);

-- Sem write policy p/ authenticated — só o service-role escreve, via
-- Server Action com gate coordenador_geral (mesmo padrão de 0005).

insert into public.system_module_flags (modulo, ativo) values
  ('demandas', true),
  ('reunioes', true),
  ('dips', true),
  ('voluntarios', true),
  ('eventos', true),
  ('projetos', true),
  ('pesquisas', true),
  ('proep', true),
  ('analise', true),
  ('analisar', true),
  ('vendas', true),
  ('financeiro', true),
  ('utilidades', true),
  ('contratos', true),
  ('marketing', true)
on conflict (modulo) do nothing;

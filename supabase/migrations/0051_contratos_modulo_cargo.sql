-- supabase/migrations/0048_contratos_modulo_cargo.sql
-- Registra o módulo "contratos" no CHECK de cargo_modulos (0043) para que
-- a gestão de cargos não rejeite o módulo. O acesso efetivo é exclusivo do
-- coordenador_geral (src/lib/acesso.ts + RLS 0042/0047) — conceder via cargo
-- simplesmente não libera nada, mas a UI de cargos pode listá-lo sem erro.

alter table public.cargo_modulos
  drop constraint cargo_modulos_modulo_check;

alter table public.cargo_modulos
  add constraint cargo_modulos_modulo_check check (
    modulo in (
      'demandas', 'reunioes', 'dips', 'voluntarios', 'eventos',
      'projetos', 'pesquisas', 'proep', 'analise', 'analisar',
      'vendas', 'financeiro', 'utilidades', 'contratos'
    )
  );

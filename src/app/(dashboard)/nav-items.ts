// src/app/(dashboard)/nav-items.ts
// The single source of truth for the sidebar menu — every screen listed
// here, with the module that gates its visibility (UX-only hiding; each
// destination keeps its own server-side gate + RLS). Shared by the
// sidebar and, where needed, page-level "voltar" links.
import {
  ClipboardList,
  NotebookPen,
  Users,
  FolderKanban,
  FlaskConical,
  CalendarDays,
  Wrench,
  Wallet,
  LayoutDashboard,
  BarChart3,
  UserRound,
  Sparkles,
  Globe2,
  GraduationCap,
  ShoppingCart,
  Package,
  Receipt,
  FileSignature,
  FileText,
  Map,
  MessageSquareWarning,
  BookOpen,
  CalendarCheck,
  HeartHandshake,
  ShieldCheck,
  House,
  Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModuloAcesso } from "@/lib/acesso";

// ── Type definitions ──────────────────────────────────────────────

export type NavItem = {
  type?: "item"; // default
  href: string;
  label: string;
  Icon: LucideIcon;
  // Módulo de acesso que governa a visibilidade deste item (acesso.ts).
  // Sem módulo = sempre visível (ex.: Meu perfil).
  modulo?: ModuloAcesso;
};

export type NavGroup = {
  type: "group";
  label: string;
  Icon: LucideIcon;
  href?: string; // parent link (e.g. /vendas); undefined = container-only
  children: NavItem[];
  modulo?: ModuloAcesso;
};

export type SidebarEntry = NavItem | NavGroup;

// ── Sidebar structure (grouped for clarity) ───────────────────────

export const navEntries: SidebarEntry[] = [
  // ─── Início (hub): sempre visível, resumo + cardzinhos ───
  { href: "/", label: "Início", Icon: House },

  // ─── Gestão Operacional ───
  {
    type: "group",
    label: "Gestão Operacional",
    Icon: ClipboardList,
    children: [
      { href: "/demandas", label: "Demandas", Icon: ClipboardList, modulo: "demandas" },
      { href: "/reunioes", label: "Reuniões", Icon: NotebookPen, modulo: "reunioes" },
      { href: "/projetos", label: "Projetos", Icon: FolderKanban, modulo: "projetos" },
    ],
  },

  // ─── Pessoas e Engajamento ───
  {
    type: "group",
    label: "Engajamento",
    Icon: Users,
    children: [
      { href: "/voluntarios", label: "Voluntários", Icon: Users, modulo: "voluntarios" },
      { href: "/trilha", label: "Trilha do Voluntário", Icon: Map, modulo: "voluntarios" },
    ],
  },

  // ─── DIP (item exclusivo; a escala da DIP vive aqui) ───
  {
    type: "group",
    label: "DIP",
    Icon: Globe2,
    href: "/dips",
    modulo: "dips",
    children: [
      { href: "/dips", label: "Dinâmica DIP", Icon: Globe2, modulo: "dips" },
      { href: "/voluntarios/escala", label: "Escala da DIP", Icon: CalendarCheck, modulo: "dips" },
    ],
  },

  // ─── Eventos (item exclusivo) ───
  { href: "/eventos", label: "Eventos", Icon: CalendarDays, modulo: "eventos" },

  // ─── Pedagógico ───
  {
    type: "group",
    label: "Pedagógico",
    Icon: FolderKanban,
    children: [
      { href: "/pesquisas", label: "Pesquisas", Icon: FlaskConical, modulo: "pesquisas" },
      { href: "/proep", label: "PROEP", Icon: GraduationCap, modulo: "proep" },
    ],
  },

  // ─── Financeiro (role financeiro ou cargo com o módulo) ───
  {
    type: "group",
    label: "Financeiro",
    Icon: Wallet,
    href: "/financeiro",
    modulo: "financeiro",
    children: [
      { href: "/financeiro", label: "Visão geral", Icon: Wallet, modulo: "financeiro" },
      { href: "/financeiro/lancamentos", label: "Lançamentos", Icon: Receipt, modulo: "financeiro" },
    ],
  },

  // ─── Utilidades (ferramentas: acervo e dicionário) ───
  {
    type: "group",
    label: "Utilidades",
    Icon: Wrench,
    href: "/utilidades",
    modulo: "utilidades",
    children: [
      { href: "/utilidades", label: "Utilidades", Icon: Wrench, modulo: "utilidades" },
      { href: "/utilidades/dicionario", label: "Dicionário", Icon: BookOpen, modulo: "utilidades" },
    ],
  },

  // ─── Contratos (item exclusivo; modelos vivem dentro) ───
  // Módulo exclusivo do coordenador geral (acesso.ts).
  {
    type: "group",
    label: "Contratos",
    Icon: FileSignature,
    href: "/utilidades/contratos",
    modulo: "contratos",
    children: [
      { href: "/utilidades/contratos", label: "Contratos", Icon: FileSignature, modulo: "contratos" },
      { href: "/utilidades/contratos/modelos", label: "Modelos", Icon: FileText, modulo: "contratos" },
    ],
  },

  // ─── Marketing (coordenador geral ou cargo com o módulo — comunicação) ───
  {
    type: "group",
    label: "Marketing",
    Icon: Mail,
    href: "/marketing",
    modulo: "marketing",
    children: [
      { href: "/marketing", label: "Visão geral", Icon: Mail, modulo: "marketing" },
      { href: "/marketing/historico", label: "Histórico", Icon: ClipboardList, modulo: "marketing" },
    ],
  },

  // ─── Ajuda (todos veem os próprios; coordenador geral gerencia tudo) ───
  { href: "/feedback", label: "Ajuda e melhorias", Icon: MessageSquareWarning },

  // ─── Ouvidoria (escuta anônima; leitura só do colegiado gestor) ───
  { href: "/ouvidoria", label: "Ouvidoria", Icon: HeartHandshake },

  // ─── Perfil ───
  { href: "/perfil", label: "Meu perfil", Icon: UserRound },
];

// Coordenador-only entry points live in their own section at the bottom of
// the sidebar, visually separated from the main menu.
export const coordinatorEntries: SidebarEntry[] = [
  { href: "/painel", label: "Painel do coordenador", Icon: LayoutDashboard },
  { href: "/painel/acessos", label: "Acessos e cargos", Icon: ShieldCheck },
  // ─── Inteligência (exclusiva do coordenador geral) ───
  {
    type: "group",
    label: "Inteligência",
    Icon: BarChart3,
    children: [
      { href: "/analise", label: "Análise", Icon: BarChart3, modulo: "analise" },
      { href: "/analisar", label: "Analisar com IA", Icon: Sparkles, modulo: "analisar" },
    ],
  },
  // ─── Loja Ectolab (oculta; só o coordenador geral vê — fora de operação) ───
  {
    type: "group",
    label: "Loja Ectolab",
    Icon: ShoppingCart,
    href: "/vendas",
    modulo: "vendas",
    children: [
      { href: "/vendas", label: "Visão geral", Icon: ShoppingCart, modulo: "vendas" },
      { href: "/vendas/produtos", label: "Produtos", Icon: Package, modulo: "vendas" },
      { href: "/vendas/pedidos", label: "Pedidos", Icon: Receipt, modulo: "vendas" },
      { href: "/vendas/alunos", label: "Alunos", Icon: Users, modulo: "vendas" },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────

export type Visibilidade = "gerenciar" | "ler" | false;

export function filterEntries(
  entries: SidebarEntry[],
  visibilidade: (modulo: ModuloAcesso) => Visibilidade
): SidebarEntry[] {
  const isVisible = (item: NavItem | NavGroup): boolean => {
    if (!item.modulo) return true; // itens sem módulo são sempre visíveis
    const nivel = visibilidade(item.modulo);
    return nivel !== false;
  };

  return entries
    .filter(isVisible)
    .map((e) => {
      if (e.type === "group") {
        const children = e.children.filter(isVisible);
        return { ...e, children };
      }
      return e;
    })
    // Remove groups that ended up with no visible children
    .filter((e) => e.type !== "group" || e.children.length > 0);
}

/** Check if any child in the group is currently active */
export function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (group.href) {
    const active =
      group.href === "/" ? pathname === "/" : pathname.startsWith(group.href);
    if (active) return true;
  }
  return group.children.some((child) => {
    const active =
      child.href === "/" ? pathname === "/" : pathname.startsWith(child.href);
    return active;
  });
}

/** Seção exclusiva do coordenador_geral (painel) — o resto da sidebar usa
 * a visibilidade por módulo. */
export function filterCoordinatorEntries(
  entries: SidebarEntry[],
  isCoordenadorGeral: boolean
): SidebarEntry[] {
  return isCoordenadorGeral ? entries : [];
}

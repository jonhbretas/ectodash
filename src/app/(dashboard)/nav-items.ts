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
  // ─── Gestão Operacional ───
  {
    type: "group",
    label: "Gestão Operacional",
    Icon: ClipboardList,
    children: [
      { href: "/", label: "Demandas", Icon: ClipboardList, modulo: "demandas" },
      { href: "/reunioes", label: "Atas de Reuniões", Icon: NotebookPen, modulo: "reunioes" },
    ],
  },

  // ─── Pessoas e Engajamento ───
  {
    type: "group",
    label: "Engajamento",
    Icon: Users,
    children: [
      { href: "/voluntarios", label: "Voluntários", Icon: Users, modulo: "voluntarios" },
      { href: "/eventos", label: "Eventos", Icon: CalendarDays, modulo: "eventos" },
      { href: "/dips", label: "Dinâmica DIP", Icon: Globe2, modulo: "dips" },
      { href: "/trilha", label: "Trilha do Voluntário", Icon: Map, modulo: "voluntarios" },
    ],
  },

  // ─── Projetos e Conhecimento ───
  {
    type: "group",
    label: "Conhecimento",
    Icon: FolderKanban,
    children: [
      { href: "/projetos", label: "Projetos", Icon: FolderKanban, modulo: "projetos" },
      { href: "/pesquisas", label: "Pesquisas", Icon: FlaskConical, modulo: "pesquisas" },
      { href: "/proep", label: "PROEP", Icon: GraduationCap, modulo: "proep" },
    ],
  },

  // ─── Inteligência ───
  {
    type: "group",
    label: "Inteligência",
    Icon: BarChart3,
    children: [
      { href: "/analise", label: "Análise", Icon: BarChart3, modulo: "analise" },
      { href: "/analisar", label: "Analisar com IA", Icon: Sparkles, modulo: "analisar" },
    ],
  },

  // ─── Loja Ectolab (módulo vendas: role ou cargo) ───
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

  // ─── Financeiro (role financeiro ou cargo com o módulo) ───
  { href: "/financeiro", label: "Financeiro", Icon: Wallet, modulo: "financeiro" },

  // ─── Contratos (módulo exclusivo do coordenador geral — acesso.ts) ───
  {
    type: "group",
    label: "Contratos",
    Icon: FileSignature,
    href: "/contratos",
    modulo: "contratos",
    children: [
      { href: "/contratos", label: "Contratos", Icon: FileSignature, modulo: "contratos" },
      { href: "/contratos/modelos", label: "Modelos", Icon: FileText, modulo: "contratos" },
    ],
  },

  // ─── Ferramentas ───
  { href: "/utilidades", label: "Utilidades", Icon: Wrench, modulo: "utilidades" },

  // ─── Perfil ───
  { href: "/perfil", label: "Meu perfil", Icon: UserRound },
];

// Coordenador-only entry points live in their own section at the bottom of
// the sidebar, visually separated from the main menu.
export const coordinatorEntries: SidebarEntry[] = [
  { href: "/painel", label: "Painel do coordenador", Icon: LayoutDashboard },
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

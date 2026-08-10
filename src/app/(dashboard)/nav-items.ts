// src/app/(dashboard)/nav-items.ts
// The single source of truth for the sidebar menu — every screen listed
// here, with the role flags that hide role-scoped items (UX-only hiding;
// each destination keeps its own server-side gate + RLS). Shared by the
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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Type definitions ──────────────────────────────────────────────

export type NavItem = {
  type?: "item"; // default
  href: string;
  label: string;
  Icon: LucideIcon;
  visibleTo?: "coordenador" | "financeiro";
};

export type NavGroup = {
  type: "group";
  label: string;
  Icon: LucideIcon;
  href?: string; // parent link (e.g. /vendas); undefined = container-only
  children: NavItem[];
  visibleTo?: "coordenador" | "financeiro";
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
      { href: "/", label: "Demandas", Icon: ClipboardList },
      { href: "/reunioes", label: "Atas de Reuniões", Icon: NotebookPen },
      { href: "/dips", label: "Dinâmica DIP", Icon: Globe2 },
    ],
  },

  // ─── Pessoas e Engajamento ───
  {
    type: "group",
    label: "Engajamento",
    Icon: Users,
    children: [
      { href: "/voluntarios", label: "Voluntários", Icon: Users },
      { href: "/eventos", label: "Eventos", Icon: CalendarDays },
    ],
  },

  // ─── Projetos e Conhecimento ───
  {
    type: "group",
    label: "Conhecimento",
    Icon: FolderKanban,
    children: [
      { href: "/projetos", label: "Projetos", Icon: FolderKanban },
      { href: "/pesquisas", label: "Pesquisas", Icon: FlaskConical },
      { href: "/proep", label: "PROEP", Icon: GraduationCap },
    ],
  },

  // ─── Inteligência ───
  {
    type: "group",
    label: "Inteligência",
    Icon: BarChart3,
    children: [
      { href: "/analise", label: "Análise", Icon: BarChart3 },
      { href: "/analisar", label: "Analisar com IA", Icon: Sparkles },
    ],
  },

  // ─── Loja Ectolab (coordenador) ───
  {
    type: "group",
    label: "Loja Ectolab",
    Icon: ShoppingCart,
    href: "/vendas",
    visibleTo: "coordenador",
    children: [
      { href: "/vendas", label: "Visão geral", Icon: ShoppingCart, visibleTo: "coordenador" },
      { href: "/vendas/produtos", label: "Produtos", Icon: Package, visibleTo: "coordenador" },
      { href: "/vendas/pedidos", label: "Pedidos", Icon: Receipt, visibleTo: "coordenador" },
      { href: "/vendas/alunos", label: "Alunos", Icon: Users, visibleTo: "coordenador" },
    ],
  },

  // ─── Contratos (coordenador) ───
  {
    type: "group",
    label: "Contratos",
    Icon: FileSignature,
    href: "/contratos",
    visibleTo: "coordenador",
    children: [
      { href: "/contratos", label: "Contratos", Icon: FileSignature, visibleTo: "coordenador" },
      { href: "/contratos/modelos", label: "Modelos", Icon: FileText, visibleTo: "coordenador" },
    ],
  },

  // ─── Financeiro ───
  { href: "/financeiro", label: "Financeiro", Icon: Wallet, visibleTo: "financeiro" },

  // ─── Ferramentas ───
  { href: "/utilidades", label: "Utilidades", Icon: Wrench },

  // ─── Perfil ───
  { href: "/perfil", label: "Meu perfil", Icon: UserRound },
];

// Coordenador-only entry points live in their own section at the bottom of
// the sidebar, visually separated from the main menu.
export const coordinatorEntries: SidebarEntry[] = [
  { href: "/painel", label: "Painel do coordenador", Icon: LayoutDashboard, visibleTo: "coordenador" },
];

// ── Helpers ───────────────────────────────────────────────────────

function isVisible(
  item: SidebarEntry,
  isCoordenador: boolean,
  isFinanceiro: boolean
): boolean {
  if (item.visibleTo === "coordenador") return isCoordenador;
  if (item.visibleTo === "financeiro") return isCoordenador || isFinanceiro;
  return true;
}

export function filterEntries(
  entries: SidebarEntry[],
  isCoordenador: boolean,
  isFinanceiro: boolean
): SidebarEntry[] {
  return entries
    .filter((e) => isVisible(e, isCoordenador, isFinanceiro))
    .map((e) => {
      if (e.type === "group") {
        const children = e.children.filter((c) =>
          isVisible(c, isCoordenador, isFinanceiro)
        );
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

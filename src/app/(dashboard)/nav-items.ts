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
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  // undefined = visible to every authenticated role
  visibleTo?: "coordenador" | "financeiro";
};

export const navItems: NavItem[] = [
  { href: "/", label: "Demandas", Icon: ClipboardList },
  { href: "/reunioes", label: "Atas de Reuniões", Icon: NotebookPen },
  { href: "/voluntarios", label: "Voluntários", Icon: Users },
  { href: "/projetos", label: "Projetos", Icon: FolderKanban },
  { href: "/pesquisas", label: "Pesquisas", Icon: FlaskConical },
  { href: "/eventos", label: "Eventos", Icon: CalendarDays },
  { href: "/analise", label: "Análise", Icon: BarChart3 },
  { href: "/utilidades", label: "Utilidades", Icon: Wrench },
  { href: "/financeiro", label: "Financeiro", Icon: Wallet, visibleTo: "financeiro" },
];

// Coordenador-only entry points live in their own section at the bottom of
// the sidebar, visually separated from the main menu.
export const coordinatorItems: NavItem[] = [
  { href: "/painel", label: "Painel do coordenador", Icon: LayoutDashboard, visibleTo: "coordenador" },
];

export function filterNavItems(
  items: NavItem[],
  isCoordenador: boolean,
  isFinanceiro: boolean
): NavItem[] {
  return items.filter((item) => {
    if (item.visibleTo === "coordenador") return isCoordenador;
    if (item.visibleTo === "financeiro") return isCoordenador || isFinanceiro;
    return true;
  });
}

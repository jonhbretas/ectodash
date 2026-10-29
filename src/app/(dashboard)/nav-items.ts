// src/app/(dashboard)/nav-items.ts
// The single source of truth for the sidebar menu — every screen listed
// here, with the module that gates its visibility (UX-only hiding; each
// destination keeps its own server-side gate + RLS). Shared by the
// sidebar and, where needed, page-level "voltar" links.
import {
  ClipboardList,
  NotebookPen,
  Users,
  UserX,
  FolderKanban,
  FlaskConical,
  CalendarDays,
  Wrench,
  Wallet,
  DollarSign,
  LayoutDashboard,
  UserRound,
  Globe2,
  GraduationCap,
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
  ListTodo,
  ChartNoAxesColumn,
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
      { href: "/reunioes?tab=pautas", label: "Pedidos de pauta", Icon: ListTodo, modulo: "reunioes" },
      { href: "/projetos", label: "Projetos", Icon: FolderKanban, modulo: "projetos" },
    ],
  },

  // ─── Pessoas e Voluntariado ───
  {
    type: "group",
    label: "Voluntariado",
    Icon: Users,
    children: [
      { href: "/voluntarios", label: "Voluntários", Icon: Users, modulo: "voluntarios" },
      { href: "/voluntarios/cuidar", label: "Cuidar das pessoas", Icon: HeartHandshake, modulo: "voluntarios" },
      { href: "/voluntarios/limpeza", label: "Limpeza", Icon: UserX, modulo: "voluntarios" },
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
      { href: "/voluntarios/escala/analise", label: "Análise da DIP", Icon: ChartNoAxesColumn, modulo: "dips" },
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
      { href: "/trilha", label: "Trilha do Voluntário", Icon: Map, modulo: "voluntarios" },
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
      { href: "/financeiro", label: "Início", Icon: Wallet, modulo: "financeiro" },
      { href: "/financeiro/importar", label: "Subir arquivos", Icon: Receipt, modulo: "financeiro" },
      { href: "/financeiro/analise", label: "Análise", Icon: ChartNoAxesColumn, modulo: "financeiro" },
      { href: "/financeiro/conferencia", label: "Conferência", Icon: ClipboardList, modulo: "financeiro" },
      { href: "/financeiro/lancamentos", label: "Lançamentos", Icon: Receipt, modulo: "financeiro" },
      { href: "/financeiro/propostas", label: "Propostas", Icon: FileText, modulo: "financeiro" },
      { href: "/financeiro/pagar", label: "A pagar", Icon: DollarSign, modulo: "financeiro" },
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

  // ─── Ajuda (todos veem os próprios; coordenador geral gerencia tudo) ───
  { href: "/feedback", label: "Ajuda e melhorias", Icon: MessageSquareWarning },

  // ─── Ouvidoria (escuta identificada; leitura só do colegiado gestor) ───
  { href: "/ouvidoria", label: "Ouvidoria", Icon: HeartHandshake },

  // ─── Perfil ───
  { href: "/perfil", label: "Meu perfil", Icon: UserRound },
];

// Coordenador-only entry points live in their own section at the bottom of
// the sidebar, visually separated from the main menu.
export const coordinatorEntries: SidebarEntry[] = [
  {
    type: "group",
    label: "Administrativo",
    Icon: LayoutDashboard,
    href: "/administrativo",
    children: [
      { href: "/administrativo", label: "Visão geral", Icon: LayoutDashboard },
      { href: "/painel/acessos", label: "Acessos e cargos", Icon: ShieldCheck },
    ],
  },
  { href: "/demandas?coordenacao=1", label: "Demandas da Coordenação", Icon: ClipboardList },
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

export function isNavItemActive(
  href: string,
  pathname: string,
  searchParams: Pick<URLSearchParams, "get"> = new URLSearchParams()
): boolean {
  const [targetPath, targetQuery] = href.split("?");
  const matchesPath = targetPath === "/"
    ? pathname === "/"
    : pathname === targetPath || pathname.startsWith(`${targetPath}/`);

  if (!matchesPath) return false;

  if (targetPath === "/demandas") {
    const coordenacao = searchParams.get("coordenacao") === "1";
    return coordenacao === (new URLSearchParams(targetQuery).get("coordenacao") === "1");
  }

  if (targetQuery) {
    return pathname === targetPath && Array.from(new URLSearchParams(targetQuery))
      .every(([key, value]) => searchParams.get(key) === value);
  }

  if (targetPath === "/reunioes") {
    return pathname === targetPath && !searchParams.get("tab");
  }

  return true;
}

/** Check if any child in the group is currently active. */
export function isGroupActive(
  group: NavGroup,
  pathname: string,
  searchParams: Pick<URLSearchParams, "get"> = new URLSearchParams()
): boolean {
  return Boolean(group.href && isNavItemActive(group.href, pathname, searchParams)) ||
    group.children.some((child) => isNavItemActive(child.href, pathname, searchParams));
}

/** Seção exclusiva do coordenador_geral (painel) — o resto da sidebar usa
 * a visibilidade por módulo. */
export function filterCoordinatorEntries(
  entries: SidebarEntry[],
  isCoordenadorGeral: boolean
): SidebarEntry[] {
  return isCoordenadorGeral ? entries : [];
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, X, ChevronDown } from "lucide-react";
import {
  filterEntries,
  filterCoordinatorEntries,
  isGroupActive,
  navEntries,
  coordinatorEntries,
  type NavGroup,
  type NavItem,
  type SidebarEntry,
} from "./nav-items";
import { useStoredPreference } from "@/lib/use-stored-preference";
import { podeAcessar, type Acesso, type ModuloAcesso } from "@/lib/acesso";
import SignOutButton from "./sign-out-button";
import QuickSearch from "./quick-search";

export type SidebarProps = {
  acesso?: Acesso | null;
  feedbackNovos?: number;
};

const COLLAPSED_KEY = "ectodash:sidebar-colapsada";

function SidebarLinks({
  acesso,
  pathname,
  collapsed,
  onNavigate,
  feedbackNovos,
  isCoordenador,
}: {
  acesso: Acesso | null;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  feedbackNovos?: number;
  isCoordenador?: boolean;
}) {
  const visibilidade = (modulo: ModuloAcesso) =>
    acesso ? podeAcessar(acesso, modulo) : false;

  const main = useMemo(
    () => filterEntries(navEntries, visibilidade),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [acesso]
  );
  const coord = useMemo(
    () =>
      filterCoordinatorEntries(
        coordinatorEntries,
        acesso?.role === "coordenador_geral"
      ),
    [acesso]
  );

  // Auto-expand groups whose children include the current route
  const defaultExpanded = useMemo(() => {
    const set = new Set<string>();
    for (const entry of main) {
      if (entry.type === "group" && isGroupActive(entry, pathname)) {
        set.add(entry.label);
      }
    }
    return set;
  }, [main, pathname]);

  const [expanded, setExpanded] = useState<Set<string>>(defaultExpanded);

  // Keep auto-expansion in sync when pathname changes (e.g. navigating
  // between children). Adjusting state during render (not in an effect)
  // is the React-sanctioned pattern — no extra commit, no render loop.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const entry of main) {
        if (entry.type === "group" && isGroupActive(entry, pathname) && !next.has(entry.label)) {
          next.add(entry.label);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }

  function toggleGroup(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  const linkClassName = (href: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `flex min-h-11 w-full items-center rounded-xl font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] ${
      collapsed
        ? "flex-col justify-center gap-0.5 px-0 text-center"
        : `gap-3 text-sm px-3`
    } ${
      active
        ? "bg-[#2195B9] text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)]"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;
  };

  // Group headers never get the active background — only text weight changes
  const groupHeaderClassName = (active: boolean) => {
    return `flex min-h-11 w-full items-center rounded-xl font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] ${
      collapsed
        ? "flex-col justify-center gap-0.5 px-0 text-center"
        : "gap-3 px-3 text-sm"
    } ${
      active
        ? "text-slate-900 font-semibold"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;
  };

  function handleNavClick(e: React.MouseEvent, href: string) {
    // Native <a> navigation (same mechanism as right-click → open in new
    // tab): NO preventDefault and NO client-side router — the browser
    // performs a full navigation, which cannot be silently swallowed by
    // router errors. onNavigate only closes the mobile drawer.
    onNavigate?.();
  }

  const renderLink = (item: NavItem) => {
    const isFeedback = item.href === "/feedback";
    const showBadge = isFeedback && isCoordenador && (feedbackNovos ?? 0) > 0;
    const badgeCount = feedbackNovos ?? 0;
    return (
      <a
        key={item.href}
        href={item.href}
        onClick={(e) => handleNavClick(e, item.href)}
        className={linkClassName(item.href)}
        title={collapsed ? item.label : undefined}
      >
        <span className="relative flex items-center">
          <item.Icon size={20} aria-hidden="true" strokeWidth={1.75} />
          {collapsed && showBadge && (
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white"
            />
          )}
        </span>
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && showBadge && (
          <span
            aria-label={`${badgeCount} novos relatos`}
            className="ml-auto flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold leading-none text-white"
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </a>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const open = expanded.has(group.label);
    const active = isGroupActive(group, pathname);

    if (collapsed) {
      return (
        <div key={group.label}>
          <button
            type="button"
            onClick={() => toggleGroup(group.label)}
            className={groupHeaderClassName(active)}
            title={group.label}
            aria-label={group.label}
          >
            <group.Icon size={20} aria-hidden="true" strokeWidth={1.75} />
          </button>
        </div>
      );
    }

    return (
      <div key={group.label}>
        {/* Group header — label acts as the parent link (when the group has
            one); the chevron button only toggles collapse. */}
        <div className={groupHeaderClassName(active)}>
          {group.href ? (
            <a
              href={group.href}
              onClick={() => onNavigate?.()}
              title={`Ir para ${group.label}`}
              className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left"
            >
              <group.Icon size={20} aria-hidden="true" strokeWidth={1.75} />
              <span className="flex-1 truncate text-left">{group.label}</span>
            </a>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-3 self-stretch text-left">
              <group.Icon size={20} aria-hidden="true" strokeWidth={1.75} />
              <span className="flex-1 truncate text-left">{group.label}</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => toggleGroup(group.label)}
            aria-expanded={open}
            aria-label={open ? `Recolher ${group.label}` : `Expandir ${group.label}`}
            className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={`shrink-0 transition-transform duration-200 ${
                open ? "" : "-rotate-90"
              }`}
            />
          </button>
        </div>

        {/* Children */}
        {open && (
          <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l-2 border-slate-200 pl-1">
            {group.children.map((child) => renderLink(child))}
          </div>
        )}
      </div>
    );
  };

  const renderEntry = (entry: SidebarEntry) => {
    if (entry.type === "group") return renderGroup(entry);
    return renderLink(entry);
  };

  return (
    <nav aria-label="Menu principal" className="flex w-full flex-col gap-0.5">
      {main.map(renderEntry)}

      {coord.length > 0 && (
        <>
          <div role="separator" className="my-2 h-px w-full bg-slate-200" />
          {coord.map(renderEntry)}
        </>
      )}
    </nav>
  );
}

function SidebarBrand({
  collapsed,
  size = "md",
}: {
  collapsed: boolean;
  size?: "md" | "lg";
}) {
  return (
    <a
      href="/"
      title={collapsed ? "EctoLab — página inicial" : undefined}
      aria-label="EctoLab — página inicial"
      className={`flex min-h-12 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        collapsed ? "justify-start gap-0" : "w-full"
      }`}
    >
      <img
        src={collapsed ? "/favicon.png" : "/logo-ectolab.png"}
        alt="EctoLab"
        className={`shrink-0 ${collapsed ? "h-9 w-9" : "w-full"}`}
      />
    </a>
  );
}

export default function Sidebar({ acesso = null, feedbackNovos = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [collapsedRaw, setCollapsedRaw] = useStoredPreference(COLLAPSED_KEY, "1");
  const collapsed = collapsedRaw === "1";

  const visuallyCollapsed = collapsed && !hovered;
  const isCoordenador = acesso?.role === "coordenador_geral";

  // Polling simples para badge da sidebar (coordenador_geral apenas).
  // Atualiza o contador de "novos" a cada 60s sem realtime.
  const [feedbackCount, setFeedbackCount] = useState(feedbackNovos);
  useEffect(() => {
    setFeedbackCount(feedbackNovos);
  }, [feedbackNovos]);
  useEffect(() => {
    if (!isCoordenador) return;
    let cancelled = false;
    async function poll() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { count } = await supabase
          .from("feedback")
          .select("id", { count: "exact", head: true })
          .eq("status", "novo");
        if (!cancelled) setFeedbackCount(count ?? 0);
      } catch {}
    }
    const id = window.setInterval(poll, 60_000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [isCoordenador]);

  function toggleCollapsed() {
    setCollapsedRaw(collapsed ? "0" : "1");
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const drawer = open ? (
    <div className="fixed inset-0 z-50 lg:hidden animate-fade-in">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-slate-200 glass-strong px-5 py-6 animate-slide-in-right">
        <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <SidebarBrand collapsed={false} size="lg" />
        </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        <QuickSearch onNavigate={() => setOpen(false)} />
        <SidebarLinks
          acesso={acesso}
          pathname={pathname}
          collapsed={false}
          onNavigate={() => setOpen(false)}
          feedbackNovos={feedbackCount}
          isCoordenador={isCoordenador}
        />
        <div className="mt-auto space-y-2">
          <SignOutButton />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <aside
        ref={sidebarRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`sticky top-0 z-30 hidden h-dvh shrink-0 flex-col gap-5 border-r border-slate-200/60 bg-white/95 backdrop-blur-xl py-5 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex ${
          visuallyCollapsed ? "w-18 px-2" : "w-64 shadow-[4px_0_24px_rgba(0,0,0,0.04)]"
        }`}
      >
        <SidebarBrand collapsed={visuallyCollapsed} size="lg" />

        {!visuallyCollapsed && <div className="px-4"><QuickSearch /></div>}

        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none px-4">
          <SidebarLinks
            acesso={acesso}
            pathname={pathname}
            collapsed={visuallyCollapsed}
            feedbackNovos={feedbackCount}
            isCoordenador={isCoordenador}
          />
        </div>

        <div className="mt-auto flex flex-col items-center gap-2 px-4">
          {!visuallyCollapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Recolher menu lateral"
              title="Recolher menu"
              className="flex h-9 w-full items-center justify-center gap-2 rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <PanelLeftClose size={18} aria-hidden="true" strokeWidth={1.5} />
              <span className="text-xs font-medium">Recolher</span>
            </button>
          )}
          {visuallyCollapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Expandir menu lateral"
              title="Fixar menu"
              className="flex h-9 w-full items-center justify-center rounded-xl text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <PanelLeftOpen size={18} aria-hidden="true" strokeWidth={1.5} />
            </button>
          )}
          <SignOutButton iconOnly={visuallyCollapsed} />
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-14 w-full items-center border-b border-[#e8ddd4]/60 glass px-4 lg:hidden">
        <div className="min-w-0 shrink-0">
          <a
            href="/"
            aria-label="EctoLab — página inicial"
            className="flex min-h-12 items-center gap-2"
          >
            <img src="/favicon.png" alt="" className="h-9 w-9 shrink-0" />
            <span className="font-[family-name:var(--font-poppins)] text-lg font-semibold tracking-wide text-slate-800">
              EctoLab
            </span>
          </a>
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-label="Abrir menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </header>

      {drawer}
    </>
  );
}

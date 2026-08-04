"use client";

// Sidebar navigation — fixed column on lg+ screens; slide-over drawer on
// smaller screens, opened by the hamburger in the mobile top bar and
// closed on link click, Escape, or backdrop click. All links keep the
// project's ≥44px touch-target floor. `usePathname` drives the active
// state; the items themselves come from nav-items.ts (single source).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { filterNavItems, navItems, coordinatorItems } from "./nav-items";
import { useStoredPreference } from "@/lib/use-stored-preference";
import SignOutButton from "./sign-out-button";

export type SidebarProps = {
  isCoordenador?: boolean;
  isFinanceiro?: boolean;
};

// localStorage key — desktop collapse preference, survives reloads.
const COLLAPSED_KEY = "ectodash:sidebar-colapsada";

function SidebarLinks({
  isCoordenador,
  isFinanceiro,
  pathname,
  collapsed,
  onNavigate,
}: {
  isCoordenador: boolean;
  isFinanceiro: boolean;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const main = filterNavItems(navItems, isCoordenador, isFinanceiro);
  const coord = filterNavItems(coordinatorItems, isCoordenador, isFinanceiro);

  const linkClassName = (href: string) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return `flex min-h-12 w-full items-center rounded-xl font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
      collapsed
        ? "flex-col justify-center gap-0.5 px-1 text-center"
        : "gap-3 px-4 text-lg"
    } ${
      active
        ? "bg-blue-700 text-white"
        : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
    }`;
  };

  const renderLink = (item: (typeof navItems)[number]) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={onNavigate}
      className={linkClassName(item.href)}
      title={collapsed ? item.label : undefined}
    >
      <item.Icon size={22} aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </Link>
  );

  return (
    <nav aria-label="Menu principal" className="flex w-full flex-col gap-1">
      {main.map(renderLink)}

      {coord.length > 0 && (
        <>
          <div role="separator" className="my-2 h-px w-full bg-zinc-200" />
          {coord.map(renderLink)}
        </>
      )}
    </nav>
  );
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/"
      title={collapsed ? "EctoDash" : undefined}
      aria-label="EctoDash — página inicial"
      className={`flex min-h-12 items-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
        collapsed ? "justify-center gap-0" : "gap-3"
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-xl font-bold text-white"
      >
        E
      </span>
      {!collapsed && (
        <span className="truncate text-2xl font-semibold text-zinc-900">
          EctoDash
        </span>
      )}
    </Link>
  );
}

export default function Sidebar({ isCoordenador = false, isFinanceiro = false }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsedRaw, setCollapsedRaw] = useStoredPreference(COLLAPSED_KEY, "0");
  const collapsed = collapsedRaw === "1";

  function toggleCollapsed() {
    setCollapsedRaw(collapsed ? "0" : "1");
  }

  // Close on Escape while the drawer is open. (Route-change closing needs
  // no effect — every drawer link already closes via its own onClick.)
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const drawer = open ? (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-zinc-900/50"
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />
      <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-zinc-200 bg-white px-4 py-6">
        <div className="flex items-center justify-between">
          <SidebarBrand collapsed={false} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="flex h-12 w-12 items-center justify-center rounded-xl text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <SidebarLinks
          isCoordenador={isCoordenador}
          isFinanceiro={isFinanceiro}
          pathname={pathname}
          collapsed={false}
          onNavigate={() => setOpen(false)}
        />
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Desktop sidebar — always visible on lg+. `collapsed` shrinks it to
          an icon rail (w-20) to maximize the work area; the preference is
          persisted in localStorage. */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col gap-6 overflow-y-auto border-r border-zinc-200 bg-white py-6 transition-[width] duration-200 ease-in-out lg:flex ${
          collapsed ? "w-20 px-2" : "w-72 px-4"
        }`}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarLinks
          isCoordenador={isCoordenador}
          isFinanceiro={isFinanceiro}
          pathname={pathname}
          collapsed={collapsed}
        />
        <div className="mt-auto flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            {collapsed ? (
              <PanelLeftOpen size={24} aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose size={24} aria-hidden="true" />
                <span className="text-lg font-medium">Recolher menu</span>
              </>
            )}
          </button>
          <SignOutButton iconOnly={collapsed} />
        </div>
      </aside>

      {/* Mobile top bar — brand + hamburger. The drawer itself is above. */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <SidebarBrand collapsed={false} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Abrir menu"
          className="flex h-12 w-12 items-center justify-center rounded-xl text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </header>

      {drawer}
    </>
  );
}

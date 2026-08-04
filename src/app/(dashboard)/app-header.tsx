// Shared dashboard header — the single navigation surface for every
// (dashboard) page. Role-aware links are passed as props from each page's
// existing profiles.role read (no new queries, UX-hiding only — every
// destination keeps its own server-side role gate + RLS as the real
// boundary). Sticky, high-contrast, with ≥44px touch targets throughout.
import Link from "next/link";
import { LayoutDashboard, Wallet, Sparkles, PlusCircle } from "lucide-react";
import SignOutButton from "./sign-out-button";

export type AppHeaderProps = {
  isCoordenador?: boolean;
  isFinanceiro?: boolean;
  canExtractDemandas?: boolean;
};

const navLinkClassName =
  "flex min-h-11 items-center gap-2 rounded-full px-4 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default function AppHeader({
  isCoordenador = false,
  isFinanceiro = false,
  canExtractDemandas = false,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 rounded-lg font-semibold text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-xl text-white"
            >
              E
            </span>
            <span className="text-2xl">EctoDash</span>
          </Link>

          <div className="md:hidden">
            <SignOutButton />
          </div>
        </div>

        <nav
          aria-label="Navegação principal"
          className="flex flex-wrap items-center gap-2"
        >
          {isCoordenador && (
            <Link href="/painel" className={navLinkClassName}>
              <LayoutDashboard size={20} aria-hidden="true" />
              Painel do coordenador
            </Link>
          )}

          {(isCoordenador || isFinanceiro) && (
            <Link href="/financeiro" className={navLinkClassName}>
              <Wallet size={20} aria-hidden="true" />
              Financeiro
            </Link>
          )}

          {canExtractDemandas && (
            <Link href="/demandas/extrair" className={navLinkClassName}>
              <Sparkles size={20} aria-hidden="true" />
              Extrair de reunião
            </Link>
          )}

          <Link
            href="/demandas/nova"
            className="flex min-h-11 items-center gap-2 rounded-full bg-blue-700 px-4 text-base font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <PlusCircle size={20} aria-hidden="true" />
            Nova demanda
          </Link>

          <span className="hidden md:block">
            <SignOutButton />
          </span>
        </nav>
      </div>
    </header>
  );
}

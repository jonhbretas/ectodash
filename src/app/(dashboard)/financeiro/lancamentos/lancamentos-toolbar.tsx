"use client";

// Barra do /financeiro/lancamentos — busca rápida por nome/descrição e
// paginação. Mesmo padrão de log-acoes-filters.tsx: cada mudança navega via
// router.push com query string; o componente só guarda o estado momentâneo
// dos controles, nunca os dados. A leitura dos parâmetros é exclusivamente
// server-side (page.tsx). Busca nova volta à página 1; trocar de página
// preserva a busca.
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import type { LancamentosFilters } from "./lancamentos-filter-schema";

export type LancamentosToolbarProps = {
  currentFilters: LancamentosFilters;
  total: number;
  totalPages: number;
};

export default function LancamentosToolbar({
  currentFilters,
  total,
  totalPages,
}: LancamentosToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [buscaDraft, setBuscaDraft] = useState(currentFilters.busca ?? "");

  const pagina = currentFilters.pagina ?? 1;
  const temBusca = Boolean(currentFilters.busca);

  function navigateWith(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const query = params.toString();
    router.push(
      query ? `/financeiro/lancamentos?${query}` : "/financeiro/lancamentos"
    );
  }

  function submitBusca() {
    const termo = buscaDraft.trim();
    // Busca nova sempre recomeça a listagem na página 1.
    navigateWith({ busca: termo || undefined, pagina: undefined });
  }

  function clearBusca() {
    setBuscaDraft("");
    navigateWith({ busca: undefined, pagina: undefined });
  }

  function irPara(paginaAlvo: number) {
    if (paginaAlvo < 1 || paginaAlvo > totalPages) return;
    navigateWith({ pagina: String(paginaAlvo) });
  }

  return (
    <section
      aria-label="Buscar e paginar lançamentos"
      className="flex w-full flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200/60"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form action={submitBusca} role="search" className="flex gap-2">
          <label htmlFor="busca-lancamentos" className="sr-only">
            Buscar lançamento por nome
          </label>
          <input
            id="busca-lancamentos"
            name="busca"
            value={buscaDraft}
            onChange={(event) => setBuscaDraft(event.target.value)}
            placeholder="Buscar por nome do lançamento..."
            className="min-h-14 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="flex min-h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#2195B9] text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <Search size={22} aria-hidden="true" />
          </button>
        </form>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2">
          <button
            type="button"
            onClick={() => irPara(pagina - 1)}
            disabled={pagina <= 1}
            aria-label="Página anterior"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <span className="text-base text-zinc-600">
            Página <strong className="text-zinc-900">{pagina}</strong> de{" "}
            {totalPages} · {total} lançamento{total === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => irPara(pagina + 1)}
            disabled={pagina >= totalPages}
            aria-label="Próxima página"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      {temBusca && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-base text-zinc-700 ring-1 ring-zinc-200/60">
            Busca: {currentFilters.busca}
            <button
              type="button"
              onClick={clearBusca}
              aria-label="Remover busca"
              className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-zinc-200"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        </div>
      )}
    </section>
  );
}

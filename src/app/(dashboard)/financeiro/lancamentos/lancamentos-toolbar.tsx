"use client";

// Barra do /financeiro/lancamentos — busca rápida por nome/descrição e
// paginação. Mesmo padrão de log-acoes-filters.tsx: cada mudança navega via
// router.push com query string; o componente só guarda o estado momentâneo
// dos controles, nunca os dados. A leitura dos parâmetros é exclusivamente
// server-side (page.tsx). Busca nova volta à página 1; trocar de página
// preserva a busca.
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
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
  const temFiltros = Boolean(currentFilters.busca || currentFilters.mes || currentFilters.tipo);

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

  function limparFiltros() {
    setBuscaDraft("");
    navigateWith({ busca: undefined, mes: undefined, tipo: undefined, pagina: undefined });
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
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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

      <div className="flex flex-wrap items-end gap-3 border-t border-zinc-100 pt-3">
        <div className="flex items-center gap-2 text-base font-medium text-zinc-600">
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filtrar por
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
          Mês
          <input
            type="month"
            value={currentFilters.mes ?? ""}
            onChange={(event) => navigateWith({ mes: event.target.value || undefined, pagina: undefined })}
            className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-600">
          Tipo
          <select
            value={currentFilters.tipo ?? ""}
            onChange={(event) => navigateWith({ tipo: event.target.value || undefined, pagina: undefined })}
            className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <option value="">Entradas e saídas</option>
            <option value="entrada">Somente entradas</option>
            <option value="saida">Somente saídas</option>
          </select>
        </label>
        {temFiltros && (
          <button
            type="button"
            onClick={limparFiltros}
            className="mb-0.5 inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-base font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={17} aria-hidden="true" />
            Limpar filtros
          </button>
        )}
      </div>
    </section>
  );
}

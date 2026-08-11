"use client";

// Barra de filtros da aba "Log de ações" do /painel — busca por entidade/id,
// select de entidade e paginação. Mesmo padrão de voluntarios-filters.tsx:
// cada mudança navega via router.push com query string; o componente só
// guarda o estado momentâneo dos controles, nunca os dados. A leitura dos
// parâmetros é exclusivamente server-side (page.tsx). Trocar filtro volta à
// página 1; navegação de página preserva os filtros.
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ENTIDADES_AUDITADAS } from "@/lib/audit-labels";
import type { LogAcoesFilters } from "./log-acoes-filter-schema";

const ALL_VALUE = "__todas__";

export type LogAcoesFiltersProps = {
  currentFilters: LogAcoesFilters;
  total: number;
  totalPages: number;
};

export default function LogAcoesFilters({
  currentFilters,
  total,
  totalPages,
}: LogAcoesFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [buscaDraft, setBuscaDraft] = useState(currentFilters.busca ?? "");

  const pagina = currentFilters.pagina ?? 1;
  const temFiltro = Boolean(currentFilters.busca || currentFilters.entidade);

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
    router.push(query ? `/painel?${query}` : "/painel");
  }

  function mudarFiltro(updates: Record<string, string | undefined>) {
    // Filtro novo sempre recomeça a listagem na página 1.
    navigateWith({ ...updates, pagina: undefined });
  }

  function submitBusca() {
    const termo = buscaDraft.trim();
    mudarFiltro({ busca: termo || undefined });
  }

  function clearFilters() {
    setBuscaDraft("");
    router.push("/painel");
  }

  function irPara(paginaAlvo: number) {
    if (paginaAlvo < 1 || paginaAlvo > totalPages) return;
    mudarFiltro({ pagina: String(paginaAlvo) });
  }

  return (
    <section
      aria-label="Filtrar log de ações"
      className="flex w-full flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200/60"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form
          action={submitBusca}
          role="search"
          className="flex gap-2 sm:col-span-2"
        >
          <label htmlFor="busca-log" className="sr-only">
            Buscar por entidade ou id do registro
          </label>
          <input
            id="busca-log"
            name="busca"
            value={buscaDraft}
            onChange={(event) => setBuscaDraft(event.target.value)}
            placeholder="Buscar por entidade ou id do registro..."
            className="min-h-14 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="flex min-h-14 w-14 items-center justify-center rounded-xl bg-[#2195B9] text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <Search size={22} aria-hidden="true" />
          </button>
        </form>

        <Select
          value={currentFilters.entidade ?? ALL_VALUE}
          onValueChange={(next) =>
            mudarFiltro({ entidade: next === ALL_VALUE ? undefined : next })
          }
        >
          <SelectTrigger
            aria-label="Filtrar por entidade"
            className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <SelectValue placeholder="Todas as entidades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas as entidades</SelectItem>
            {ENTIDADES_AUDITADAS.map((entidade) => (
              <SelectItem key={entidade.valor} value={entidade.valor}>
                {entidade.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
            {totalPages} · {total} registro{total === 1 ? "" : "s"}
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

      {temFiltro && (
        <div className="flex flex-wrap items-center gap-2">
          {currentFilters.busca && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-base text-zinc-700 ring-1 ring-zinc-200/60">
              Busca: {currentFilters.busca}
              <button
                type="button"
                onClick={() => mudarFiltro({ busca: undefined })}
                aria-label="Remover filtro de busca"
                className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-zinc-200"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          )}
          {currentFilters.entidade && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-base text-zinc-700 ring-1 ring-zinc-200/60">
              Entidade:{" "}
              {ENTIDADES_AUDITADAS.find(
                (e) => e.valor === currentFilters.entidade
              )?.label ?? currentFilters.entidade}
              <button
                type="button"
                onClick={() => mudarFiltro({ entidade: undefined })}
                aria-label="Remover filtro de entidade"
                className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-zinc-200"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 rounded-full bg-white px-4 text-lg font-medium text-zinc-700 ring-1 ring-zinc-300 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </section>
  );
}

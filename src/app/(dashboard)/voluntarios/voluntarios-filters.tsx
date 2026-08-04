"use client";

// Filter bar for /voluntarios — a name/PF search input plus an área select.
// Every change navigates via router.push with an updated query string; the
// component never holds filtered data in client state, only the momentary
// control state (same pattern as financeiro-filters.tsx). The data read of
// these params happens exclusively server-side in page.tsx.
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VoluntariosFilters } from "./voluntarios-filter-schema";

const ALL_VALUE = "__todas__";

export type VoluntariosFiltersProps = {
  areaOptions: string[];
  currentFilters: VoluntariosFilters;
};

export default function VoluntariosFilters({
  areaOptions,
  currentFilters,
}: VoluntariosFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [buscaDraft, setBuscaDraft] = useState(currentFilters.busca ?? "");

  const hasActiveFilter = Boolean(currentFilters.busca || currentFilters.area);

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
    router.push(query ? `/voluntarios?${query}` : "/voluntarios");
  }

  function submitBusca() {
    const termo = buscaDraft.trim();
    navigateWith({ busca: termo || undefined });
  }

  function clearFilters() {
    setBuscaDraft("");
    router.push("/voluntarios");
  }

  return (
    <section
      aria-label="Filtrar voluntários"
      className="flex w-full flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200/60"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <form
          action={submitBusca}
          role="search"
          className="flex gap-2"
        >
          <label htmlFor="busca" className="sr-only">
            Buscar por nome ou código PF
          </label>
          <input
            id="busca"
            name="busca"
            value={buscaDraft}
            onChange={(event) => setBuscaDraft(event.target.value)}
            placeholder="Buscar por nome ou código PF..."
            className="min-h-14 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="flex min-h-14 w-14 items-center justify-center rounded-xl bg-blue-700 text-white transition-colors hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <Search size={22} aria-hidden="true" />
          </button>
        </form>

        <Select
          value={currentFilters.area ?? ALL_VALUE}
          onValueChange={(next) =>
            navigateWith({ area: next === ALL_VALUE ? undefined : next })
          }
        >
          <SelectTrigger
            aria-label="Filtrar por área"
            className="min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <SelectValue placeholder="Todas as áreas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas as áreas</SelectItem>
            {areaOptions.map((area) => (
              <SelectItem key={area} value={area}>
                {area}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilter && (
        <div className="flex flex-wrap items-center gap-2">
          {currentFilters.busca && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-base text-zinc-700 ring-1 ring-zinc-200/60">
              Busca: {currentFilters.busca}
              <button
                type="button"
                onClick={() => navigateWith({ busca: undefined })}
                aria-label="Remover filtro de busca"
                className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-zinc-200"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          )}
          {currentFilters.area && (
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-base text-zinc-700 ring-1 ring-zinc-200/60">
              Área: {currentFilters.area}
              <button
                type="button"
                onClick={() => navigateWith({ area: undefined })}
                aria-label="Remover filtro de área"
                className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-zinc-200"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 rounded-full bg-white px-4 text-lg font-medium text-zinc-700 ring-1 ring-zinc-300 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </section>
  );
}

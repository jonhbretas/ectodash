"use client";

// Compact collapsible filter bar for /financeiro — the same UX pattern as
// demanda-filters.tsx: collapsed by default to a single "Filtros" button
// (plus removable chips for active filters), expanded to a grid of
// controls (Mês, Tipo, Categoria). Every change navigates via
// router.push with an updated query string; this component never holds
// the filtered *data* in client state, only the momentary control state
// and the open/collapsed flag (05-UI-SPEC.md's Filter State Pattern). The
// data-fetching read of these same params happens exclusively server-side
// in page.tsx.
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStoredPreference } from "@/lib/use-stored-preference";
import {
  labelMes,
  type FinanceiroFilters,
} from "./financeiro-filter-schema";

const ALL_VALUE = "__todos__";

// localStorage key — the expanded/collapsed preference, survives reloads.
const OPEN_KEY = "ectodash:filtros-abertos-financeiro";

export type FinanceiroFiltersProps = {
  // Month keys in MM/yyyy, newest first — the server derives them from the
  // unfiltered entry set so a filter never hides its own options.
  mesOptions: string[];
  categoriaOptions: string[];
  currentFilters: FinanceiroFilters;
};

export default function FinanceiroFilters({
  mesOptions,
  categoriaOptions,
  currentFilters,
}: FinanceiroFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openRaw, setOpenRaw] = useStoredPreference(OPEN_KEY, "0");
  const open = openRaw === "1";

  function toggleOpen() {
    setOpenRaw(open ? "0" : "1");
  }

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
    router.push(query ? `/financeiro?${query}` : "/financeiro");
  }

  function removeFilter(key: "mes" | "tipo" | "categoria") {
    navigateWith({ [key]: undefined });
  }

  function clearFilters() {
    router.push("/financeiro");
  }

  const hasActiveFilter = Boolean(
    currentFilters.mes || currentFilters.tipo || currentFilters.categoria
  );

  const activeChips = [
    {
      key: "mes" as const,
      label: `Mês: ${currentFilters.mes ? labelMes(currentFilters.mes) : ""}`,
      title: "Mês",
    },
    {
      key: "tipo" as const,
      label: `Tipo: ${
        currentFilters.tipo === "entrada" ? "Entradas" : "Saídas"
      }`,
      title: "Tipo",
    },
    {
      key: "categoria" as const,
      label: `Categoria: ${currentFilters.categoria ?? ""}`,
      title: "Categoria",
    },
  ].filter((chip) => {
    if (chip.key === "mes") return Boolean(currentFilters.mes);
    if (chip.key === "tipo") return Boolean(currentFilters.tipo);
    return Boolean(currentFilters.categoria);
  });

  const activeCount = activeChips.length;

  const triggerClassName =
    "min-h-14 w-full rounded-xl border border-zinc-200 bg-white px-4 text-lg text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]";

  const selectControl = (
    ariaLabel: string,
    value: string | undefined,
    allLabel: string,
    onChange: (value: string | undefined) => void,
    children: ReactNode
  ) => (
    <Select
      value={value ?? ALL_VALUE}
      onValueChange={(next) =>
        onChange(next === ALL_VALUE ? undefined : next)
      }
    >
      <SelectTrigger aria-label={ariaLabel} className={triggerClassName}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>{allLabel}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );

  return (
    <section
      aria-label="Filtrar lançamentos financeiros"
      className="flex w-full flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200/60"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-zinc-100 px-4 text-lg font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
        >
          <SlidersHorizontal size={20} aria-hidden="true" />
          Filtros
          {activeCount > 0 && (
            <span className="rounded-full bg-[#d4883a] px-2 py-0.5 text-base font-semibold text-white">
              {activeCount}
            </span>
          )}
          {open ? (
            <ChevronUp size={20} aria-hidden="true" className="transition-transform duration-200" />
          ) : (
            <ChevronDown size={20} aria-hidden="true" className="transition-transform duration-200" />
          )}
        </button>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="flex max-w-[16rem] items-center gap-1 truncate rounded-full bg-zinc-100 px-2.5 py-1 text-base text-zinc-700 ring-1 ring-zinc-200/60"
              title={chip.title}
            >
              <span className="truncate">{chip.label}</span>
              <button
                type="button"
                onClick={() => removeFilter(chip.key)}
                aria-label={`Remover filtro de ${chip.title.toLowerCase()}`}
                className="shrink-0 rounded-full p-0.5 transition-colors hover:bg-zinc-200"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          ))}

          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 rounded-full bg-white px-4 text-lg font-medium text-zinc-700 ring-1 ring-zinc-300 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {selectControl(
            "Filtrar por mês",
            currentFilters.mes,
            "Todos os meses",
            (value) => navigateWith({ mes: value }),
            mesOptions.map((mes) => (
              <SelectItem key={mes} value={mes}>
                {labelMes(mes)}
              </SelectItem>
            ))
          )}

          {selectControl(
            "Filtrar por tipo de movimentação",
            currentFilters.tipo,
            "Todas as movimentações",
            (value) => navigateWith({ tipo: value }),
            <>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </>
          )}

          {selectControl(
            "Filtrar por categoria",
            currentFilters.categoria,
            "Todas as categorias",
            (value) => navigateWith({ categoria: value }),
            categoriaOptions.map((categoria) => (
              <SelectItem key={categoria} value={categoria}>
                {categoria}
              </SelectItem>
            ))
          )}
        </div>
      )}
    </section>
  );
}

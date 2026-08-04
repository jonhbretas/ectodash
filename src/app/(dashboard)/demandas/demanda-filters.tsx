"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DemandaFilters } from "./demanda-filter-schema";

// Filter bar: área/projeto Select, responsável Select, Agrupar por Select —
// capped at 3 controls per 05-UI-SPEC.md. Every change navigates via
// router.push with an updated query string; this component never holds the
// filtered *data* in client state, only momentary control state during
// interaction (05-UI-SPEC.md's Filter State Pattern). The actual
// data-fetching read of these same params happens exclusively server-side
// in page.tsx — useSearchParams() here is the one narrow, UI-SPEC-sanctioned
// client read, used only to control which option a Select visually shows.
const ALL_AREAS_VALUE = "__todas__";
const ALL_RESPONSAVEIS_VALUE = "__todos__";
const NO_GROUPING_VALUE = "__sem_agrupamento__";

export type DemandaFiltersProps = {
  areaOptions: string[];
  responsavelOptions: { id: string; label: string }[];
  currentFilters: DemandaFilters;
};

export default function DemandaFilters({
  areaOptions,
  responsavelOptions,
  currentFilters,
}: DemandaFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    router.push(query ? `/?${query}` : "/");
  }

  function handleAreaChange(value: string) {
    navigateWith({ area: value === ALL_AREAS_VALUE ? undefined : value });
  }

  function handleResponsavelChange(value: string) {
    navigateWith({
      responsavel: value === ALL_RESPONSAVEIS_VALUE ? undefined : value,
    });
  }

  function handleAgruparChange(value: string) {
    navigateWith({ agrupar: value === NO_GROUPING_VALUE ? undefined : value });
  }

  function removeAreaFilter() {
    navigateWith({ area: undefined });
  }

  function removeResponsavelFilter() {
    navigateWith({ responsavel: undefined });
  }

  function clearFilters() {
    router.push("/");
  }

  const responsavelLabelById = new Map(
    responsavelOptions.map((option) => [option.id, option.label])
  );

  const hasActiveFilter = Boolean(currentFilters.area || currentFilters.responsavel);

  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Filtrar demandas</span>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-4">
        <div className="flex flex-col gap-2 lg:w-56">
          <Label htmlFor="filtro-area" className="text-xl font-medium text-zinc-900">
            Área ou projeto
          </Label>
          <Select
            value={currentFilters.area ?? ALL_AREAS_VALUE}
            onValueChange={handleAreaChange}
          >
            <SelectTrigger
              id="filtro-area"
              className="min-h-14 w-full rounded-lg border border-zinc-400 bg-white px-4 text-xl text-zinc-900 lg:w-56"
            >
              <SelectValue placeholder="Todas as áreas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AREAS_VALUE}>Todas as áreas</SelectItem>
              {areaOptions.map((area) => (
                <SelectItem key={area} value={area}>
                  {area}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 lg:w-56">
          <Label
            htmlFor="filtro-responsavel"
            className="text-xl font-medium text-zinc-900"
          >
            Responsável
          </Label>
          <Select
            value={currentFilters.responsavel ?? ALL_RESPONSAVEIS_VALUE}
            onValueChange={handleResponsavelChange}
          >
            <SelectTrigger
              id="filtro-responsavel"
              className="min-h-14 w-full rounded-lg border border-zinc-400 bg-white px-4 text-xl text-zinc-900 lg:w-56"
            >
              <SelectValue placeholder="Todos os responsáveis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_RESPONSAVEIS_VALUE}>
                Todos os responsáveis
              </SelectItem>
              {responsavelOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2 lg:w-56">
          <Label htmlFor="filtro-agrupar" className="text-xl font-medium text-zinc-900">
            Agrupar por
          </Label>
          <Select
            value={currentFilters.agrupar ?? NO_GROUPING_VALUE}
            onValueChange={handleAgruparChange}
          >
            <SelectTrigger
              id="filtro-agrupar"
              className="min-h-14 w-full rounded-lg border border-zinc-400 bg-white px-4 text-xl text-zinc-900 lg:w-56"
            >
              <SelectValue placeholder="Sem agrupamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GROUPING_VALUE}>Sem agrupamento</SelectItem>
              <SelectItem value="area">Área/projeto</SelectItem>
              <SelectItem value="responsavel">Responsável</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-14 w-full rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 lg:w-auto lg:border-none lg:bg-transparent lg:px-2 lg:py-0 lg:text-base lg:font-normal lg:underline lg:hover:bg-transparent"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {hasActiveFilter && (
        <div className="flex flex-wrap gap-2">
          {currentFilters.area && (
            <span
              className="flex max-w-[12rem] items-center gap-1 truncate rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-700"
              title={`Área: ${currentFilters.area}`}
            >
              <span className="truncate">Área: {currentFilters.area}</span>
              <button
                type="button"
                onClick={removeAreaFilter}
                aria-label="Remover filtro de área"
                className="shrink-0"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          )}
          {currentFilters.responsavel && (
            <span
              className="flex max-w-[12rem] items-center gap-1 truncate rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-700"
              title={`Responsável: ${
                responsavelLabelById.get(currentFilters.responsavel) ??
                currentFilters.responsavel
              }`}
            >
              <span className="truncate">
                Responsável:{" "}
                {responsavelLabelById.get(currentFilters.responsavel) ??
                  currentFilters.responsavel}
              </span>
              <button
                type="button"
                onClick={removeResponsavelFilter}
                aria-label="Remover filtro de responsável"
                className="shrink-0"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DemandaFilters } from "./demanda-filter-schema";

const NO_GROUPING_VALUE = "__sem_agrupamento__";

function useQuickFilterNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  return (updates: Record<string, string | undefined>) => {
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
  };
}

export type DemandaAgruparFilterProps = {
  currentFilters: DemandaFilters;
};

export function DemandaAgruparFilter({
  currentFilters,
}: DemandaAgruparFilterProps) {
  const navigateWith = useQuickFilterNavigation();

  return (
    <Select
      value={currentFilters.agrupar ?? NO_GROUPING_VALUE}
      onValueChange={(next) =>
        navigateWith({ agrupar: next === NO_GROUPING_VALUE ? undefined : next })
      }
    >
      <SelectTrigger
        aria-label="Agrupar por"
        className="min-h-10 rounded-lg border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        <LayoutGrid size={15} aria-hidden="true" />
        <SelectValue placeholder="Agrupar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_GROUPING_VALUE}>Sem agrupamento</SelectItem>
        <SelectItem value="area">Área</SelectItem>
        <SelectItem value="projeto">Projeto</SelectItem>
        <SelectItem value="responsavel">Responsável</SelectItem>
      </SelectContent>
    </Select>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Circle, Clock, LayoutGrid } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DemandaFilters } from "./demanda-filter-schema";

const NO_GROUPING_VALUE = "__sem_agrupamento__";

const STATUS_OPTIONS: Array<{
  value: "pendente" | "em_andamento" | "concluida";
  label: string;
  Icon: typeof Circle;
}> = [
  { value: "pendente", label: "Pendente", Icon: Circle },
  { value: "em_andamento", label: "Em andamento", Icon: Clock },
  { value: "concluida", label: "Concluída", Icon: CheckCircle2 },
];

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

export type DemandaStatusFilterProps = {
  currentFilters: DemandaFilters;
};

export function DemandaStatusFilter({
  currentFilters,
}: DemandaStatusFilterProps) {
  const navigateWith = useQuickFilterNavigation();
  const statusAtivos = (currentFilters.status ?? "").split(",").filter(Boolean);

  function toggleStatus(value: string) {
    const atual = new Set(statusAtivos);
    if (atual.has(value)) {
      atual.delete(value);
    } else {
      atual.add(value);
    }
    const proximo = STATUS_OPTIONS.map((s) => s.value).filter((v) =>
      atual.has(v)
    );
    navigateWith({ status: proximo.length > 0 ? proximo.join(",") : undefined });
  }

  return (
    <div
      role="group"
      aria-label="Filtrar por status"
      className="flex flex-wrap items-center gap-1.5"
    >
      {STATUS_OPTIONS.map((status) => {
        const ativo = statusAtivos.includes(status.value);
        return (
          <button
            key={status.value}
            type="button"
            aria-pressed={ativo}
            onClick={() => toggleStatus(status.value)}
            className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] ${
              ativo
                ? "bg-[#2195B9] text-white ring-[#2195B9]"
                : "bg-white text-zinc-600 ring-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <status.Icon size={15} aria-hidden="true" />
            {status.label}
          </button>
        );
      })}
    </div>
  );
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
        <SelectItem value="responsavel">Responsável</SelectItem>
      </SelectContent>
    </Select>
  );
}

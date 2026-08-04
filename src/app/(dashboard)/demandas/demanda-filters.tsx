"use client";

// Filter bar — five independent dimensions (Área, Projeto, Evento,
// Voluntário, Status) plus the optional Agrupar por, per the user's
// 2026-08-04 decision. Every change navigates via router.push with an
// updated query string; this component never holds the filtered *data* in
// client state, only momentary control state during interaction
// (05-UI-SPEC.md's Filter State Pattern). The actual data-fetching read of
// these same params happens exclusively server-side in page.tsx.
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

const ALL_VALUE = "__todas__";
const NO_GROUPING_VALUE = "__sem_agrupamento__";

export type EventoFilterOption = { id: number; titulo: string };

export type DemandaFiltersProps = {
  areaOptions: string[];
  projetoOptions: string[];
  eventoOptions: EventoFilterOption[];
  responsavelOptions: { id: string; label: string }[];
  currentFilters: DemandaFilters;
};

export default function DemandaFilters({
  areaOptions,
  projetoOptions,
  eventoOptions,
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

  function removeFilter(key: "area" | "projeto" | "evento" | "responsavel" | "status") {
    navigateWith({ [key]: undefined });
  }

  function clearFilters() {
    router.push("/");
  }

  const responsavelLabelById = new Map(
    responsavelOptions.map((option) => [option.id, option.label])
  );

  const hasActiveFilter = Boolean(
    currentFilters.area ||
      currentFilters.projeto ||
      currentFilters.evento ||
      currentFilters.responsavel ||
      currentFilters.status
  );

  const filterClassName =
    "min-h-14 w-full rounded-lg border border-zinc-400 bg-white px-4 text-xl text-zinc-900";
  const labelClassName = "text-xl font-medium text-zinc-900";

  return (
    <div className="flex flex-col gap-4">
      <span className="sr-only">Filtrar demandas</span>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-area" className={labelClassName}>
            Área
          </Label>
          <Select
            value={currentFilters.area ?? ALL_VALUE}
            onValueChange={(value) =>
              navigateWith({ area: value === ALL_VALUE ? undefined : value })
            }
          >
            <SelectTrigger id="filtro-area" className={filterClassName}>
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

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-projeto" className={labelClassName}>
            Projeto
          </Label>
          <Select
            value={currentFilters.projeto ?? ALL_VALUE}
            onValueChange={(value) =>
              navigateWith({ projeto: value === ALL_VALUE ? undefined : value })
            }
          >
            <SelectTrigger id="filtro-projeto" className={filterClassName}>
              <SelectValue placeholder="Todos os projetos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Todos os projetos</SelectItem>
              {projetoOptions.map((projeto) => (
                <SelectItem key={projeto} value={projeto}>
                  {projeto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-evento" className={labelClassName}>
            Evento
          </Label>
          <Select
            value={currentFilters.evento ?? ALL_VALUE}
            onValueChange={(value) =>
              navigateWith({ evento: value === ALL_VALUE ? undefined : value })
            }
          >
            <SelectTrigger id="filtro-evento" className={filterClassName}>
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Todos os eventos</SelectItem>
              {eventoOptions.map((evento) => (
                <SelectItem key={evento.id} value={String(evento.id)}>
                  {evento.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-responsavel" className={labelClassName}>
            Voluntário
          </Label>
          <Select
            value={currentFilters.responsavel ?? ALL_VALUE}
            onValueChange={(value) =>
              navigateWith({
                responsavel: value === ALL_VALUE ? undefined : value,
              })
            }
          >
            <SelectTrigger id="filtro-responsavel" className={filterClassName}>
              <SelectValue placeholder="Todos os voluntários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Todos os voluntários</SelectItem>
              {responsavelOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-status" className={labelClassName}>
            Status
          </Label>
          <Select
            value={currentFilters.status ?? ALL_VALUE}
            onValueChange={(value) =>
              navigateWith({ status: value === ALL_VALUE ? undefined : value })
            }
          >
            <SelectTrigger id="filtro-status" className={filterClassName}>
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-agrupar" className={labelClassName}>
            Agrupar por
          </Label>
          <Select
            value={currentFilters.agrupar ?? NO_GROUPING_VALUE}
            onValueChange={(value) =>
              navigateWith({
                agrupar: value === NO_GROUPING_VALUE ? undefined : value,
              })
            }
          >
            <SelectTrigger id="filtro-agrupar" className={filterClassName}>
              <SelectValue placeholder="Sem agrupamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GROUPING_VALUE}>Sem agrupamento</SelectItem>
              <SelectItem value="area">Área</SelectItem>
              <SelectItem value="responsavel">Responsável</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasActiveFilter && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              key: "area" as const,
              label: `Área: ${currentFilters.area}`,
              title: `Área: ${currentFilters.area}`,
            },
            {
              key: "projeto" as const,
              label: `Projeto: ${currentFilters.projeto}`,
              title: `Projeto: ${currentFilters.projeto}`,
            },
            {
              key: "evento" as const,
              label: `Evento: ${
                eventoOptions.find(
                  (e) => String(e.id) === currentFilters.evento
                )?.titulo ?? currentFilters.evento
              }`,
              title: "Evento",
            },
            {
              key: "responsavel" as const,
              label: `Voluntário: ${
                responsavelLabelById.get(currentFilters.responsavel ?? "") ??
                currentFilters.responsavel
              }`,
              title: "Voluntário",
            },
            {
              key: "status" as const,
              label: `Status: ${
                currentFilters.status === "em_andamento"
                  ? "Em andamento"
                  : currentFilters.status === "concluida"
                    ? "Concluída"
                    : "Pendente"
              }`,
              title: "Status",
            },
          ]
            .filter((chip) => {
              if (chip.key === "area") return Boolean(currentFilters.area);
              if (chip.key === "projeto") return Boolean(currentFilters.projeto);
              if (chip.key === "evento") return Boolean(currentFilters.evento);
              if (chip.key === "responsavel")
                return Boolean(currentFilters.responsavel);
              return Boolean(currentFilters.status);
            })
            .map((chip) => (
              <span
                key={chip.key}
                className="flex max-w-[14rem] items-center gap-1 truncate rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-700"
                title={chip.title}
              >
                <span className="truncate">{chip.label}</span>
                <button
                  type="button"
                  onClick={() => removeFilter(chip.key)}
                  aria-label={`Remover filtro de ${chip.title.toLowerCase()}`}
                  className="shrink-0"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            ))}

          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 rounded-full border border-zinc-400 bg-white px-4 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}

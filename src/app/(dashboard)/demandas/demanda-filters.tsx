"use client";

// Compact filter trigger + right-side modal drawer — the trigger lives in
// the header row (same height as the view toggle) and opening shows the
// selects in a modal anchored to the right edge, so the top of the screen
// keeps nearly all the space for the work area. Active filters render as
// removable chips inside the drawer. Every change navigates via
// router.push with an updated query string; this component never holds the
// filtered *data* in client state, only the momentary control state and the
// open/collapsed flag (05-UI-SPEC.md's Filter State Pattern). The actual
// data-fetching read of these same params happens exclusively server-side
// in page.tsx.
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStoredPreference } from "@/lib/use-stored-preference";
import { agruparEventosPorMes } from "@/lib/eventos-agrupados";
import type { DemandaFilters } from "./demanda-filter-schema";

const ALL_VALUE = "__todas__";
const NO_GROUPING_VALUE = "__sem_agrupamento__";

// Status multi-select — canonical order is the URL order, so toggling
// always rebuilds the param in this sequence.
const STATUS_OPTIONS: Array<{ value: "pendente" | "em_andamento" | "concluida"; label: string }> = [
  { value: "pendente", label: "Pendente" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "concluida", label: "Concluída" },
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label])
);

function dataEventoLabel(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function eventoLabel(evento: EventoFilterOption): string {
  const data = evento.data_evento ? ` — ${dataEventoLabel(evento.data_evento)}` : "";
  const local = evento.local ? ` · ${evento.local}` : "";
  return `${evento.titulo}${data}${local}`;
}

// localStorage key — the expanded/collapsed preference, survives reloads.
const OPEN_KEY = "ectodash:filtros-abertos";

export type EventoFilterOption = {
  id: number;
  titulo: string;
  data_evento: string;
  local: string | null;
};

export type EtiquetaFilterOption = { id: number; area: string; nome: string };

export type DemandaFiltersProps = {
  areaOptions: string[];
  projetoOptions: string[];
  eventoOptions: EventoFilterOption[];
  etiquetaOptions: EtiquetaFilterOption[];
  responsavelOptions: { id: string; label: string }[];
  currentFilters: DemandaFilters;
};

export default function DemandaFilters({
  areaOptions,
  projetoOptions,
  eventoOptions,
  etiquetaOptions,
  responsavelOptions,
  currentFilters,
}: DemandaFiltersProps) {
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
    router.push(query ? `/?${query}` : "/");
  }

  function removeFilter(
    key: "area" | "projeto" | "evento" | "etiqueta" | "responsavel" | "status"
  ) {
    navigateWith({ [key]: undefined });
  }

  function clearFilters() {
    router.push("/");
  }

  const statusAtivos = (currentFilters.status ?? "").split(",").filter(Boolean);

  function toggleStatus(value: string) {
    const atual = new Set(statusAtivos);
    if (atual.has(value)) {
      atual.delete(value);
    } else {
      atual.add(value);
    }
    const proximo = STATUS_OPTIONS.map((s) => s.value).filter((v) => atual.has(v));
    navigateWith({ status: proximo.length > 0 ? proximo.join(",") : undefined });
  }

  const responsavelLabelById = new Map(
    responsavelOptions.map((option) => [option.id, option.label])
  );

  const hasActiveFilter = Boolean(
    currentFilters.area ||
      currentFilters.projeto ||
      currentFilters.evento ||
      currentFilters.etiqueta ||
      currentFilters.responsavel ||
      currentFilters.status
  );

  const activeChips = [
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
        (() => {
          const ev = eventoOptions.find((e) => String(e.id) === currentFilters.evento);
          return ev ? eventoLabel(ev) : currentFilters.evento;
        })()
      }`,
      title: "Evento",
    },
    {
      key: "etiqueta" as const,
      label: `Etiqueta: ${
        etiquetaOptions.find((e) => String(e.id) === currentFilters.etiqueta)
          ?.nome ?? currentFilters.etiqueta
      }`,
      title: "Etiqueta",
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
        statusAtivos.length > 0
          ? statusAtivos.map((s) => STATUS_LABEL[s] ?? s).join(" + ")
          : ""
      }`,
      title: "Status",
    },
  ].filter((chip) => {
    if (chip.key === "area") return Boolean(currentFilters.area);
    if (chip.key === "projeto") return Boolean(currentFilters.projeto);
    if (chip.key === "evento") return Boolean(currentFilters.evento);
    if (chip.key === "etiqueta") return Boolean(currentFilters.etiqueta);
    if (chip.key === "responsavel") return Boolean(currentFilters.responsavel);
    return Boolean(currentFilters.status);
  });

  const activeCount = activeChips.length;

  const triggerClassName =
    "min-h-12 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-900 transition-all duration-200 hover:border-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]";

  const selectControl = (
    ariaLabel: string,
    value: string | undefined,
    allValue: string,
    allLabel: string,
    onChange: (value: string | undefined) => void,
    children: ReactNode
  ) => (
    <Select
      value={value ?? allValue}
      onValueChange={(next) =>
        onChange(next === allValue ? undefined : next)
      }
    >
      <SelectTrigger aria-label={ariaLabel} className={triggerClassName}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>{allLabel}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls="demanda-filtros-painel"
        className="flex min-h-10 items-center gap-2 rounded-xl bg-zinc-100 px-3.5 text-base font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        Filtros
        {activeCount > 0 && (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#d4883a] px-1.5 text-sm font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-zinc-900/30"
            onClick={() => setOpenRaw("0")}
            aria-hidden="true"
          />
          <div
            id="demanda-filtros-painel"
            role="dialog"
            aria-modal="true"
            aria-label="Filtrar demandas"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
                Filtros
                {activeCount > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#f5f0eb] px-1.5 text-sm font-semibold text-[#8b5e2a]">
                    {activeCount} ativo{activeCount === 1 ? "" : "s"}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => setOpenRaw("0")}
                aria-label="Fechar filtros"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
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
                <button
                  type="button"
                  onClick={clearFilters}
                  className="min-h-11 rounded-full bg-white px-4 text-base font-medium text-zinc-700 ring-1 ring-zinc-300 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
                >
                  Limpar filtros
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              {selectControl(
                "Filtrar por área",
                currentFilters.area,
                ALL_VALUE,
                "Todas as áreas",
                (value) => navigateWith({ area: value }),
                areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>
                    {area}
                  </SelectItem>
                ))
              )}

              {selectControl(
                "Filtrar por projeto",
                currentFilters.projeto,
                ALL_VALUE,
                "Todos os projetos",
                (value) => navigateWith({ projeto: value }),
                projetoOptions.map((projeto) => (
                  <SelectItem key={projeto} value={projeto}>
                    {projeto}
                  </SelectItem>
                ))
              )}

              {selectControl(
                "Filtrar por evento",
                currentFilters.evento,
                ALL_VALUE,
                "Todos os eventos",
                (value) => navigateWith({ evento: value }),
                agruparEventosPorMes(
                  eventoOptions.map((e) => ({
                    id: e.id,
                    titulo: e.titulo,
                    data_evento: e.data_evento,
                    local: e.local,
                  }))
                ).map((grupo) => (
                  <SelectGroup key={grupo.label}>
                    <SelectLabel>{grupo.label}</SelectLabel>
                    {grupo.eventos.map((evento) => (
                      <SelectItem key={evento.id} value={String(evento.id)}>
                        {eventoLabel(evento)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))
              )}

              {selectControl(
                "Filtrar por etiqueta",
                currentFilters.etiqueta,
                ALL_VALUE,
                "Todas as etiquetas",
                (value) => navigateWith({ etiqueta: value }),
                etiquetaOptions.map((etiqueta) => (
                  <SelectItem key={etiqueta.id} value={String(etiqueta.id)}>
                    {etiqueta.nome} ({etiqueta.area})
                  </SelectItem>
                ))
              )}

              {selectControl(
                "Filtrar por voluntário",
                currentFilters.responsavel,
                ALL_VALUE,
                "Todos os voluntários",
                (value) => navigateWith({ responsavel: value }),
                responsavelOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))
              )}

              <div className="flex flex-col gap-1.5">
                <span className="text-base font-medium text-zinc-500">
                  Filtrar por status
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {STATUS_OPTIONS.map((status) => {
                    const ativo = statusAtivos.includes(status.value);
                    return (
                      <button
                        key={status.value}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => toggleStatus(status.value)}
                        className={`min-h-11 rounded-full px-4 text-base font-medium ring-1 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a] ${
                          ativo
                            ? "bg-[#d4883a] text-white ring-[#d4883a]"
                            : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50"
                        }`}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => navigateWith({ status: undefined })}
                    disabled={statusAtivos.length === 0}
                    className="min-h-11 rounded-full px-4 text-base font-medium text-zinc-500 ring-1 ring-transparent transition-colors hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a] disabled:opacity-50"
                  >
                    Todos
                  </button>
                </div>
              </div>

              {selectControl(
                "Agrupar por",
                currentFilters.agrupar,
                NO_GROUPING_VALUE,
                "Sem agrupamento",
                (value) => navigateWith({ agrupar: value }),
                <>
                  <SelectItem value="area">Área</SelectItem>
                  <SelectItem value="responsavel">Responsável</SelectItem>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

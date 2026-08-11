"use client";

import Link from "next/link";
import { Calendar, User, CheckSquare, Square } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import StatusBadge, { type DemandaStatus } from "./status-badge";
import OverdueBadge from "./overdue-badge";

// Full 04-UI-SPEC.md mobile card layout, extended from plan 04-02's minimal
// tracer version. The whole card is the tap target — no separate "Editar"
// button on mobile.
export type DemandaCardProps = {
  id: number;
  titulo: string;
  responsavelEmails: string[];
  prazo: string;
  status: DemandaStatus;
  atrasada: boolean;
  area: string | null;
  projeto?: string | null;
  eventoNome?: string | null;
  etiquetaNome?: string | null;
  checklistTotal?: number;
  checklistFeitos?: number;
  selectionActive?: boolean;
  selectedIds?: Set<number>;
  onToggle?: (id: number) => void;
};

export default function DemandaCard({
  id,
  titulo,
  responsavelEmails,
  prazo,
  status,
  atrasada,
  area,
  projeto,
  eventoNome,
  etiquetaNome,
  checklistTotal = 0,
  checklistFeitos = 0,
  selectionActive = false,
  selectedIds,
  onToggle,
}: DemandaCardProps) {
  const prazoFormatada = format(new Date(`${prazo}T00:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });

  const selected = selectionActive ? selectedIds?.has(id) ?? false : false;

  return (
    <li className="flex items-start gap-2">
      {selectionActive && (
        <button
          type="button"
          aria-label={selected ? `Desmarcar ${titulo}` : `Selecionar ${titulo}`}
          aria-pressed={selected}
          onClick={() => onToggle?.(id)}
          className="mt-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          {selected ? (
            <CheckSquare size={20} className="text-[#2195B9]" />
          ) : (
            <Square size={20} />
          )}
        </button>
      )}
      <Link
        href={`/demandas/${id}/editar`}
        className="flex flex-1 flex-col gap-2.5 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 transition-all duration-200 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-base font-semibold text-zinc-900">
            {titulo}
          </p>
          <StatusBadge status={status} />
        </div>

        <p className="flex items-center gap-1.5 text-base text-zinc-600">
          <User size={15} aria-hidden="true" />
          {responsavelEmails.length > 0
            ? responsavelEmails.join(", ")
            : "Sem responsável definido"}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`flex items-center gap-1.5 text-base ${
              atrasada ? "font-medium text-red-700" : "text-zinc-600"
            }`}
          >
            <Calendar size={15} aria-hidden="true" />
            {prazoFormatada}
          </p>
          {atrasada && <OverdueBadge prazo={prazo} />}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {area ? (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base text-zinc-700">
              {area}
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base text-zinc-400">
              Sem área definida
            </span>
          )}
          {projeto && (
            <span className="rounded-full bg-[#E6E6E6] px-2.5 py-0.5 text-base font-medium text-[#2195B9] ring-1 ring-[#E6E6E6]/60">
              {projeto}
            </span>
          )}
          {eventoNome && (
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-base font-medium text-purple-700 ring-1 ring-purple-200/60">
              {eventoNome}
            </span>
          )}
          {etiquetaNome && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
              {etiquetaNome}
            </span>
          )}
          {checklistTotal > 0 && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base text-zinc-600">
              Checklist {checklistFeitos}/{checklistTotal}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

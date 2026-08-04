"use client";

// Kanban board — Trello-style columns (Pendente / Em andamento /
// Concluída) rendered from the same role-scoped demanda data the list view
// uses. Moving a card between columns calls updateDemandaStatus (the same
// RLS-gated update every other status change goes through).
//
// Accessibility is first-class, not an afterthought: drag & drop (HTML5,
// desktop mice) has a full keyboard/touch equivalent — ◀/▶ buttons on each
// card — so the board is usable by everyone, matching the project's
// elderly-inclusive floor. Cards also link to the edit screen.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { updateDemandaStatus } from "./actions";
import OverdueBadge from "./overdue-badge";
import type { DemandaStatus } from "./status-badge";

export type KanbanDemanda = {
  id: number;
  titulo: string;
  responsavelEmails: string[];
  prazo: string;
  status: DemandaStatus;
  atrasada: boolean;
  area: string | null;
};

export type KanbanBoardProps = {
  demandas: KanbanDemanda[];
};

const COLUMNS: Array<{ status: DemandaStatus; label: string; dotClassName: string }> = [
  { status: "pendente", label: "Pendente", dotClassName: "bg-amber-500" },
  { status: "em_andamento", label: "Em andamento", dotClassName: "bg-blue-600" },
  { status: "concluida", label: "Concluída", dotClassName: "bg-green-600" },
];

const STATUS_ORDER: DemandaStatus[] = ["pendente", "em_andamento", "concluida"];

function KanbanCard({
  demanda,
  onMove,
  pending,
}: {
  demanda: KanbanDemanda;
  onMove: (id: number, status: DemandaStatus) => void;
  pending: boolean;
}) {
  const currentIndex = STATUS_ORDER.indexOf(demanda.status);
  const canMoveLeft = currentIndex > 0;
  const canMoveRight = currentIndex < STATUS_ORDER.length - 1;
  const prazoFormatada = format(new Date(`${demanda.prazo}T00:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });

  return (
    <li className="flex flex-col gap-1">
      <div
        draggable={!pending}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", String(demanda.id));
          event.dataTransfer.effectAllowed = "move";
        }}
        className="group rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-shadow hover:shadow focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700"
      >
        <Link
          href={`/demandas/${demanda.id}/editar`}
          className="block text-lg font-semibold leading-snug text-zinc-900 hover:underline focus-visible:outline-none"
        >
          {demanda.titulo}
        </Link>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {demanda.atrasada && (
            <span className="flex items-center gap-1 text-base font-medium text-red-700">
              <AlertTriangle size={16} aria-hidden="true" />
              {prazoFormatada}
            </span>
          )}
          {!demanda.atrasada && (
            <span className="text-base text-zinc-600">{prazoFormatada}</span>
          )}
          {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}
        </div>

        {demanda.area && (
          <span className="mt-1 inline-block w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-700">
            {demanda.area}
          </span>
        )}

        {/* Keyboard/touch movement controls — the accessible equivalent of
            dragging. Disabled at the ends of the status order. */}
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onMove(demanda.id, STATUS_ORDER[currentIndex - 1])}
            disabled={!canMoveLeft || pending}
            aria-label={`Mover "${demanda.titulo}" para ${COLUMNS[currentIndex - 1]?.label ?? ""}`}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onMove(demanda.id, STATUS_ORDER[currentIndex + 1])}
            disabled={!canMoveRight || pending}
            aria-label={`Mover "${demanda.titulo}" para ${COLUMNS[currentIndex + 1]?.label ?? ""}`}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          {pending && <span className="text-base text-zinc-500">Movendo...</span>}
        </div>
      </div>
    </li>
  );
}

export default function KanbanBoard({ demandas }: KanbanBoardProps) {
  const router = useRouter();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Local optimistic state — moving a card re-renders instantly; the
  // server action + router.refresh() reconcile the real source of truth.
  // The parent passes a `key` derived from the server rows (id+status), so
  // local state resets automatically whenever the server data changes.
  const [localDemandas, setLocalDemandas] = useState(demandas);

  function moveDemanda(id: number, status: DemandaStatus) {
    setLocalDemandas((current) =>
      current.map((d) => (d.id === id ? { ...d, status } : d))
    );
    startTransition(async () => {
      await updateDemandaStatus(id, status);
      router.refresh();
    });
  }

  const byStatus = useMemo(() => {
    const buckets: Record<DemandaStatus, KanbanDemanda[]> = {
      pendente: [],
      em_andamento: [],
      concluida: [],
    };
    for (const d of localDemandas) {
      buckets[d.status].push(d);
    }
    return buckets;
  }, [localDemandas]);

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4 lg:flex-row">
      {COLUMNS.map((column) => {
        const items = byStatus[column.status];
        const total = localDemandas.length;

        return (
          <section
            key={column.status}
            aria-label={`Coluna ${column.label} — ${items.length} ${items.length === 1 ? "demanda" : "demandas"}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer.getData("text/plain");
              const id = Number(raw);
              if (Number.isFinite(id)) moveDemanda(id, column.status);
              setDraggedId(null);
            }}
            className={`flex w-full flex-col rounded-xl border bg-zinc-100/60 p-3 transition-colors lg:w-1/3 ${
              draggedId !== null ? "border-blue-400" : "border-zinc-200"
            }`}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
                <span
                  className={`h-3 w-3 rounded-full ${column.dotClassName}`}
                  aria-hidden="true"
                />
                {column.label}
              </h3>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-base font-medium text-zinc-700">
                {items.length}/{total}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-base text-zinc-500">
                Nenhuma demanda aqui
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((demanda) => (
                  <KanbanCard
                    key={demanda.id}
                    demanda={demanda}
                    onMove={moveDemanda}
                    pending={pending}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <Link
        href="/demandas/nova"
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-400 px-4 py-3 text-xl font-medium text-zinc-700 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 lg:hidden"
      >
        <PlusCircle size={22} aria-hidden="true" />
        Nova demanda
      </Link>
    </div>
  );
}

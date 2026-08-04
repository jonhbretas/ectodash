"use client";

// Kanban board — the primary work view. Trello-style columns (Pendente /
// Em andamento / Concluída) rendered from the same role-scoped demanda data
// the list view uses. Moving a card between columns calls
// updateDemandaStatus (the same RLS-gated update every other status change
// goes through).
//
// The board is full-width and column-driven: each column can be collapsed
// to a slim strip (persisted in localStorage), and the remaining columns
// flex to take the freed space — the user controls how much of the screen
// the workflow occupies. On small screens columns stack vertically and the
// collapse affordance is hidden.
//
// Accessibility is first-class, not an afterthought: drag & drop (HTML5,
// desktop mice) has a full keyboard/touch equivalent — ◀/▶ buttons on each
// card — so the board is usable by everyone, matching the project's
// elderly-inclusive floor. Cards also link to the edit screen.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { updateDemandaStatus } from "./actions";
import OverdueBadge from "./overdue-badge";
import { useStoredPreference } from "@/lib/use-stored-preference";
import type { DemandaStatus } from "./status-badge";

export type KanbanDemanda = {
  id: number;
  titulo: string;
  responsavelEmails: string[];
  prazo: string;
  status: DemandaStatus;
  atrasada: boolean;
  area: string | null;
  etiquetaNome?: string | null;
  checklistTotal?: number;
  checklistFeitos?: number;
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

// localStorage key — which columns are collapsed (comma-separated statuses).
const COLLAPSED_KEY = "ectodash:kanban-colunas-recolhidas";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

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

  const checklistTotal = demanda.checklistTotal ?? 0;
  const checklistFeitos = demanda.checklistFeitos ?? 0;
  const progress = checklistTotal > 0 ? Math.round((checklistFeitos / checklistTotal) * 100) : 0;

  const responsavel = demanda.responsavelEmails[0];
  const extraResponsaveis = demanda.responsavelEmails.length - 1;

  return (
    <li className="flex flex-col gap-2">
      <div
        draggable={!pending}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", String(demanda.id));
          event.dataTransfer.effectAllowed = "move";
        }}
        className="group rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:border-zinc-300 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700"
      >
        <Link
          href={`/demandas/${demanda.id}/editar`}
          className="block text-lg font-semibold leading-snug text-zinc-900 hover:underline focus-visible:outline-none"
        >
          {demanda.titulo}
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`flex items-center gap-1 text-base ${
              demanda.atrasada ? "font-medium text-red-700" : "text-zinc-600"
            }`}
          >
            <Calendar size={15} aria-hidden="true" />
            {prazoFormatada}
          </span>
          {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {responsavel ? (
            <span className="flex min-w-0 items-center gap-1.5 text-base text-zinc-700">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800"
              >
                {initialsOf(responsavel)}
              </span>
              <span className="truncate">{responsavel}</span>
              {extraResponsaveis > 0 && (
                <span className="text-base font-medium text-zinc-500">
                  +{extraResponsaveis}
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-base text-zinc-500">
              <User size={15} aria-hidden="true" />
              Sem responsável
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {demanda.area && (
            <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-700">
              {demanda.area}
            </span>
          )}
          {demanda.etiquetaNome && (
            <span className="w-fit rounded-full bg-amber-50 px-2 py-0.5 text-base font-medium text-amber-900">
              {demanda.etiquetaNome}
            </span>
          )}
        </div>

        {checklistTotal > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div
              role="progressbar"
              aria-label={`Checklist ${checklistFeitos} de ${checklistTotal} itens concluídos`}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200"
            >
              <div
                className={`h-full rounded-full ${
                  progress === 100 ? "bg-green-600" : "bg-blue-600"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-base tabular-nums text-zinc-600">
              {checklistFeitos}/{checklistTotal}
            </span>
          </div>
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

  // Collapsed-column state, persisted in localStorage (comma-separated
  // statuses) via the hydration-safe preference hook.
  const [collapsedRaw, setCollapsedRaw] = useStoredPreference(COLLAPSED_KEY, "");
  const collapsedSet = useMemo(() => {
    const statuses = collapsedRaw.split(",") as DemandaStatus[];
    return new Set(statuses.filter((s) => STATUS_ORDER.includes(s)));
  }, [collapsedRaw]);

  function toggleCollapsed(status: DemandaStatus) {
    const next = new Set(collapsedSet);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    setCollapsedRaw([...next].join(","));
  }

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
    <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-stretch">
      {COLUMNS.map((column) => {
        const items = byStatus[column.status];
        const total = localDemandas.length;
        const collapsed = collapsedSet.has(column.status);

        if (collapsed) {
          // Slim strip — keeps the column reachable and its count visible
          // while giving the remaining columns the full width.
          return (
            <section
              key={column.status}
              aria-label={`Coluna ${column.label} recolhida — ${items.length} ${items.length === 1 ? "demanda" : "demandas"}`}
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
              className={`flex w-full flex-col items-center gap-2 rounded-2xl border bg-zinc-100/60 p-2 transition-colors lg:w-20 ${draggedId !== null ? "border-blue-400" : "border-zinc-200"}`}
            >
              <button
                type="button"
                onClick={() => toggleCollapsed(column.status)}
                aria-expanded={false}
                title={`Expandir coluna ${column.label}`}
                className="flex w-full flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                <span
                  className={`h-3 w-3 rounded-full ${column.dotClassName}`}
                  aria-hidden="true"
                />
                <span className="text-center text-base font-semibold leading-tight text-zinc-900">
                  {column.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-base font-medium text-zinc-700">
                  {items.length}
                </span>
              </button>
            </section>
          );
        }

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
            className={`flex w-full min-w-0 flex-col rounded-2xl border bg-zinc-100/60 p-3 transition-colors lg:flex-1 ${
              draggedId !== null ? "border-blue-400" : "border-zinc-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <h3 className="flex min-w-0 items-center gap-2 text-lg font-semibold text-zinc-900">
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${column.dotClassName}`}
                  aria-hidden="true"
                />
                <span className="truncate">{column.label}</span>
              </h3>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full bg-white px-2.5 py-0.5 text-base font-medium text-zinc-700">
                  {items.length}/{total}
                </span>
                <button
                  type="button"
                  onClick={() => toggleCollapsed(column.status)}
                  aria-expanded={true}
                  aria-label={`Recolher coluna ${column.label}`}
                  title={`Recolher coluna ${column.label}`}
                  className="hidden h-10 w-10 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 lg:flex"
                >
                  <ChevronDown size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-300 p-3 text-center text-base text-zinc-500">
                Nenhuma demanda aqui
              </p>
            ) : (
              <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto lg:max-h-[calc(100dvh-22rem)]">
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

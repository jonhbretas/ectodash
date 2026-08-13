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
//
// Bulk management mirrors the list view: a "Selecionar" button (role-gated
// via canGerir) enters selection mode, where each card shows a checkbox and
// the toolbar offers "Selecionar todas", "Mesclar" (≥2 selecionadas — the
// user picks which demanda stays, the rest are absorbed by
// mesclarDemandas), "Excluir" (excluirDemandas) and "Cancelar". Both
// destructive actions require an explicit confirmation panel.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Square,
  Trash2,
  User,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { excluirDemandas, mesclarDemandas, updateDemandaStatus } from "./actions";
import OverdueBadge from "./overdue-badge";
import StatusBadge from "./status-badge";
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
  // Role gate for the bulk-selection toolbar (coordenador_geral or
  // coordenador_area), same shape as DemandaList's canExcluir. RLS and the
  // merge function still govern every destructive write server-side.
  canGerir?: boolean;
};

const COLUMNS: Array<{ status: DemandaStatus; label: string; dotClassName: string; bgClassName: string }> = [
  { status: "pendente", label: "Pendente", dotClassName: "bg-amber-400", bgClassName: "bg-amber-50/60" },
  { status: "em_andamento", label: "Em andamento", dotClassName: "bg-[#2195B9]", bgClassName: "bg-[#E6E6E6]/60" },
  { status: "concluida", label: "Concluída", dotClassName: "bg-green-500", bgClassName: "bg-green-50/60" },
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
  selectionMode,
  selected,
  onToggle,
}: {
  demanda: KanbanDemanda;
  onMove: (id: number, status: DemandaStatus) => void;
  pending: boolean;
  selectionMode: boolean;
  selected: boolean;
  onToggle: (id: number) => void;
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
    <li className="flex items-start gap-2">
      {selectionMode && (
        <button
          type="button"
          aria-label={selected ? `Desmarcar ${demanda.titulo}` : `Selecionar ${demanda.titulo}`}
          aria-pressed={selected}
          onClick={() => onToggle(demanda.id)}
          className="mt-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          {selected ? (
            <CheckSquare size={20} className="text-[#2195B9]" />
          ) : (
            <Square size={20} />
          )}
        </button>
      )}
      <div
        draggable={!pending && !selectionMode}
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", String(demanda.id));
          event.dataTransfer.effectAllowed = "move";
        }}
        className={`group w-full rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 transition-all duration-150 hover:ring-[#E6E6E6] hover:shadow-[0_1px_4px_rgba(33,149,185,0.06)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2195B9] ${
          selected
            ? "ring-2 ring-[#2195B9] bg-[#2195B9]/5"
            : "ring-zinc-200/60"
        }`}
      >
        <Link
          href={`/demandas/${demanda.id}/editar`}
          className="block text-base font-semibold leading-snug text-zinc-900 hover:text-[#2195B9] transition-colors duration-200 focus-visible:outline-none"
        >
          {demanda.titulo}
        </Link>

        {/* Prazo + responsável + mover coluna (uma linha) */}
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`flex shrink-0 items-center gap-1 text-base ${
              demanda.atrasada ? "font-medium text-red-700" : "text-zinc-500"
            }`}
          >
            <Calendar size={14} aria-hidden="true" />
            {prazoFormatada}
          </span>
          {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}

          {responsavel ? (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-base text-zinc-700">
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E6E6E6] text-xs font-semibold text-[#2195B9]"
              >
                {initialsOf(responsavel)}
              </span>
              <span className="truncate">{responsavel}</span>
              {extraResponsaveis > 0 && (
                <span className="text-base font-medium text-zinc-400">
                  +{extraResponsaveis}
                </span>
              )}
            </span>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-base text-zinc-400">
              <User size={14} aria-hidden="true" />
              Sem responsável
            </span>
          )}

          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onMove(demanda.id, STATUS_ORDER[currentIndex - 1])}
              disabled={!canMoveLeft || pending}
              aria-label={`Mover "${demanda.titulo}" para ${COLUMNS[currentIndex - 1]?.label ?? ""}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-all duration-150 hover:bg-[#E6E6E6] hover:text-[#2195B9] disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onMove(demanda.id, STATUS_ORDER[currentIndex + 1])}
              disabled={!canMoveRight || pending}
              aria-label={`Mover "${demanda.titulo}" para ${COLUMNS[currentIndex + 1]?.label ?? ""}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-all duration-150 hover:bg-[#E6E6E6] hover:text-[#2195B9] disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
            {pending && <span className="text-base text-zinc-400">Movendo...</span>}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {demanda.area && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-600">
              {demanda.area}
            </span>
          )}
          {demanda.etiquetaNome && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
              {demanda.etiquetaNome}
            </span>
          )}
        </div>

        {checklistTotal > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <div
              role="progressbar"
              aria-label={`Checklist ${checklistFeitos} de ${checklistTotal} itens concluídos`}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  progress === 100 ? "bg-green-500" : "bg-[#2195B9]"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-base tabular-nums text-zinc-500">
              {checklistFeitos}/{checklistTotal}
            </span>
          </div>
        )}
      </div>
    </li>
  );
}

export default function KanbanBoard({ demandas, canGerir = false }: KanbanBoardProps) {
  const router = useRouter();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  // Local optimistic state — moving a card re-renders instantly; the
  // server action + router.refresh() reconcile the real source of truth.
  // The parent passes a `key` derived from the server rows (id+status), so
  // local state resets automatically whenever the server data changes.
  const [localDemandas, setLocalDemandas] = useState(demandas);

  // Bulk-management state (selection mode mirrors DemandaList).
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmingMerge, setConfirmingMerge] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [manterId, setManterId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

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

  const selectedSorted = useMemo(
    () =>
      [...selected]
        .map((id) => localDemandas.find((d) => d.id === id))
        .filter((d): d is KanbanDemanda => Boolean(d))
        .sort((a, b) => a.id - b.id),
    [selected, localDemandas]
  );

  const allSelected =
    localDemandas.length > 0 && selected.size === localDemandas.length;

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(localDemandas.map((d) => d.id))
    );
  };

  const enterSelection = () => {
    setSelectionMode(true);
    setMessage(null);
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
    setConfirmingMerge(false);
    setConfirmingDelete(false);
    setManterId(null);
    setMessage(null);
  };

  const confirmMesclar = async () => {
    if (manterId === null || selected.size < 2) return;
    const removerIds = [...selected].filter((id) => id !== manterId);
    setBusy(true);
    const result = await mesclarDemandas(manterId, removerIds);
    setBusy(false);
    if (result.ok) {
      exitSelection();
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.message });
      setConfirmingMerge(false);
    }
  };

  const confirmExcluir = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    const result = await excluirDemandas([...selected]);
    setBusy(false);
    if (result.ok) {
      exitSelection();
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.message });
      setConfirmingDelete(false);
    }
  };

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
    <div className="flex w-full flex-col gap-4">
      {(canGerir || selectionMode) && (
        <div className="flex flex-wrap items-center gap-2">
          {canGerir && localDemandas.length > 0 && !selectionMode && (
            <button
              type="button"
              onClick={enterSelection}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] sm:text-base"
            >
              <CheckSquare size={16} aria-hidden="true" />
              Selecionar
            </button>
          )}

          {selectionMode && (
            <>
              <span className="rounded-full bg-[#E6E6E6] px-3 py-1 text-base font-medium text-[#28627B]">
                {selected.size} {selected.size === 1 ? "selecionada" : "selecionadas"}
              </span>
              <button
                type="button"
                onClick={toggleAll}
                className="flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              >
                {allSelected ? (
                  <Square size={16} aria-hidden="true" />
                ) : (
                  <CheckSquare size={16} aria-hidden="true" />
                )}
                {allSelected ? "Desmarcar todas" : "Selecionar todas"}
              </button>
              {selected.size >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setManterId(selectedSorted[0]?.id ?? null);
                    setConfirmingMerge(true);
                  }}
                  className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[#2195B9] px-3 py-1.5 text-base font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                >
                  <ChevronDown size={16} className="rotate-90" aria-hidden="true" />
                  Mesclar
                </button>
              )}
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="flex min-h-10 items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-base font-medium text-white transition-colors hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Excluir
                </button>
              )}
              <button
                type="button"
                onClick={exitSelection}
                className="flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              >
                <X size={16} aria-hidden="true" />
                Cancelar
              </button>
            </>
          )}
        </div>
      )}

      {confirmingMerge && selectedSorted.length >= 2 && (
        <div className="flex flex-col gap-4 rounded-2xl border border-[#2195B9]/40 bg-[#E6E6E6]/40 px-5 py-4">
          <div>
            <p className="text-xl font-medium text-zinc-900">
              Mesclar {selectedSorted.length} demandas em uma só
            </p>
            <p className="mt-1 text-base text-zinc-600">
              Responsáveis, membros, comentários e itens de checklist das
              demais serão unidos na demanda escolhida, que fica com o
              título, prazo e status atuais. As outras serão excluídas.
            </p>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Qual demanda deve ficar?</legend>
            <p className="text-base font-medium text-zinc-800">
              Qual demanda deve ficar?
            </p>
            {selectedSorted.map((demanda) => (
              <label
                key={demanda.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border bg-white px-4 py-3 transition-colors ${
                  manterId === demanda.id
                    ? "border-[#2195B9] ring-1 ring-[#2195B9]"
                    : "border-zinc-200/60 hover:bg-zinc-50"
                }`}
              >
                <input
                  type="radio"
                  name="manter-demanda"
                  checked={manterId === demanda.id}
                  onChange={() => setManterId(demanda.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#2195B9]"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-1 text-base font-semibold leading-snug text-zinc-900">
                  {demanda.titulo}
                  <span className="flex flex-wrap items-center gap-1.5 text-base font-normal text-zinc-500">
                    {format(new Date(`${demanda.prazo}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                    <StatusBadge status={demanda.status} />
                    {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy || manterId === null}
              onClick={confirmMesclar}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:opacity-60"
            >
              {busy ? "Mesclando..." : "Confirmar mesclagem"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingMerge(false)}
              className="rounded-lg px-3 py-2 text-lg text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-xl font-medium text-red-900">
            Excluir {selected.size}{" "}
            {selected.size === 1 ? "demanda" : "demandas"}? Essa ação não pode
            ser desfeita.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={confirmExcluir}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-red-700 px-4 text-lg font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60"
            >
              <Trash2 size={16} aria-hidden="true" />
              {busy ? "Excluindo..." : "Confirmar exclusão"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-3 py-2 text-lg text-zinc-600 transition-colors hover:text-zinc-900"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          className={`rounded-2xl px-5 py-3 text-lg ring-1 ${
            message.ok
              ? "bg-green-50 text-green-800 ring-green-200/60"
              : "bg-red-50 text-red-800 ring-red-200/60"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-stretch">
        {COLUMNS.map((column) => {
          const items = byStatus[column.status];
          const total = localDemandas.length;
          const collapsed = collapsedSet.has(column.status);

          if (collapsed) {
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
                className={`flex w-full flex-col items-center rounded-2xl p-2 transition-all duration-200 lg:w-20 ${column.bgClassName} ${draggedId !== null ? "ring-2 ring-[#2195B9]" : "ring-1 ring-zinc-200/60"}`}
              >
                <button
                  type="button"
                  onClick={() => toggleCollapsed(column.status)}
                  aria-expanded={false}
                  title={`Expandir coluna ${column.label}`}
                  className="flex w-full flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                >
                  <span
                    className={`h-3 w-3 rounded-full ${column.dotClassName}`}
                    aria-hidden="true"
                  />
                  <span className="text-center text-base font-semibold leading-tight text-zinc-900">
                    {column.label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-base font-medium text-zinc-600 ring-1 ring-zinc-200/60">
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
              className={`flex w-full min-w-0 flex-col rounded-2xl p-3 transition-all duration-200 lg:flex-1 ${column.bgClassName} ${
                draggedId !== null ? "ring-2 ring-[#2195B9]" : "ring-1 ring-zinc-200/60"
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
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-base font-medium text-zinc-600 ring-1 ring-zinc-200/60">
                    {items.length}/{total}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(column.status)}
                    aria-expanded={true}
                    aria-label={`Recolher coluna ${column.label}`}
                    title={`Recolher coluna ${column.label}`}
                    className="hidden h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-all duration-200 hover:bg-white/80 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] lg:flex"
                  >
                    <ChevronDown size={20} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-zinc-300 p-4 text-center text-base text-zinc-400">
                  Nenhuma demanda aqui
                </p>
              ) : (
                <ul className="flex flex-col gap-2 lg:min-h-[calc(100dvh-13rem)]">
                  {items.map((demanda) => (
                    <KanbanCard
                      key={demanda.id}
                      demanda={demanda}
                      onMove={moveDemanda}
                      pending={pending}
                      selectionMode={selectionMode}
                      selected={selectionMode ? selected.has(demanda.id) : false}
                      onToggle={toggleSelected}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        <Link
          href="/demandas/nova"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-xl font-medium text-zinc-700 ring-1 ring-zinc-200/60 transition-all duration-200 hover:bg-white hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] lg:hidden"
        >
          <PlusCircle size={22} aria-hidden="true" />
          Nova demanda
        </Link>
      </div>
    </div>
  );
}

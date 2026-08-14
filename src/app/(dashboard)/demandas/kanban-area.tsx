"use client";

// Kanban area — the dashboard kanban container. Owns the bulk-management
// toolbar that the board itself stays independent of: the "Selecionar"
// button sits on the same row as the grouping filter (DemandaAgruparFilter,
// passed in as agruparFilter) instead of a separate row above the columns.
// When selection mode is active the toolbar swaps to count + "Selecionar
// todas" + "Mesclar" (≥2 selecionadas — the user picks which demanda stays,
// the rest are absorbed by mesclarDemandas) + "Excluir" (excluirDemandas) +
// "Cancelar"; both destructive actions require an explicit confirmation
// panel. Selection spans every board below (grouped sections included).
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckSquare, ChevronDown, Square, Trash2, X } from "lucide-react";
import KanbanBoard, { type KanbanDemanda } from "./kanban-board";
import StatusBadge from "./status-badge";
import OverdueBadge from "./overdue-badge";
import { excluirDemandas, mesclarDemandas } from "./actions";
import { groupDemandas } from "./demanda-groups";

export type KanbanAreaProps = {
  demandas: KanbanDemanda[];
  // Role gate for the "Selecionar" button (coordenador_geral or
  // coordenador_area), same shape as DemandaList's canExcluir. RLS and the
  // merge function still govern every destructive write server-side.
  canGerir?: boolean;
  agrupar?: "area" | "projeto" | "responsavel" | null;
  // Rendered to the left of the "Selecionar" button on the same row —
  // the grouping filter on the dashboard; nothing on the evento page.
  agruparFilter?: React.ReactNode;
};

export default function KanbanArea({
  demandas,
  canGerir = false,
  agrupar = null,
  agruparFilter = null,
}: KanbanAreaProps) {
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmingMerge, setConfirmingMerge] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [manterId, setManterId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedSorted = useMemo(
    () =>
      [...selected]
        .map((id) => demandas.find((d) => d.id === id))
        .filter((d): d is KanbanDemanda => Boolean(d))
        .sort((a, b) => a.id - b.id),
    [selected, demandas]
  );

  const allSelected =
    demandas.length > 0 && selected.size === demandas.length;

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
      allSelected ? new Set() : new Set(demandas.map((d) => d.id))
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

  const grouped = agrupar ? groupDemandas(demandas, agrupar) : null;

  const selectionProps = {
    selectionMode,
    selectedIds: selected,
    onToggle: toggleSelected,
  };

  return (
    <div className="flex w-full flex-col gap-4">
      {(agruparFilter || canGerir || selectionMode) && (
        <div className="flex flex-wrap items-center gap-2">
          {agruparFilter}

          {canGerir && demandas.length > 0 && !selectionMode && (
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

      {grouped ? (
        <div className="flex w-full flex-col gap-8">
          {grouped.map((group) => (
            <div key={group.label} className="flex w-full flex-col gap-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold text-zinc-900">
                  {group.label}
                </h3>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-600">
                  {group.items.length === 1
                    ? "1 demanda"
                    : `${group.items.length} demandas`}
                </span>
              </div>
              <KanbanBoard
                key={`grupo-${group.label}`}
                demandas={group.items}
                {...selectionProps}
              />
            </div>
          ))}
        </div>
      ) : (
        <KanbanBoard demandas={demandas} {...selectionProps} />
      )}
    </div>
  );
}

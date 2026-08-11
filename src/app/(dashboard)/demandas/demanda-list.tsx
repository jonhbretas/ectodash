"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  FilterX,
  ClipboardList,
  CheckSquare,
  Square,
  Trash2,
  X,
} from "lucide-react";
import DemandaCard from "./demanda-card";
import DemandaTable from "./demanda-table";
import {
  DemandaStatusFilter,
  DemandaAgruparFilter,
} from "./demanda-quick-filters";
import { excluirDemandas } from "./actions";
import {
  groupDemandas,
  compareDemandas,
  type DemandaGroupable,
} from "./demanda-groups";
import type { DemandaFilters } from "./demanda-filter-schema";

// The breakpoint-switching container: cards below lg (including tablet),
// table at lg and above — a single CSS-only lg: breakpoint switch, per
// 04-UI-SPEC.md's Responsive Behavior Summary. No JavaScript-based screen-
// width detection (React lifecycle hooks, a browser resize listener, or a
// media-query hook) is used to decide which variant renders.
export type Demanda = DemandaGroupable;

export type DemandaListProps = {
  demandas: Demanda[];
  // currentFilters: the same parsed searchParams page.tsx passes to
  // DemandaFilters — needed here so the inline status/grouping controls
  // (DemandaStatusFilter / DemandaAgruparFilter) can read the current URL
  // state and navigate with the same router.push pattern.
  currentFilters: DemandaFilters;
  // groupBy: when set, the list splits into labeled sections instead of one
  // flat sorted list (05-UI-SPEC.md Screen Inventory 1a). compareDemandas is
  // applied WITHIN each group independently, never globally when grouping
  // is active.
  groupBy?: "area" | "responsavel";
  // filtersActive: whether ≥1 of área/responsável is currently set, passed
  // down from page.tsx — used to pick which empty state to render when the
  // list is empty. This is a STRUCTURAL distinction, not just a copy choice
  // (05-UI-SPEC.md Screen Inventory 2): the filtered-to-zero-results state
  // only renders when a filter narrowed an otherwise non-empty role-scoped
  // dataset down to nothing, never when the role-scoped dataset was already
  // empty to begin with.
  filtersActive?: boolean;
  // canExcluir: role gate for the bulk-selection toolbar (coordenador_geral
  // or coordenador_area). RLS still governs each delete server-side.
  canExcluir?: boolean;
};

export default function DemandaList({
  demandas,
  currentFilters,
  groupBy,
  filtersActive = false,
  canExcluir = false,
}: DemandaListProps) {
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const sorted = [...demandas].sort(compareDemandas);
  const count = demandas.length;
  const countLabel = count === 1 ? "1 demanda" : `${count} demandas`;
  const grouped = groupBy ? groupDemandas(demandas, groupBy) : null;

  const lastToggledRef = useRef<number | null>(null);

  const allSelected =
    demandas.length > 0 && selected.size === demandas.length;
  const toggleSelected = (id: number, shiftKey?: boolean) => {
    if (shiftKey && lastToggledRef.current !== null) {
      const lastId = lastToggledRef.current;
      const ids = sorted.map((d) => d.id);
      const lastIdx = ids.indexOf(lastId);
      const curIdx = ids.indexOf(id);
      if (lastIdx !== -1 && curIdx !== -1) {
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        const rangeIds = ids.slice(start, end + 1);
        setSelected((prev) => {
          const next = new Set(prev);
          const shouldAdd = !rangeIds.every((rid) => next.has(rid));
          for (const rid of rangeIds) {
            if (shouldAdd) next.add(rid);
            else next.delete(rid);
          }
          return next;
        });
        lastToggledRef.current = id;
        return;
      }
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastToggledRef.current = id;
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(demandas.map((d) => d.id)));
  };

  const enterSelection = () => {
    setSelectionMode(true);
    setMessage(null);
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelected(new Set());
    setConfirming(false);
    setMessage(null);
    lastToggledRef.current = null;
  };

  const confirmExcluir = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const result = await excluirDemandas([...selected]);
    setDeleting(false);
    if (result.ok) {
      exitSelection();
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.message });
      setConfirming(false);
    }
  };

  const selectionProps = {
    selectionActive: selectionMode,
    selectedIds: selected,
    onToggle: toggleSelected,
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-semibold text-zinc-900">Demandas</h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-600">
          {countLabel}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DemandaStatusFilter currentFilters={currentFilters} />
          <DemandaAgruparFilter currentFilters={currentFilters} />

          {canExcluir && demandas.length > 0 && !selectionMode && (
            <button
              type="button"
              onClick={enterSelection}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
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
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
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
      </div>

      {confirming && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-xl font-medium text-red-900">
            Excluir {selected.size}{" "}
            {selected.size === 1 ? "demanda" : "demandas"}? Essa ação não pode
            ser desfeita.
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={confirmExcluir}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-red-700 px-4 text-lg font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60"
            >
              <Trash2 size={16} aria-hidden="true" />
              {deleting ? "Excluindo..." : "Confirmar exclusão"}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirming(false)}
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

      {count === 0 && filtersActive ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <FilterX size={48} className="text-zinc-300" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma demanda encontrada com esses filtros
          </h2>
          <p className="max-w-md text-xl text-zinc-500">
            Tente escolher outra área, projeto ou responsável, ou toque em
            &quot;Limpar filtros&quot; para ver todas as demandas.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Limpar filtros
          </Link>
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <ClipboardList size={48} className="text-zinc-300" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma demanda cadastrada ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-500">
            Quando alguém criar uma demanda, ela vai aparecer aqui. Toque em
            &quot;Nova demanda&quot; para começar.
          </p>
          <Link
            href="/demandas/nova"
            className="flex min-h-14 items-center justify-center rounded-xl bg-[#2195B9] px-5 text-xl font-medium text-white transition-all duration-200 hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Nova demanda
          </Link>
        </div>
      ) : grouped ? (
        <div className="flex flex-col gap-8">
          {grouped.map((group) => {
            const groupCountLabel =
              group.items.length === 1
                ? "1 demanda"
                : `${group.items.length} demandas`;
            return (
              <div key={group.label} className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold text-zinc-900">
                    {group.label}
                  </h3>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-600">
                    {groupCountLabel}
                  </span>
                </div>
                <ul className="flex flex-col gap-3 lg:hidden">
                  {group.items.map((demanda) => (
                    <DemandaCard
                      key={demanda.id}
                      {...demanda}
                      {...selectionProps}
                    />
                  ))}
                </ul>
                <div className="hidden lg:block">
                  <DemandaTable
                    demandas={group.items}
                    {...selectionProps}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3 lg:hidden">
            {sorted.map((demanda) => (
              <DemandaCard key={demanda.id} {...demanda} {...selectionProps} />
            ))}
          </ul>
          <div className="hidden lg:block">
            <DemandaTable demandas={sorted} {...selectionProps} />
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { Users, UserRoundCheck, Pencil, ShieldCheck, CalendarClock, Settings2, X, CheckSquare, Square, Sparkles, CheckCircle2, Plus, Minus, MoonStar, UserX } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { roleLabel } from "@/lib/role-labels";
import { atualizarVoluntariosEmMassa, type BulkState } from "./actions";

type VoluntarioRow = {
  id: number;
  nome: string;
  codigo_pf: string | null;
  unidade: string | null;
  org_depto: string | null;
  funcao: string | null;
  data_inicio: string | null;
  data_saida: string | null;
  obs: string | null;
  area_atuacao: string | null;
  role: string | null;
  ativo: boolean;
  situacao: string | null;
  profiles: { email: string; role: string }[] | { email: string; role: string } | null;
};

const SEM_AREA_DEFINIDA = "Sem área definida";

// Árvore de áreas (registro institucional): uma área mãe com suas subáreas
// aninhadas e os voluntários de cada nível.
export type AreaNode = {
  nome: string;
  rows: VoluntarioRow[];
  subAreas: AreaNode[];
};

function linkedProfile(row: VoluntarioRow) {
  if (!row.profiles) return null;
  return Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
}

function formatData(iso: string | null): string | null {
  if (!iso) return null;
  return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

export default function VoluntariosListClient({
  areas,
  all,
  ativos,
  ociosos,
  afastados,
  vinculados,
  equipeDip,
  desligados,
  totalEctolab,
  totalDip,
  canManage,
  areaOptions,
}: {
  // Árvore de áreas (mãe → subáreas) já montada pelo servidor.
  areas: AreaNode[];
  all: VoluntarioRow[];
  ativos: number;
  ociosos: number;
  afastados: number;
  vinculados: number;
  // Voluntários da equipe DIP (org_depto com "DIP") — seção separada das
  // áreas institucionais, com contagem própria.
  equipeDip: VoluntarioRow[];
  // Desativados (ativo = false) — seção própria "Desligados" no fim.
  desligados: VoluntarioRow[];
  // Voluntários institucionais (ECTOLAB) vs equipe DIP — contagens
  // separadas ao lado do total geral.
  totalEctolab: number;
  totalDip: number;
  canManage: boolean;
  areaOptions: string[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // Todas as áreas começam recolhidas, exceto a primeira da árvore
  // (Desligados também começa recolhida).
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(() => {
    const nomes: string[] = [];
    function coletar(nos: AreaNode[]) {
      for (const no of nos) {
        nomes.push(no.nome);
        coletar(no.subAreas);
      }
    }
    coletar(areas);
    nomes.push("Desligados");
    return new Set(nomes.slice(1));
  });
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [bulkAcao, setBulkAcao] = useState<"desativar" | "ativar" | "migrar_area" | null>(null);
  const [bulkState, bulkAction] = useActionState<BulkState, FormData>(atualizarVoluntariosEmMassa, { ok: false, message: "", processados: 0 });

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllInArea(rows: VoluntarioRow[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = rows.every((r) => prev.has(r.id));
      for (const r of rows) {
        if (allSelected) next.delete(r.id); else next.add(r.id);
      }
      return next;
    });
  }

  function toggleCollapse(area: string) {
    setCollapsedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area); else next.add(area);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setShowBulkPanel(false);
    setBulkAcao(null);
  }

  const selectedIdsArr = [...selectedIds];

  // Todas as linhas de um nó (as próprias + as das subáreas) — usadas para
  // a contagem e a seleção em massa do nó inteiro.
  function rowsDoNo(no: AreaNode): VoluntarioRow[] {
    return [...no.rows, ...no.subAreas.flatMap(rowsDoNo)];
  }

  function renderNo(no: AreaNode, nivel: number) {
    const isCollapsed = collapsedAreas.has(no.nome);
    const branchRows = rowsDoNo(no);
    const allSelected = branchRows.length > 0 && branchRows.every((r) => selectedIds.has(r.id));
    const someSelected = branchRows.some((r) => selectedIds.has(r.id));
    const isSemArea = no.nome === SEM_AREA_DEFINIDA;

    return (
      <section key={no.nome} className={`flex w-full flex-col gap-3 ${nivel > 0 ? "ml-4 border-l-2 border-zinc-100 pl-4" : ""}`}>
        <button
          type="button"
          onClick={() => toggleCollapse(no.nome)}
          className="flex w-full items-center gap-3 text-left"
        >
          <span
            className={`rounded-full ${isCollapsed ? "bg-zinc-200 text-zinc-600" : "bg-blue-100 text-blue-700"}`}
            aria-hidden="true"
          >
            {isCollapsed ? <Plus size={20} className="m-1" /> : <Minus size={20} className="m-1" />}
          </span>
          <h2 className={`flex-1 ${nivel > 0 ? "text-xl sm:text-2xl" : "text-2xl font-semibold sm:text-3xl"} ${isSemArea ? "font-semibold text-zinc-500" : "font-semibold text-zinc-900"}`}>
            {no.nome}
          </h2>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
            {branchRows.length} {branchRows.length === 1 ? "voluntário" : "voluntários"}
          </span>
          {canManage && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); selectAllInArea(branchRows); }}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
            >
              {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
              {allSelected ? "Todos" : someSelected ? `${branchRows.filter((r) => selectedIds.has(r.id)).length}` : "Selecionar"}
            </button>
          )}
        </button>

        {!isCollapsed && (
          <>
            {no.rows.length > 0 && (
              <div className="flex w-full flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
                {no.rows.map((row, index) => (
                  <VoluntarioCard
                    key={row.id}
                    row={row}
                    isLast={index === no.rows.length - 1}
                    isSelected={selectedIds.has(row.id)}
                    onToggleSelect={() => toggleSelect(row.id)}
                    showCheckbox={canManage}
                  />
                ))}
              </div>
            )}
            {no.subAreas.map((sub) => renderNo(sub, nivel + 1))}
          </>
        )}
      </section>
    );
  }

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-8">
        <StatPill icon={<Users size={22} className="text-zinc-500" />} label="Total geral" value={all.length} />
        <StatPill icon={<ShieldCheck size={22} className="text-blue-600" />} label="Voluntários ECTOLAB" value={totalEctolab} />
        <StatPill icon={<Sparkles size={22} className="text-purple-600" />} label="Voluntários DIP" value={totalDip} />
        <StatPill icon={<CheckCircle2 size={22} className="text-green-500" />} label="Ativos" value={ativos} />
        <StatPill icon={<MoonStar size={22} className="text-amber-500" />} label="Ociosos" value={ociosos} />
        <StatPill icon={<CalendarClock size={22} className="text-amber-500" />} label="Com saída marcada" value={afastados} />
        <StatPill icon={<UserRoundCheck size={22} className="text-blue-500" />} label="Vinculados" value={vinculados} />
        <StatPill icon={<UserX size={22} className="text-red-500" />} label="Desligados" value={desligados.length} />
      </div>

      {selectedIdsArr.length > 0 && (
        <div className="sticky top-2 z-30 flex w-full flex-col gap-3 rounded-2xl bg-blue-50 p-4 shadow-[0_4px_12px_rgba(37,99,235,0.15)] ring-1 ring-blue-200/60">
          <div className="flex w-full flex-wrap items-center gap-3">
            <span className="text-lg font-medium text-blue-900">
              {selectedIdsArr.length} {selectedIdsArr.length === 1 ? "selecionado" : "selecionados"}
            </span>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-full bg-white px-3 py-1 text-base font-medium text-zinc-700 ring-1 ring-zinc-200/60 transition-colors hover:bg-zinc-100"
            >
              Limpar seleção
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => { setShowBulkPanel(true); setBulkAcao(null); }}
                  className="flex items-center gap-2 rounded-full bg-blue-700 px-4 py-2 text-base font-medium text-white transition-colors hover:bg-blue-600"
                >
                  <Settings2 size={18} />
                  Ações em massa
                </button>
              </>
            )}
          </div>

          {showBulkPanel && (
            <div className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-zinc-900">Ações em massa</h3>
                <button type="button" onClick={() => setShowBulkPanel(false)} className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-zinc-100">
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBulkAcao("ativar")}
                  className={`rounded-xl px-4 py-2 text-lg font-medium transition-colors ${bulkAcao === "ativar" ? "bg-green-700 text-white" : "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50"}`}
                >
                  Ativar
                </button>
                <button
                  type="button"
                  onClick={() => setBulkAcao("desativar")}
                  className={`rounded-xl px-4 py-2 text-lg font-medium transition-colors ${bulkAcao === "desativar" ? "bg-red-700 text-white" : "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50"}`}
                >
                  Desativar
                </button>
                <button
                  type="button"
                  onClick={() => setBulkAcao("migrar_area")}
                  className={`rounded-xl px-4 py-2 text-lg font-medium transition-colors ${bulkAcao === "migrar_area" ? "bg-blue-700 text-white" : "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50"}`}
                >
                  Migrar de área
                </button>
              </div>

              {bulkAcao && (
                <form action={bulkAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="ids" value={selectedIdsArr.join(",")} />
                  <input type="hidden" name="acao" value={bulkAcao} />

                  {bulkAcao === "migrar_area" && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="nova_area_bulk" className="text-lg font-medium text-zinc-900">Nova área</label>
                      <input
                        id="nova_area_bulk"
                        name="nova_area"
                        required
                        list="areas-bulk"
                        placeholder="Digite a nova área"
                        className="min-h-12 min-w-[220px] rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                      />
                      <datalist id="areas-bulk">
                        {areaOptions.map((a) => <option key={a} value={a} />)}
                      </datalist>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="flex min-h-12 items-center gap-2 rounded-xl bg-blue-700 px-5 text-lg font-medium text-white transition-colors hover:bg-blue-600"
                  >
                    Confirmar
                  </button>

                  {bulkState.message && (
                    <p className={`text-base ${bulkState.ok ? "text-green-800" : "text-red-700"}`}>
                      {bulkState.message}
                    </p>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex w-full flex-col gap-6">
        {equipeDip.length > 0 && renderNo({ nome: "Equipe DIP", rows: equipeDip, subAreas: [] }, 0)}
        {areas.map((no) => renderNo(no, 0))}
        {desligados.length > 0 &&
          renderNo({ nome: "Desligados", rows: desligados, subAreas: [] }, 0)}
      </div>
    </>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      {icon}
      <div className="flex flex-col">
        <span className="text-base font-medium text-zinc-500">{label}</span>
        <span className="text-2xl font-semibold text-zinc-900">{value}</span>
      </div>
    </div>
  );
}

function VoluntarioCard({
  row, isLast, isSelected, onToggleSelect, showCheckbox,
}: {
  row: VoluntarioRow; isLast: boolean; isSelected: boolean; onToggleSelect: () => void; showCheckbox: boolean;
}) {
  const linked = linkedProfile(row);
  const afastado = Boolean(row.data_saida);
  const effectiveRole = linked?.role ?? row.role ?? "voluntario_comum";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 ${isLast ? "" : "border-b border-zinc-100"}`}>
      {showCheckbox && (
        <button
          type="button"
          onClick={onToggleSelect}
          className="shrink-0 rounded p-0.5 transition-colors hover:bg-zinc-100"
          aria-label={isSelected ? "Desmarcar" : "Selecionar"}
        >
          {isSelected ? <CheckSquare size={22} className="text-blue-700" /> : <Square size={22} className="text-zinc-400" />}
        </button>
      )}

      <Link
        href={`/voluntarios/${row.id}`}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className={`truncate text-xl font-medium ${row.ativo ? "text-zinc-900" : "text-zinc-500 line-through"}`}>
            {row.nome}
          </span>
          {linked && (
            <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-base font-medium text-blue-800 ring-1 ring-blue-200/60">
              <UserRoundCheck size={14} aria-hidden="true" />
              Vinculado
            </span>
          )}
          {row.situacao === "ocioso" && (
            <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
              <MoonStar size={14} aria-hidden="true" />
              Ocioso
            </span>
          )}
          {afastado && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
              Saída: {formatData(row.data_saida)}
            </span>
          )}
        </span>
        <span className="truncate text-base text-zinc-600">
          {[row.codigo_pf ? `Cód. PF ${row.codigo_pf}` : null, row.unidade, row.funcao, linked?.email ?? null]
            .filter(Boolean).join(" · ")}
        </span>
        <span className="truncate text-base text-zinc-500">
          {row.org_depto ?? "—"} · Desde {formatData(row.data_inicio) ?? "—"}
        </span>
      </Link>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-800 ring-1 ring-zinc-200/60">
          {roleLabel(effectiveRole)}
        </span>
        <Link
          href={`/voluntarios/${row.id}/editar`}
          className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Pencil size={16} aria-hidden="true" />
          Editar
        </Link>
      </div>
    </div>
  );
}

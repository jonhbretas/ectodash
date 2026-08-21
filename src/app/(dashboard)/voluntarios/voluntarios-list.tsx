"use client";

import { useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users, UserRoundCheck, Pencil, CalendarClock, Settings2, X,
  CheckSquare, Square, CheckCircle2, Plus, Minus, MoonStar, UserX,
  Phone, Loader2, Layers, List,
} from "lucide-react";
import { useFormStatus } from "react-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { roleLabel } from "@/lib/role-labels";
import { exibirUnidade } from "@/lib/unidade-label";
import { atualizarVoluntariosEmMassa, type BulkState } from "./actions";
import VoluntarioTable, { type VoluntarioTableRow } from "./voluntario-table";

type VoluntarioRow = VoluntarioTableRow;

const SEM_AREA_DEFINIDA = "Sem área definida";

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

function phoneToDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function formatPhoneDisplay(phone: string): string {
  const digits = phoneToDigits(phone);
  if (digits.length <= 2) return phone;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

export default function VoluntariosListClient({
  areas,
  all,
  ativos,
  ociosos,
  afastados,
  vinculados,
  desligados,
  canManage,
  areaOptions,
}: {
  areas: AreaNode[];
  all: VoluntarioRow[];
  ativos: number;
  ociosos: number;
  afastados: number;
  vinculados: number;
  desligados: VoluntarioRow[];
  canManage: boolean;
  areaOptions: string[];
}) {
  const unidadeOptions = [
    ...new Set(
      all
        .map((v) => v.unidade)
        .filter((u): u is string => Boolean(u && u.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [groupByArea, setGroupByArea] = useState(false);
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
  const [bulkAcao, setBulkAcao] = useState<"desativar" | "ativar" | "migrar_area" | "migrar_unidade" | "migrar_epicom" | "migrar_telefone" | null>(null);
  const [bulkState, bulkAction] = useActionState<BulkState, FormData>(atualizarVoluntariosEmMassa, { ok: false, message: "", processados: 0 });
  const router = useRouter();

  useEffect(() => {
    if (bulkState.processados > 0) {
      router.refresh();
      clearSelection();
    }
  }, [bulkState.processados, router]);

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
    setSelectionMode(false);
    setShowBulkPanel(false);
    setBulkAcao(null);
  }

  const selectedIdsArr = [...selectedIds];

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
        <div className="flex w-full flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => toggleCollapse(no.nome)}
            aria-expanded={!isCollapsed}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span
              className={`shrink-0 rounded-full ${isCollapsed ? "bg-zinc-200 text-zinc-600" : "bg-[#E6E6E6] text-[#2195B9]"}`}
              aria-hidden="true"
            >
              {isCollapsed ? <Plus size={20} className="m-1" /> : <Minus size={20} className="m-1" />}
            </span>
            <h2 className={`min-w-0 flex-1 ${nivel > 0 ? "text-xl sm:text-2xl" : "text-2xl font-semibold sm:text-3xl"} ${isSemArea ? "font-semibold text-zinc-500" : "font-semibold text-zinc-900"}`}>
              {no.nome}
            </h2>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-[#E6E6E6] px-3 py-1 text-base font-medium text-[#28627B]">
              {branchRows.length} {branchRows.length === 1 ? "voluntário" : "voluntários"}
            </span>
          </button>
          {canManage && (
            <button
              type="button"
              onClick={() => selectAllInArea(branchRows)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-100 px-3 py-1.5 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-200"
            >
              {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
              <span className="hidden sm:inline">{allSelected ? "Todos" : someSelected ? `${branchRows.filter((r) => selectedIds.has(r.id)).length}` : "Selecionar"}</span>
            </button>
          )}
        </div>

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
                  showCheckbox={selectionMode && canManage}
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

  const sorted = [...all].sort((a, b) => a.nome.localeCompare(b.nome));
  const allAtivos = [...sorted.filter((r) => r.ativo), ...desligados];

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatPill icon={<Users size={22} className="text-zinc-500" />} label="Total geral" value={all.length} />
        <StatPill icon={<CheckCircle2 size={22} className="text-green-500" />} label="Ativos" value={ativos} />
        <StatPill icon={<MoonStar size={22} className="text-amber-500" />} label="Ociosos" value={ociosos} />
        <StatPill icon={<CalendarClock size={22} className="text-amber-500" />} label="Com saída marcada" value={afastados} />
        <StatPill icon={<UserRoundCheck size={22} className="text-[#2195B9]" />} label="Vinculados" value={vinculados} />
        <StatPill icon={<UserX size={22} className="text-red-500" />} label="Desligados" value={desligados.length} />
      </div>

      {selectionMode && (
        <div className="z-30 flex w-full flex-col gap-3 rounded-2xl bg-[#E6E6E6] p-4 shadow-[0_4px_12px_rgba(33,149,185,0.15)] ring-1 ring-[#E6E6E6]/60 sm:sticky sm:top-2">
          <div className="flex w-full flex-wrap items-center gap-3">
            <span className="text-lg font-medium text-[#28627B]">
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
                  className="flex items-center gap-2 rounded-full bg-[#2195B9] px-4 py-2 text-base font-medium text-white transition-colors hover:bg-[#28627B]"
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
                <button type="button" onClick={() => setBulkAcao("ativar")} className={`rounded-xl px-4 py-2 text-lg font-medium transition-colors ${bulkAcao === "ativar" ? "bg-green-700 text-white" : "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50"}`}>
                  Ativar
                </button>
                <button type="button" onClick={() => setBulkAcao("desativar")} className={`rounded-xl px-4 py-2 text-lg font-medium transition-colors ${bulkAcao === "desativar" ? "bg-red-700 text-white" : "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50"}`}>
                  Desativar
                </button>
                <button type="button" onClick={() => setBulkAcao("migrar_area")} className={`rounded-xl px-4 py-2 text-lg font-medium transition-colors ${bulkAcao === "migrar_area" ? "bg-[#2195B9] text-white" : "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50"}`}>
                  Migrar de área
                </button>
                <button type="button" onClick={() => setBulkAcao("migrar_unidade")} className={`rounded-xl px-4 py-2 text-lg font-medium transition-colors ${bulkAcao === "migrar_unidade" ? "bg-[#2195B9] text-white" : "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50"}`}>
                  Alterar unidade
                </button>
                <button type="button" onClick={() => setBulkAcao("migrar_epicom")} className={`rounded-xl px-4 py-2 text-lg font-medium transition-colors ${bulkAcao === "migrar_epicom" ? "bg-purple-700 text-white" : "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50"}`}>
                   Definir Epicon
                </button>
                <button type="button" onClick={() => setBulkAcao("migrar_telefone")} className={`rounded-xl px-4 py-2 text-lg font-medium transition-colors ${bulkAcao === "migrar_telefone" ? "bg-[#2195B9] text-white" : "bg-white border border-zinc-300 text-zinc-900 hover:bg-zinc-50"}`}>
                  Alterar telefone
                </button>
              </div>

              {bulkAcao && (
                <form action={bulkAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="ids" value={selectedIdsArr.join(",")} />
                  <input type="hidden" name="acao" value={bulkAcao} />

                  {bulkAcao === "migrar_area" && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="nova_area_bulk" className="text-lg font-medium text-zinc-900">Nova área</label>
                      <input id="nova_area_bulk" name="nova_area" required list="areas-bulk" placeholder="Digite a nova área" className="min-h-12 min-w-[220px] rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]" />
                      <datalist id="areas-bulk">
                        {areaOptions.map((a) => <option key={a} value={a} />)}
                      </datalist>
                    </div>
                  )}

                  {bulkAcao === "migrar_unidade" && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="nova_unidade_bulk" className="text-lg font-medium text-zinc-900">Nova unidade/localidade</label>
                      <input id="nova_unidade_bulk" name="nova_unidade" required list="unidades-bulk" placeholder="Digite a nova unidade" className="min-h-12 min-w-[220px] rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]" />
                      <datalist id="unidades-bulk">
                        {unidadeOptions.map((u) => <option key={u} value={u} />)}
                      </datalist>
                    </div>
                  )}

                  {bulkAcao === "migrar_epicom" && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="novo_epicom_bulk" className="text-lg font-medium text-zinc-900">Epicon</label>
                      <select id="novo_epicom_bulk" name="novo_epicom" required className="min-h-12 min-w-[220px] rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]">
                        <option value="true">Sim — pode ocupar função Epicon</option>
                        <option value="false">Não — voluntário comum</option>
                      </select>
                    </div>
                  )}

                  {bulkAcao === "migrar_telefone" && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="novo_telefone_bulk" className="text-lg font-medium text-zinc-900">Novo telefone</label>
                      <input id="novo_telefone_bulk" name="novo_telefone" required type="tel" placeholder="(00) 00000-0000" className="min-h-12 min-w-[220px] rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]" />
                    </div>
                  )}

                  <PendingButton className="flex min-h-12 items-center gap-2 rounded-xl bg-[#2195B9] px-5 text-lg font-medium text-white transition-colors hover:bg-[#28627B]">
                    Confirmar
                  </PendingButton>

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

      {/* Toolbar: toggle between table and grouped view + selection mode */}
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={() => setGroupByArea(false)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-base font-medium transition-colors ${
            !groupByArea
              ? "bg-[#2195B9] text-white"
              : "bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <List size={18} />
          <span className="hidden sm:inline">Lista</span>
        </button>
        <button
          type="button"
          onClick={() => setGroupByArea(true)}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-base font-medium transition-colors ${
            groupByArea
              ? "bg-[#2195B9] text-white"
              : "bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <Layers size={18} />
          <span className="hidden sm:inline">Por área</span>
        </button>
        {canManage && !selectionMode && (
          <button
            type="button"
            onClick={() => { setSelectionMode(true); setSelectedIds(new Set()); }}
            className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <CheckSquare size={18} />
            <span className="hidden sm:inline">Selecionar</span>
          </button>
        )}
        <span className="ml-2 text-base text-zinc-500">
          {all.length} {all.length === 1 ? "voluntário" : "voluntários"}
        </span>
      </div>

      {groupByArea ? (
        <div className="flex w-full flex-col gap-6">
          {areas.map((no) => renderNo(no, 0))}
          {desligados.length > 0 &&
            renderNo({ nome: "Desligados", rows: desligados, subAreas: [] }, 0)}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex w-full flex-col gap-3 lg:hidden">
            {allAtivos.map((row, index) => (
              <div key={row.id} className="flex w-full flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
                <VoluntarioCard
                  row={row}
                  isLast={true}
                  isSelected={selectedIds.has(row.id)}
                  onToggleSelect={() => toggleSelect(row.id)}
                  showCheckbox={canManage}
                />
              </div>
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden lg:block">
            <VoluntarioTable
              voluntarios={allAtivos}
              selectionActive={selectionMode}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />
          </div>
        </>
      )}
    </>
  );
}

function PendingButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${className ?? ""} ${pending ? "pointer-events-none opacity-70" : ""}`}
    >
      {pending ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Processando…
        </>
      ) : (
        children
      )}
    </button>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      {icon}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-base font-medium text-zinc-500">{label}</span>
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
    <div className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:py-4 ${isLast ? "" : "border-b border-zinc-100"}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {showCheckbox && (
          <button
            type="button"
            onClick={onToggleSelect}
            className="mt-0.5 shrink-0 rounded p-0.5 transition-colors hover:bg-zinc-100"
            aria-label={isSelected ? "Desmarcar" : "Selecionar"}
          >
            {isSelected ? <CheckSquare size={22} className="text-[#2195B9]" /> : <Square size={22} className="text-zinc-400" />}
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg">
          <Link
            href={`/voluntarios/${row.id}`}
            className="flex flex-col gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className={`min-w-0 truncate text-xl font-medium ${row.ativo ? "text-zinc-900" : "text-zinc-500 line-through"}`}>
                {row.nome}
              </span>
              {linked && (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#E6E6E6] px-2.5 py-0.5 text-base font-medium text-[#28627B] ring-1 ring-[#E6E6E6]/60">
                  <UserRoundCheck size={14} aria-hidden="true" />
                  Vinculado
                </span>
              )}
              {row.situacao === "ocioso" && (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
                  <MoonStar size={14} aria-hidden="true" />
                  Ocioso
                </span>
              )}
              {afastado && (
                <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-800 ring-1 ring-amber-200/60">
                  Saída: {formatData(row.data_saida)}
                </span>
              )}
            </span>
            <span className="truncate text-base text-zinc-600">
              {[row.codigo_pf ? `Cód. PF ${row.codigo_pf}` : null, exibirUnidade(row.unidade), row.funcao, linked?.email ?? null]
                .filter(Boolean).join(" · ")}
            </span>
            <span className="truncate text-base text-zinc-500">
              {row.org_depto ?? "—"} · Desde {formatData(row.data_inicio) ?? "—"}
            </span>
          </Link>
          {(row.telefone1 || row.telefone2) && (
            <span className="flex flex-wrap items-center gap-2 text-base">
              {row.telefone1 && (
                <a
                  href={`https://wa.me/${phoneToDigits(row.telefone1).startsWith("55") ? phoneToDigits(row.telefone1) : "55" + phoneToDigits(row.telefone1)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 whitespace-nowrap text-[#2195B9] hover:text-[#28627B] hover:underline"
                >
                  <Phone size={14} aria-hidden="true" />
                  {formatPhoneDisplay(row.telefone1)}
                </a>
              )}
              {row.telefone2 && (
                <a
                  href={`https://wa.me/${phoneToDigits(row.telefone2).startsWith("55") ? phoneToDigits(row.telefone2) : "55" + phoneToDigits(row.telefone2)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 whitespace-nowrap text-[#2195B9] hover:text-[#28627B] hover:underline"
                >
                  <Phone size={14} aria-hidden="true" />
                  {formatPhoneDisplay(row.telefone2)}
                </a>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="shrink-0 whitespace-nowrap rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-800 ring-1 ring-zinc-200/60">
          {roleLabel(effectiveRole)}
        </span>
        <Link
          href={`/voluntarios/${row.id}/editar`}
          className="flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <Pencil size={16} aria-hidden="true" />
          Editar
        </Link>
      </div>
    </div>
  );
}

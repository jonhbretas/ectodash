"use client";

// Shared multi-select volunteer checklist — the searchable checkbox list
// used wherever several roster volunteers can be picked at once (responsáveis
// e membros de demanda, participantes de ata). Filters by name as you type
// and toggles each row with a checkbox, so many people can be selected in a
// single pass ("barra de busca... dando cheque"). Extracted from the demanda
// form's VoluntarioChecklist and the bulk editor's VoluntarioChecklistBulk so
// every multi-select picker shares one implementation — mirroring the goal of
// voluntario-picker.tsx for single-select.
import { useState } from "react";
import type { VoluntarioOpcao } from "./voluntario-picker";

export function VoluntarioChecklist({
  voluntarios,
  selectedIds,
  onToggle,
  emptyLabel = "Nenhum voluntário encontrado.",
  maxHeightClass = "max-h-44",
}: {
  voluntarios: VoluntarioOpcao[];
  selectedIds: string[] | Set<string>;
  onToggle: (id: string) => void;
  emptyLabel?: string;
  maxHeightClass?: string;
}) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? voluntarios.filter((v) => v.nome.toLowerCase().includes(termo))
    : voluntarios;

  const isSelected = (id: string) =>
    selectedIds instanceof Set ? selectedIds.has(id) : selectedIds.includes(id);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 p-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          aria-label="Buscar voluntário por nome"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-lg text-zinc-900 outline-none transition-colors hover:border-zinc-300 focus:ring-2 focus:ring-[#2195B9]"
        />
      </div>
      <div className={`${maxHeightClass} overflow-y-auto p-2`}>
        {filtrados.length === 0 ? (
          <p className="px-2 py-3 text-base text-zinc-400">{emptyLabel}</p>
        ) : (
          filtrados.map((voluntario) => {
            const id = String(voluntario.id);
            return (
              <label
                key={id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 py-1 text-xl text-zinc-900 transition-colors hover:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  checked={isSelected(id)}
                  onChange={() => onToggle(id)}
                  className="h-5 w-5 rounded border-zinc-300 accent-[#2195B9]"
                />
                <span className="truncate">
                  {voluntario.nome}
                  {voluntario.temConta === false && (
                    <span className="text-base text-zinc-400"> (sem acesso)</span>
                  )}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
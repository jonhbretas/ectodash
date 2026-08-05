"use client";

// Shared roster-volunteer picker — the searchable dropdown used wherever a
// list of roster volunteers can be extended (demanda responsáveis/membros,
// ata participantes). Opens below the trigger, filters by name as you type,
// Escape closes. Extracted from demanda-inline-editor's original
// PersonPicker so every picker shares one implementation.
import { useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";

export type VoluntarioOpcao = {
  id: string;
  nome: string;
  // false = cadastrado no roster, mas ainda sem conta ativada.
  temConta?: boolean;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export default function VoluntarioPicker({
  voluntarios,
  selectedIds,
  onAdd,
  label,
}: {
  voluntarios: VoluntarioOpcao[];
  selectedIds: Set<string>;
  onAdd: (id: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const buscaRef = useRef<HTMLInputElement>(null);
  const available = voluntarios.filter((v) => !selectedIds.has(v.id));

  useEffect(() => { if (open) buscaRef.current?.focus(); }, [open]);

  if (available.length === 0) return null;

  const filtrados = available.filter((v) =>
    v.nome.toLowerCase().includes(busca.trim().toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setBusca(""); }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        aria-label={`Adicionar ${label}`}
        title={`Adicionar ${label}`}
      >
        <UserPlus size={14} aria-hidden="true" />
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default border-0 bg-transparent"
            onClick={() => setOpen(false)}
            aria-label="Fechar seletor"
          />
          <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg">
            <input
              ref={buscaRef}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
              placeholder="Buscar nome..."
              className="mb-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="max-h-56 overflow-y-auto">
              {filtrados.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { onAdd(v.id); setOpen(false); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-base text-zinc-900 transition-colors hover:bg-zinc-100"
                >
                  <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                    {initialsOf(v.nome)}
                  </span>
                  <span className="truncate">{v.nome}</span>
                  {v.temConta === false && (
                    <span className="shrink-0 text-xs text-zinc-400">
                      sem acesso
                    </span>
                  )}
                </button>
              ))}
              {filtrados.length === 0 && (
                <p className="px-3 py-2 text-base text-zinc-400">
                  Nenhum voluntário encontrado.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

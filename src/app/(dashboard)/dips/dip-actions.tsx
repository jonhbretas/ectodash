"use client";

// Editar (inline) e excluir um registro DIP — visível apenas para o criador
// do registro ou um coordenador_geral (espelha a RLS da migration 0015).
import { useId, useState } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { atualizarDip, excluirDip } from "./actions";

type DipActionsProps = {
  dip: {
    id: number;
    ataId: number | null;
    localidade: string;
    pais: string;
    data: string | null;
    participantes: number | null;
    observacoes: string | null;
  };
  canManage: boolean;
  // Localidades cadastradas (dip_localidades) — sugeridas no campo
  // Localidade; escolher uma cadastrada preenche o país automaticamente.
  localidades?: { localidade: string; pais: string }[];
};

const inputClass =
  "min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

export default function DipActions({
  dip,
  canManage,
  localidades = [],
}: DipActionsProps) {
  const [editing, setEditing] = useState(false);
  const [localidade, setLocalidade] = useState(dip.localidade);
  const [pais, setPais] = useState(dip.pais);
  const [data, setData] = useState(dip.data ?? "");
  const [participantes, setParticipantes] = useState(
    dip.participantes === null ? "" : String(dip.participantes)
  );
  const [observacoes, setObservacoes] = useState(dip.observacoes ?? "");
  const [saving, setSaving] = useState(false);
  const localidadesListId = useId();

  if (!canManage) return null;

  function handleDelete() {
    if (
      !window.confirm(
        `Excluir este registro DIP (${dip.localidade}, ${dip.data ?? "data não informada"})?\n\nEsta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    const form = new FormData();
    form.set("id", String(dip.id));
    if (dip.ataId != null) form.set("ata_id", String(dip.ataId));
    excluirDip(form);
  }

  async function handleSave() {
    setSaving(true);
    const form = new FormData();
    form.set("id", String(dip.id));
    if (dip.ataId != null) form.set("ata_id", String(dip.ataId));
    form.set("localidade", localidade);
    form.set("pais", pais);
    form.set("data", data);
    form.set("participantes", participantes);
    form.set("observacoes", observacoes);
    await atualizarDip(form);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-lg border border-[#E6E6E6] bg-[#E6E6E6]/50 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            Localidade
            <input
              value={localidade}
              list={localidadesListId}
              onChange={(e) => {
                setLocalidade(e.target.value);
                const cadastrada = localidades.find(
                  (l) => l.localidade === e.target.value
                );
                if (cadastrada) setPais(cadastrada.pais);
              }}
              className={inputClass}
            />
            {localidades.length > 0 && (
              <datalist id={localidadesListId}>
                {localidades.map((l) => (
                  <option key={l.localidade} value={l.localidade} />
                ))}
              </datalist>
            )}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            País
            <input
              value={pais}
              onChange={(e) => setPais(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            Data
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
            Participantes
            <input
              type="number"
              min={0}
              value={participantes}
              onChange={(e) => setParticipantes(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700">
          Observações
          <textarea
            rows={2}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className={`${inputClass} min-h-16 resize-y py-2`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex min-h-11 items-center gap-1.5 rounded-lg bg-green-700 px-4 text-base font-medium text-white transition-colors hover:bg-green-800 disabled:opacity-60"
          >
            <Check size={16} aria-hidden="true" />
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-base font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={16} aria-hidden="true" />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Editar registro DIP"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-[#E6E6E6] hover:text-[#2195B9]"
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        aria-label="Excluir registro DIP"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

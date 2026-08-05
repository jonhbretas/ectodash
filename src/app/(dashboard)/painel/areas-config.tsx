"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PlusCircle, Pencil, Trash2, X, Check } from "lucide-react";
import { useState } from "react";
import { criarAreaInstitucional, editarAreaInstitucional, excluirAreaInstitucional, type AreaConfigState } from "./area-actions";

type AreaRow = {
  id: number;
  nome: string;
  area_mae_id: number | null;
};

const initial: AreaConfigState = { ok: false, message: "" };

function StatusLine({ state }: { state: AreaConfigState }) {
  if (!state.message) return null;
  return (
    <p className={`text-base ${state.ok ? "text-green-800" : "text-red-700"}`}>
      {state.message}
    </p>
  );
}

function SubmitButton({ label, className = "" }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Salvando..." : label}
    </button>
  );
}

export default function AreasConfig({ areas }: { areas: AreaRow[] }) {
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const parents = areas.filter((a) => !a.area_mae_id).sort((a, b) => a.nome.localeCompare(b.nome));
  const sorted = [...areas].sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <section className="flex w-full max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-[#2195B9]" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-zinc-900">Áreas institucionais</h2>
        <span className="rounded-full bg-[#E6E6E6] px-3 py-1 text-base font-medium text-[#28627B]">
          {areas.length} {areas.length === 1 ? "área" : "áreas"}
        </span>
      </div>

      <CriarAreaForm parentOptions={parents} />

      <div className="flex w-full flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
        {sorted.length === 0 ? (
          <p className="px-5 py-6 text-xl text-zinc-500 text-center">Nenhuma área cadastrada.</p>
        ) : (
          sorted.map((area, i) => {
            const parent = area.area_mae_id ? areas.find((a) => a.id === area.area_mae_id) : null;
            const isEditing = editandoId === area.id;

            return (
              <div
                key={area.id}
                className={`flex items-center justify-between gap-3 px-5 py-3 ${i === sorted.length - 1 ? "" : "border-b border-zinc-100"}`}
              >
                {isEditing ? (
                  <EditarAreaForm
                    area={area}
                    parentOptions={parents}
                    onCancel={() => setEditandoId(null)}
                    onSaved={() => setEditandoId(null)}
                  />
                ) : (
                  <>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-xl font-medium text-zinc-900">{area.nome}</span>
                      {parent && (
                        <span className="text-base text-zinc-500">Sub-área de: {parent.nome}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditandoId(area.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                        aria-label={`Editar ${area.nome}`}
                      >
                        <Pencil size={18} />
                      </button>
                      <ExcluirAreaButton areaId={area.id} areaNome={area.nome} />
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function CriarAreaForm({ parentOptions }: { parentOptions: AreaRow[] }) {
  const [state, formAction] = useActionState(criarAreaInstitucional, initial);
  const [show, setShow] = useState(false);

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex min-h-12 w-fit items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-2 text-lg font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900"
      >
        <PlusCircle size={20} />
        Nova área
      </button>
    );
  }

  const inputClass = "min-h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 transition-colors hover:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-medium text-zinc-900">Nova área institucional</span>
        <button type="button" onClick={() => setShow(false)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200">
          <X size={18} />
        </button>
      </div>
      <input name="nome" required placeholder="Nome da área" className={inputClass} />
      {parentOptions.length > 0 && (
        <select name="area_mae_id" className={inputClass}>
          <option value="">Área principal (sem subordinação)</option>
          {parentOptions.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      )}
      <div className="flex items-center gap-2">
        <SubmitButton
          label="Criar área"
          className="flex min-h-12 items-center gap-1.5 rounded-lg bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B]"
        />
        <button type="button" onClick={() => setShow(false)} className="rounded-lg px-3 py-2 text-lg text-zinc-600 transition-colors hover:text-zinc-900">Cancelar</button>
      </div>
      <StatusLine state={state} />
    </form>
  );
}

function EditarAreaForm({
  area,
  parentOptions,
  onCancel,
  onSaved,
}: {
  area: AreaRow;
  parentOptions: AreaRow[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState(editarAreaInstitucional, initial);
  const [saved, setSaved] = useState(false);

  if (state.ok && !saved) {
    setSaved(true);
    setTimeout(onSaved, 800);
  }

  const inputClass = "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

  return (
    <form action={formAction} className="flex w-full flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={area.id} />
      <input name="nome" required defaultValue={area.nome} className={`${inputClass} flex-1 min-w-[200px]`} />
      <select name="area_mae_id" defaultValue={area.area_mae_id ?? ""} className={`${inputClass} max-w-[220px]`}>
        <option value="">Área principal</option>
        {parentOptions.filter((p) => p.id !== area.id).map((p) => (
          <option key={p.id} value={p.id}>{p.nome}</option>
        ))}
      </select>
      <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-700 text-white transition-colors hover:bg-green-800" aria-label="Salvar">
        <Check size={18} />
      </button>
      <button type="button" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100" aria-label="Cancelar">
        <X size={18} />
      </button>
      <StatusLine state={state} />
    </form>
  );
}

function ExcluirAreaButton({ areaId, areaNome }: { areaId: number; areaNome: string }) {
  const [state, formAction] = useActionState(excluirAreaInstitucional, initial);

  return (
    <form action={formAction} className="flex items-center">
      <input type="hidden" name="id" value={areaId} />
      <button
        type="submit"
        aria-label={`Excluir ${areaNome}`}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={18} />
      </button>
      {state.message && <span className="ml-1 text-sm text-red-600">{state.message}</span>}
    </form>
  );
}

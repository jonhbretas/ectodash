"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PlusCircle, Pencil, Trash2, X, Check } from "lucide-react";
import { criarProjeto, editarProjeto, excluirProjeto, type ProjetoState } from "./projetos-actions";

type ProjetoRow = {
  id: number; nome: string; descricao: string | null; area: string | null;
  status: string; created_at: string;
};

const initial: ProjetoState = { ok: false, message: "" };
const inputClass = "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]";
const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
] as const;

function StatusLine({ state }: { state: ProjetoState }) {
  if (!state.message) return null;
  return <p className={`text-base ${state.ok ? "text-green-800" : "text-red-700"}`}>{state.message}</p>;
}

export default function ProjetosClient({
  projetos,
  areaOptions,
}: {
  projetos: ProjetoRow[];
  areaOptions: string[];
}) {
  const [editandoId, setEditandoId] = useState<number | null>(null);

  return (
    <div className="flex w-full flex-col gap-3">
      <CriarProjetoForm areaOptions={areaOptions} />

      <div className="flex w-full flex-col rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
        {projetos.length === 0 ? (
          <p className="px-5 py-6 text-xl text-zinc-500 text-center">
            Nenhum projeto cadastrado. Crie o primeiro acima.
          </p>
        ) : (
          projetos.map((proj, i) => {
            const isEditing = editandoId === proj.id;
            return (
              <div
                key={proj.id}
                className={`flex items-start justify-between gap-3 px-5 py-4 ${i === projetos.length - 1 ? "" : "border-b border-zinc-100"}`}
              >
                {isEditing ? (
                  <EditarProjetoForm
                    projeto={proj}
                    areaOptions={areaOptions}
                    onCancel={() => setEditandoId(null)}
                    onSaved={() => setEditandoId(null)}
                  />
                ) : (
                  <>
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl font-medium text-zinc-900">{proj.nome}</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-base font-medium ring-1 ${
                          proj.status === "ativo" ? "bg-green-50 text-green-800 ring-green-200/60" :
                          proj.status === "concluido" ? "bg-[#f5f0eb] text-[#8b5e2a] ring-[#f0e0cf]/60" :
                          "bg-zinc-100 text-zinc-600 ring-zinc-200/60"
                        }`}>
                          {STATUS_OPTIONS.find((s) => s.value === proj.status)?.label ?? proj.status}
                        </span>
                        {proj.area && (
                          <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-base font-medium text-purple-800 ring-1 ring-purple-200/60">
                            {proj.area}
                          </span>
                        )}
                      </div>
                      {proj.descricao && (
                        <p className="text-base leading-relaxed text-zinc-600 line-clamp-2">{proj.descricao}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditandoId(proj.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                        aria-label={`Editar ${proj.nome}`}
                      >
                        <Pencil size={18} />
                      </button>
                      <ExcluirProjetoButton projetoId={proj.id} />
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CriarProjetoForm({ areaOptions }: { areaOptions: string[] }) {
  const [state, formAction] = useActionState(criarProjeto, initial);
  const [show, setShow] = useState(false);

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex min-h-12 w-fit items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-2 text-lg font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900"
      >
        <PlusCircle size={20} />
        Novo projeto
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-medium text-zinc-900">Novo projeto</span>
        <button type="button" onClick={() => setShow(false)} className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200">
          <X size={18} />
        </button>
      </div>
      <input name="nome" required placeholder="Nome do projeto" className={inputClass} />
      <textarea name="descricao" rows={3} placeholder="Descrição (opcional)" className={`${inputClass} min-h-20 resize-y py-3`} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input name="area" list="areas-proj" placeholder="Área (opcional)" className={inputClass} />
        <datalist id="areas-proj">
          {areaOptions.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
        <select name="status" defaultValue="ativo" className={inputClass}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" className="flex min-h-12 items-center gap-1.5 rounded-lg bg-[#d4883a] px-4 text-lg font-medium text-white transition-colors hover:bg-[#c07828]">
          Criar projeto
        </button>
        <button type="button" onClick={() => setShow(false)} className="rounded-lg px-3 py-2 text-lg text-zinc-600 transition-colors hover:text-zinc-900">Cancelar</button>
      </div>
      <StatusLine state={state} />
    </form>
  );
}

function EditarProjetoForm({
  projeto, areaOptions, onCancel, onSaved,
}: {
  projeto: ProjetoRow; areaOptions: string[]; onCancel: () => void; onSaved: () => void;
}) {
  const [state, formAction] = useActionState(editarProjeto, initial);
  const [saved, setSaved] = useState(false);

  if (state.ok && !saved) {
    setSaved(true);
    setTimeout(onSaved, 800);
  }

  return (
    <form action={formAction} className="flex w-full flex-col gap-2">
      <input type="hidden" name="id" value={projeto.id} />
      <div className="flex flex-wrap items-center gap-2">
        <input name="nome" required defaultValue={projeto.nome} className={`${inputClass} flex-1 min-w-[200px]`} />
        <select name="status" defaultValue={projeto.status} className={`${inputClass} max-w-[160px]`}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-700 text-white transition-colors hover:bg-green-800" aria-label="Salvar">
          <Check size={18} />
        </button>
        <button type="button" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100" aria-label="Cancelar">
          <X size={18} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <textarea name="descricao" rows={2} defaultValue={projeto.descricao ?? ""} placeholder="Descrição" className={`${inputClass} min-h-16 resize-y py-2 flex-1`} />
        <input name="area" defaultValue={projeto.area ?? ""} list="areas-edit-proj" placeholder="Área" className={`${inputClass} max-w-[200px]`} />
        <datalist id="areas-edit-proj">
          {areaOptions.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </div>
      <StatusLine state={state} />
    </form>
  );
}

function ExcluirProjetoButton({ projetoId }: { projetoId: number }) {
  const [state, formAction] = useActionState(excluirProjeto, initial);
  return (
    <form action={formAction} className="flex items-center">
      <input type="hidden" name="id" value={projetoId} />
      <button
        type="submit"
        aria-label="Excluir projeto"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={18} />
      </button>
      {state.message && <span className="ml-1 text-sm text-red-600">{state.message}</span>}
    </form>
  );
}

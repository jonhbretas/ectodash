"use client";

// Cadastro das localidades da Dinâmica DIP (migration 0024) — listagem,
// criar, editar e remover, visível apenas para o coordenador_geral (o
// painel de administração fica na página /dips). Espelha o padrão do
// areas-config.tsx: useActionState por formulário, RLS como limite real.
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { PlusCircle, Pencil, Trash2, X, Check, MapPin } from "lucide-react";
import {
  criarLocalidadeDip,
  editarLocalidadeDip,
  excluirLocalidadeDip,
  type LocalidadeDipState,
} from "./localidades-actions";

type LocalidadeRow = {
  id: number;
  localidade: string;
  pais: string;
};

const initial: LocalidadeDipState = { ok: false, message: "" };

function StatusLine({ state }: { state: LocalidadeDipState }) {
  if (!state.message) return null;
  return (
    <p className={`text-base ${state.ok ? "text-green-800" : "text-red-700"}`}>
      {state.message}
    </p>
  );
}

function SubmitButton({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Salvando..." : label}
    </button>
  );
}

export default function LocalidadesConfig({
  localidades,
}: {
  localidades: LocalidadeRow[];
}) {
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const sorted = [...localidades].sort((a, b) =>
    `${a.pais}|${a.localidade}`.localeCompare(`${b.pais}|${b.localidade}`, "pt-BR")
  );

  return (
    <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <MapPin size={22} aria-hidden="true" className="text-amber-500" />
          Cadastro de localidades da DIP
        </h2>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-base font-medium text-zinc-600">
          {sorted.length} {sorted.length === 1 ? "localidade" : "localidades"}
        </span>
      </div>
      <p className="text-base text-zinc-500">
        Padroniza os nomes usados nos registros DIP. Os registros existentes
        não são alterados — a lista serve de referência ao cadastrar e editar.
      </p>

      <CriarLocalidadeForm />

      <div className="flex w-full flex-col rounded-xl border border-zinc-100">
        {sorted.length === 0 ? (
          <p className="px-5 py-6 text-center text-lg text-zinc-500">
            Nenhuma localidade cadastrada ainda.
          </p>
        ) : (
          sorted.map((localidade, i) => {
            const isEditing = editandoId === localidade.id;
            return (
              <div
                key={localidade.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  i === sorted.length - 1 ? "" : "border-b border-zinc-100"
                }`}
              >
                {isEditing ? (
                  <EditarLocalidadeForm
                    localidade={localidade}
                    onCancel={() => setEditandoId(null)}
                    onSaved={() => setEditandoId(null)}
                  />
                ) : (
                  <>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-lg font-medium text-zinc-900">
                        {localidade.localidade}
                      </span>
                      <span className="text-base text-zinc-500">
                        {localidade.pais}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditandoId(localidade.id)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                        aria-label={`Editar ${localidade.localidade}`}
                      >
                        <Pencil size={18} />
                      </button>
                      <ExcluirLocalidadeButton
                        localidadeId={localidade.id}
                        localidadeNome={localidade.localidade}
                      />
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

const inputClass =
  "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

function CriarLocalidadeForm() {
  const [state, formAction] = useActionState(criarLocalidadeDip, initial);
  const [show, setShow] = useState(false);

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="flex min-h-12 w-fit items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-2 text-lg font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-900"
      >
        <PlusCircle size={20} />
        Nova localidade
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg font-medium text-zinc-900">
          Nova localidade da DIP
        </span>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-200"
          aria-label="Cancelar"
        >
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="localidade" required placeholder="Localidade (ex.: São Paulo)" className={inputClass} />
        <input name="pais" required placeholder="País (ex.: Brasil)" className={inputClass} />
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton
          label="Cadastrar localidade"
          className="flex min-h-12 items-center gap-1.5 rounded-lg bg-blue-700 px-4 text-lg font-medium text-white transition-colors hover:bg-blue-800"
        />
        <button
          type="button"
          onClick={() => setShow(false)}
          className="rounded-lg px-3 py-2 text-lg text-zinc-600 transition-colors hover:text-zinc-900"
        >
          Cancelar
        </button>
      </div>
      <StatusLine state={state} />
    </form>
  );
}

function EditarLocalidadeForm({
  localidade,
  onCancel,
  onSaved,
}: {
  localidade: LocalidadeRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction] = useActionState(editarLocalidadeDip, initial);
  const [saved, setSaved] = useState(false);

  if (state.ok && !saved) {
    setSaved(true);
    setTimeout(onSaved, 800);
  }

  return (
    <form action={formAction} className="flex w-full flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={localidade.id} />
      <input
        name="localidade"
        required
        defaultValue={localidade.localidade}
        className={`${inputClass} min-w-[180px] flex-1`}
      />
      <input
        name="pais"
        required
        defaultValue={localidade.pais}
        className={`${inputClass} min-w-[120px] flex-1`}
      />
      <button
        type="submit"
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-700 text-white transition-colors hover:bg-green-800"
        aria-label="Salvar"
      >
        <Check size={18} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        aria-label="Cancelar"
      >
        <X size={18} />
      </button>
      <StatusLine state={state} />
    </form>
  );
}

function ExcluirLocalidadeButton({
  localidadeId,
  localidadeNome,
}: {
  localidadeId: number;
  localidadeNome: string;
}) {
  const [state, formAction] = useActionState(excluirLocalidadeDip, initial);

  return (
    <form action={formAction} className="flex items-center">
      <input type="hidden" name="id" value={localidadeId} />
      <button
        type="submit"
        aria-label={`Excluir ${localidadeNome}`}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={18} />
      </button>
      {state.message && (
        <span className="ml-1 text-sm text-red-600">{state.message}</span>
      )}
    </form>
  );
}

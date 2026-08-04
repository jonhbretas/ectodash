"use client";

// Model configuration forms — one small useActionState form per operation
// (new tipo, add template task, remove task, remove tipo). All four are
// coordinator-gated server-side by RLS (migration 0011); the page itself
// also gates coordinator-only rendering.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PlusCircle, Trash2, X } from "lucide-react";
import {
  criarTipoEvento,
  adicionarTarefaModelo,
  removerTarefaModelo,
  removerTipoEvento,
  modelosInitialState,
} from "./actions";

type ModelosState = { ok: boolean; message: string };

function StatusLine({ state }: { state: ModelosState }) {
  if (!state.message) return null;
  return (
    <p
      className={`text-base ${
        state.ok ? "text-green-800" : "text-red-700"
      }`}
    >
      {state.message}
    </p>
  );
}

export function CriarTipoForm() {
  const [state, formAction] = useActionState(criarTipoEvento, modelosInitialState);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-zinc-900">Novo tipo de evento</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="nome"
          name="nome"
          required
          placeholder="Ex: Evento presencial"
          className="min-h-14 flex-1 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
        <CreateTipoButton />
      </div>
      <StatusLine state={state} />
    </form>
  );
}

function CreateTipoButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-70"
    >
      <PlusCircle size={20} aria-hidden="true" />
      {pending ? "Criando..." : "Criar tipo"}
    </button>
  );
}

export function AdicionarTarefaForm({ tipoId }: { tipoId: number }) {
  const [state, formAction] = useActionState(
    adicionarTarefaModelo,
    modelosInitialState
  );
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <input type="hidden" name="tipoId" value={tipoId} />
      <label htmlFor={`titulo-${tipoId}`} className="text-lg font-medium text-zinc-900">
        Nova tarefa do modelo
      </label>
      <input
        id={`titulo-${tipoId}`}
        name="titulo"
        required
        placeholder="Ex: Confirmar patrocínio"
        className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          name="area"
          placeholder="Área (opcional)"
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
        <input
          name="prazoOffsetDias"
          type="number"
          defaultValue={0}
          placeholder="Dias em relação ao evento (ex.: -7)"
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
      </div>
      <AddTarefaButton />
      <StatusLine state={state} />
    </form>
  );
}

function AddTarefaButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-70"
    >
      {pending ? "Adicionando..." : "Adicionar ao modelo"}
    </button>
  );
}

export function RemoverTarefaButton({ tarefaId }: { tarefaId: number }) {
  const [state, formAction] = useActionState(removerTarefaModelo, modelosInitialState);
  return (
    <form action={formAction} aria-live="polite">
      <input type="hidden" name="id" value={tarefaId} />
      <button
        type="submit"
        aria-label="Remover tarefa do modelo"
        className="flex h-12 w-12 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <X size={20} aria-hidden="true" />
      </button>
      {state.message && <StatusLine state={state} />}
    </form>
  );
}

export function RemoverTipoButton({ tipoId }: { tipoId: number }) {
  const [state, formAction] = useActionState(removerTipoEvento, modelosInitialState);
  return (
    <form action={formAction} aria-live="polite">
      <input type="hidden" name="id" value={tipoId} />
      <button
        type="submit"
        className="flex min-h-12 items-center gap-1 rounded-lg px-2 text-base font-medium text-red-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <Trash2 size={18} aria-hidden="true" />
        Remover tipo
      </button>
      {state.message && <StatusLine state={state} />}
    </form>
  );
}

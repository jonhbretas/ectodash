"use client";

// Inline edit panel for an existing event (titulo, data, local, descricao)
// — the missing correction path for pre-registered events. Toggle button
// opens the form; save goes through editarEvento (RLS 0008: creator or
// coordenador_geral). On success the panel refreshes so the header shows
// the new values.
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Check } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { editarEvento, type EditarEventoState } from "./actions";

const inputClass =
  "min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

const editarEventoInitialState: EditarEventoState = { ok: false, message: "" };

export default function EditarEventoPanel({
  evento,
}: {
  evento: { id: number; titulo: string; data_evento: string; local: string | null; descricao: string | null };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<EditarEventoState, FormData>(
    editarEvento,
    editarEventoInitialState
  );
  const [, startTransition] = useTransition();

  // After a successful save the header re-reads the new values via
  // router.refresh(); the form stays open showing the success message.
  useEffect(() => {
    if (state.ok && editing) {
      startTransition(() => router.refresh());
    }
  }, [state.ok, editing, router]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <Pencil size={20} aria-hidden="true" />
        Editar evento
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <input type="hidden" name="id" value={evento.id} />
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold text-zinc-900">Editar evento</h2>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancelar edição"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="editar-titulo" className="text-lg font-medium text-zinc-900">
            Título
          </label>
          <input
            id="editar-titulo"
            name="titulo"
            required
            defaultValue={evento.titulo}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="editar-data" className="text-lg font-medium text-zinc-900">
            Data
          </label>
          <DateInput
            id="editar-data"
            name="data_evento"
            required
            defaultValue={evento.data_evento}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="editar-local" className="text-lg font-medium text-zinc-900">
            Local
          </label>
          <input
            id="editar-local"
            name="local"
            defaultValue={evento.local ?? ""}
            placeholder="Ex: ECTOLAB"
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="editar-descricao" className="text-lg font-medium text-zinc-900">
          Descrição
        </label>
        <textarea
          id="editar-descricao"
          name="descricao"
          rows={3}
          defaultValue={evento.descricao ?? ""}
          placeholder="Sobre o evento..."
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="flex min-h-12 items-center gap-1.5 rounded-lg bg-[#2195B9] px-4 text-lg font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <Check size={18} aria-hidden="true" />
          Salvar alterações
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg px-3 py-2 text-lg text-zinc-600 transition-colors hover:text-zinc-900"
        >
          Cancelar
        </button>
      </div>

      <p aria-live="polite" className={`text-base ${state.ok ? "text-green-800" : "text-red-700"}`}>
        {state.message}
      </p>
    </form>
  );
}

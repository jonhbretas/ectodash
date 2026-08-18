"use client";

// "Pedir pauta" form — any volunteer submits a topic to be discussed at the
// next meeting. Same useActionState pattern as ata-form.tsx; criarPauta
// validates and the pautas table RLS (0076) is the real boundary.
import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ListPlus } from "lucide-react";
import { criarPauta, type CriarPautaState } from "./pauta-actions";

const initialState: CriarPautaState = { ok: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-base font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 size={18} aria-hidden="true" className="animate-spin" />
      ) : (
        <ListPlus size={18} aria-hidden="true" />
      )}
      {pending ? "Adicionando..." : "Pedir pauta"}
    </button>
  );
}

export default function PautaForm() {
  const [state, formAction] = useActionState(criarPauta, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  const inputClassName =
    "min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formAction(formData);
        formRef.current?.reset();
      }}
      className="flex w-full flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pauta-titulo" className="text-base font-medium text-zinc-900">
          Assunto da pauta
        </label>
        <input
          id="pauta-titulo"
          name="titulo"
          required
          maxLength={200}
          placeholder="Sobre o que você quer conversar na próxima reunião?"
          className={inputClassName}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pauta-contexto" className="text-base font-medium text-zinc-900">
          Contexto (opcional)
        </label>
        <textarea
          id="pauta-contexto"
          name="contexto"
          rows={2}
          maxLength={3000}
          placeholder="Detalhe o assunto para quem for mediar a reunião..."
          className={`${inputClassName} min-h-20 resize-y`}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton />
        <p
          aria-live="polite"
          className={`text-sm ${
            state.ok ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}

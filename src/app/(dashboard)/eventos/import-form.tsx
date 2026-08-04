"use client";

// Eventos CSV import card — Data;Título;Local;Descrição (header row
// required), dates in dd/MM/yyyy or yyyy-MM-dd.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { importarEventos, importarEventosInitialState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Importando..." : "Importar eventos"}
    </button>
  );
}

export default function ImportEventosForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(
    importarEventos,
    importarEventosInitialState
  );

  return (
    <section className="flex w-full max-w-4xl flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
        <UploadCloud size={24} aria-hidden="true" />
        Cadastrar eventos por planilha
      </h2>
      <p className="text-base text-zinc-700">
        Envie um arquivo <strong>.csv</strong> com as colunas{" "}
        <span className="font-medium text-zinc-900">
          Data; Título; Local; Descrição
        </span>{" "}
        (com cabeçalho na primeira linha). A data pode ser no formato
        dd/mm/aaaa ou aaaa-mm-dd.
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <input
          id="arquivo"
          name="arquivo"
          type="file"
          accept=".csv"
          required
          className="block w-full cursor-pointer rounded-lg border border-zinc-400 bg-white px-4 py-3 text-lg text-zinc-900 file:mr-4 file:min-h-12 file:rounded-lg file:border-0 file:bg-blue-700 file:px-4 file:text-lg file:font-medium file:text-white file:cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
        <SubmitButton />
      </form>

      <div aria-live="polite" className="flex flex-col gap-2">
        {state.message && (
          <p
            className={`text-base ${
              state.ok ? "text-green-800" : "text-red-700"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>

      {state.ok && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="min-h-14 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          Atualizar a lista
        </button>
      )}
    </section>
  );
}

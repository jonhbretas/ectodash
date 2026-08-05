"use client";

// "Adicionar tarefas do evento" — materializes the event type's task
// template into real demandas (server action, idempotent). Feedback shown
// inline; the kanban below refreshes via router.refresh().
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  adicionarTarefasDoModelo,
  adicionarTarefasInitialState,
} from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70"
    >
      <Sparkles size={22} aria-hidden="true" />
      {pending ? "Criando tarefas..." : "Adicionar tarefas do modelo"}
    </button>
  );
}

export default function AdicionarTarefasButton({ eventoId }: { eventoId: number }) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    adicionarTarefasDoModelo.bind(null, eventoId),
    adicionarTarefasInitialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-1"
      aria-live="polite"
    >
      <SubmitButton />
      {state.message && (
        <p
          className={`max-w-md text-base ${
            state.ok ? "text-green-800" : "text-red-700"
          }`}
        >
          {state.message}
        </p>
      )}
      {state.ok && (
        <button
          type="button"
          onClick={() => router.refresh()}
          className="w-fit text-base font-medium text-[#2195B9] underline"
        >
          Atualizar o quadro
        </button>
      )}
    </form>
  );
}

"use client";

// Comment thread on the demanda edit screen — any volunteer who can see
// the demanda can comment; @mention tokens (e.g. "@Ana") resolve
// server-side to volunteers and trigger an instant email to them.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { comentarDemanda } from "./checklist-actions";

export type Comentario = {
  id: number;
  autorNome: string;
  conteudo: string;
  createdAt: string;
};

export type DemandaComentariosProps = {
  demandaId: string;
  comentarios: Comentario[];
};

const initialState = { ok: false, message: "" };

function ComentarButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded-lg bg-blue-700 px-4 text-lg font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Enviando..." : "Comentar"}
    </button>
  );
}

export default function DemandaComentarios({
  demandaId,
  comentarios,
}: DemandaComentariosProps) {
  const [state, formAction] = useActionState(
    comentarDemanda.bind(null, Number(demandaId)),
    initialState
  );

  return (
    <section className="flex w-full flex-col gap-3" aria-label="Comentários">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
        <MessageSquare size={20} aria-hidden="true" />
        Comentários ({comentarios.length})
      </h2>

      {comentarios.length > 0 && (
        <ul className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
          {comentarios.map((comentario) => (
            <li
              key={comentario.id}
              className="flex flex-col gap-1 border-b border-zinc-200 px-4 py-3 last:border-b-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-zinc-900">
                  {comentario.autorNome}
                </span>
                <span className="text-base text-zinc-600">
                  {format(new Date(comentario.createdAt), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-zinc-800">
                {comentario.conteudo}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="flex flex-col gap-2" aria-live="polite">
        <label htmlFor="conteudo" className="text-lg font-medium text-zinc-900">
          Escreva um comentário
        </label>
        <textarea
          id="conteudo"
          name="conteudo"
          rows={3}
          required
          placeholder='Mencione alguém com "@nome" para avisar por e-mail...'
          className="rounded-lg border border-zinc-400 bg-white px-4 py-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
        <ComentarButton />
        {state.message && (
          <p className="text-base text-red-700">{state.message}</p>
        )}
      </form>
    </section>
  );
}

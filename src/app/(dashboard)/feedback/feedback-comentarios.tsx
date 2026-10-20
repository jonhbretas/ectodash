"use client";

// src/app/(dashboard)/feedback/feedback-comentarios.tsx
// Fio de conversa de um relato: o autor e a coordenação geral trocam
// mensagens (pedir detalhes, avisar correção, confirmar que resolveu).
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { comentarFeedback, type ComentarFeedbackState } from "./feedback-actions";

export type FeedbackComentario = {
  id: number;
  autorNome: string;
  doAutorDoRelato: boolean;
  conteudo: string;
  createdAt: string;
};

const initialState: ComentarFeedbackState = { ok: false, message: "" };

function EnviarButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-10 items-center justify-center self-start rounded-lg bg-[#2195B9] px-4 text-sm font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Enviando..." : "Comentar"}
    </button>
  );
}

export default function FeedbackComentarios({
  feedbackId,
  comentarios,
  isCoordenador,
}: {
  feedbackId: string;
  comentarios: FeedbackComentario[];
  isCoordenador: boolean;
}) {
  const [state, formAction] = useActionState(
    comentarFeedback.bind(null, feedbackId),
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const campoId = `comentario-${feedbackId}`;

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3"
      aria-label="Conversa sobre o relato"
    >
      <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-800">
        <MessageSquare size={18} aria-hidden="true" className="text-zinc-400" />
        Conversa
        {comentarios.length > 0 && (
          <span className="rounded-full bg-white px-2 py-0.5 text-sm font-medium text-zinc-500 ring-1 ring-zinc-200">
            {comentarios.length}
          </span>
        )}
      </h3>

      {comentarios.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {comentarios.map((c) => (
            <li
              key={c.id}
              className={cn(
                "flex flex-col gap-1 rounded-lg px-3 py-2 ring-1",
                c.doAutorDoRelato
                  ? "bg-white ring-zinc-200"
                  : "bg-[#2195B9]/5 ring-[#2195B9]/20"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-zinc-900">
                  {c.autorNome}
                  <span className="font-normal text-zinc-500">
                    {c.doAutorDoRelato ? " · autor do relato" : " · coordenação"}
                  </span>
                </span>
                <span className="text-sm text-zinc-500">
                  {format(new Date(c.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
              <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-zinc-800">
                {c.conteudo}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          {isCoordenador
            ? "Nenhuma mensagem ainda. Pergunte detalhes ou avise o autor sobre a correção."
            : "Nenhuma mensagem ainda. Acrescente detalhes ou tire dúvidas com a coordenação."}
        </p>
      )}

      <form ref={formRef} action={formAction} className="flex flex-col gap-2" aria-live="polite">
        <label htmlFor={campoId} className="text-sm font-medium text-zinc-700">
          {isCoordenador ? "Responder ao autor" : "Escrever para a coordenação"}
        </label>
        <textarea
          id={campoId}
          name="conteudo"
          rows={2}
          required
          maxLength={2000}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        />
        <EnviarButton />
        {state.message && <p className="text-sm text-red-600">{state.message}</p>}
      </form>
    </section>
  );
}

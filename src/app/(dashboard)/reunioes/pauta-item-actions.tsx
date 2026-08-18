"use client";

// Per-pauta lifecycle controls (mark discussed / reopen / delete). These
// call the pauta-actions server actions directly; the pautas RLS (0076) is
// the real boundary — the caller only renders them when canManage is true
// (creator or coordenador_geral), mirroring the reunioes delete button.
import { useState, useTransition } from "react";
import { CheckCheck, Loader2, RotateCcw, Trash2 } from "lucide-react";
import {
  excluirPauta,
  marcarPautaDiscutida,
  reabrirPauta,
} from "./pauta-actions";

type PautaItemActionsProps = {
  pautaId: number;
  status: "pendente" | "discutida";
};

const buttonClassName =
  "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60";

export default function PautaItemActions({
  pautaId,
  status,
}: PautaItemActionsProps) {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setMensagem(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.message) setMensagem(result.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "pendente" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => marcarPautaDiscutida(pautaId))}
          className={`${buttonClassName} bg-green-700 text-white hover:bg-green-600`}
        >
          {pending ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <CheckCheck size={14} aria-hidden="true" />
          )}
          Discutida
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => reabrirPauta(pautaId))}
          className={`${buttonClassName} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Reabrir
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => excluirPauta(pautaId))}
        aria-label="Excluir pauta"
        className={`${buttonClassName} border border-zinc-200 bg-white text-zinc-400 hover:bg-red-50 hover:text-red-600`}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
      {mensagem && (
        <span className="w-full text-sm text-red-600">{mensagem}</span>
      )}
    </div>
  );
}

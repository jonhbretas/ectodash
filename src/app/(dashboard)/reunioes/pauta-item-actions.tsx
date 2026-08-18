"use client";

// Per-pauta lifecycle controls (mark discussed / stand by / reopen / delete).
// These call the pauta-actions server actions directly; the pautas RLS (0076)
// is the real boundary — the caller only renders them when canManage is true
// (creator or coordenador_geral).
//
// "Discutida" no longer needs a dropdown — the ata is auto-resolved to the
// next Tuesday's meeting. Use "Em espera" to defer to a later meeting.
import { useState, useTransition } from "react";
import {
  CheckCheck,
  Clock,
  Loader2,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  emEspera,
  excluirPauta,
  marcarPautaDiscutida,
  reabrirPauta,
  retomarPauta,
} from "./pauta-actions";

type PautaItemActionsProps = {
  pautaId: number;
  status: "pendente" | "discutida";
  standBy?: boolean;
};

const buttonClassName =
  "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60";

export default function PautaItemActions({
  pautaId,
  status,
  standBy = false,
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

  if (status === "pendente" && standBy) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => retomarPauta(pautaId))}
          className={`${buttonClassName} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`}
        >
          <Undo2 size={14} aria-hidden="true" />
          Retomar
        </button>
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

  if (status === "pendente") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
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
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => emEspera(pautaId))}
          className={`${buttonClassName} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`}
        >
          <Clock size={14} aria-hidden="true" />
          Em espera
        </button>
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

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => reabrirPauta(pautaId))}
        className={`${buttonClassName} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`}
      >
        <RotateCcw size={14} aria-hidden="true" />
        Reabrir
      </button>
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

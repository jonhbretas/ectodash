"use client";

// Per-pauta lifecycle controls (mark discussed linked to a meeting / reopen
// / delete). These call the pauta-actions server actions directly; the
// pautas RLS (0076) is the real boundary — the caller only renders them when
// canManage is true (creator or coordenador_geral).
//
// "Discutida" now requires choosing the ata (reunião) where the topic was
// handled: the pauta is linked via ata_discutida_id (0077) so the ata page
// shows everything that was covered in that meeting.
import { useState, useTransition } from "react";
import { CheckCheck, Loader2, RotateCcw, Trash2 } from "lucide-react";
import {
  excluirPauta,
  marcarPautaDiscutida,
  reabrirPauta,
} from "./pauta-actions";

export type PautaAtaOption = {
  id: number;
  label: string;
};

type PautaItemActionsProps = {
  pautaId: number;
  status: "pendente" | "discutida";
  atas: PautaAtaOption[];
};

const buttonClassName =
  "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60";

export default function PautaItemActions({
  pautaId,
  status,
  atas,
}: PautaItemActionsProps) {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  // Defaults to the most recent meeting (atas is ordered newest-first by the
  // caller) so "Discutida" works in one click — the select only matters when
  // the pauta was handled in an older meeting.
  const [ataSelecionada, setAtaSelecionada] = useState<string>(
    atas[0] ? String(atas[0].id) : ""
  );

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setMensagem(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.message) setMensagem(result.message);
    });
  }

  if (status === "pendente") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={ataSelecionada}
          onChange={(e) => setAtaSelecionada(e.target.value)}
          aria-label="Ata da reunião em que foi discutida"
          className="min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          {atas.length === 0 ? (
            <option value="">Sem atas registradas</option>
          ) : (
            <option value="">Em qual reunião?</option>
          )}
          {atas.map((ata) => (
            <option key={ata.id} value={String(ata.id)}>
              {ata.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || ataSelecionada === ""}
          onClick={() =>
            run(() => marcarPautaDiscutida(pautaId, Number(ataSelecionada)))
          }
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

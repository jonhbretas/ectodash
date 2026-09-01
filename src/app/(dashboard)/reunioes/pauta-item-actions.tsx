"use client";

// Per-pauta lifecycle controls (mark discussed / stand by / reopen / delete).
// These call the pauta-actions server actions directly; the pautas RLS (0076)
// is the real boundary — the caller only renders them when canManage is true
// (creator or coordenador_geral).
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
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
  moverPauta,
  reabrirPauta,
  retomarPauta,
} from "./pauta-actions";

type AtaOption = {
  id: number;
  titulo: string;
  data_reuniao: string;
};

type PautaItemActionsProps = {
  pautaId: number;
  status: "pendente" | "discutida";
  standBy?: boolean;
  atasDisponiveis?: AtaOption[];
};

const buttonClassName =
  "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60";

export default function PautaItemActions({
  pautaId,
  status,
  standBy = false,
  atasDisponiveis = [],
}: PautaItemActionsProps) {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [showMover, setShowMover] = useState(false);
  const [showDiscutir, setShowDiscutir] = useState(false);
  const moverRef = useRef<HTMLDivElement>(null);
  const discutirRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moverRef.current && !moverRef.current.contains(e.target as Node)) {
        setShowMover(false);
      }
      if (discutirRef.current && !discutirRef.current.contains(e.target as Node)) {
        setShowDiscutir(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setMensagem(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.message) setMensagem(result.message);
    });
  }

  function handleMover(ataId: number | null) {
    setShowMover(false);
    run(() => moverPauta(pautaId, ataId));
  }

  function handleDiscutir(ataId: number | null) {
    setShowDiscutir(false);
    run(() => marcarPautaDiscutida(pautaId, ataId ?? undefined));
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
        <div className="relative" ref={discutirRef}>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowDiscutir(!showDiscutir)}
            className={`${buttonClassName} bg-green-700 text-white hover:bg-green-600`}
          >
            {pending ? (
              <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            ) : (
              <CheckCheck size={14} aria-hidden="true" />
            )}
            Discutida
          </button>
          {showDiscutir && (
            <div className="absolute left-0 top-full z-10 mt-1 w-72 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
              <div className="border-b border-zinc-100 px-3 py-2">
                <span className="text-xs font-medium text-zinc-500">
                  Marcar como discutida na reunião:
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDiscutir(null)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
              >
                <span className="font-medium text-green-700">Padrão:</span>
                Próxima reunião
              </button>
              {atasDisponiveis.length > 0 && (
                <>
                  <div className="border-t border-zinc-100 px-3 py-1.5">
                    <span className="text-xs font-medium text-zinc-500">
                      Ou selecione outra reunião:
                    </span>
                  </div>
                  {atasDisponiveis.map((ata) => (
                    <button
                      key={ata.id}
                      type="button"
                      onClick={() => handleDiscutir(ata.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      {ata.data_reuniao} — {ata.titulo}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        {atasDisponiveis.length > 0 && (
          <div className="relative" ref={moverRef}>
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowMover(!showMover)}
              className={`${buttonClassName} border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50`}
            >
              <ArrowRight size={14} aria-hidden="true" />
              Mover
            </button>
            {showMover && (
              <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => handleMover(null)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                >
                  Próxima reunião (padrão)
                </button>
                {atasDisponiveis.map((ata) => (
                  <button
                    key={ata.id}
                    type="button"
                    onClick={() => handleMover(ata.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    {ata.data_reuniao} — {ata.titulo}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
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

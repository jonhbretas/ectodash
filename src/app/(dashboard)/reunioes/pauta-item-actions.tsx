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

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Gera as próximas N terças-feiras a partir de hoje (BRT). */
function gerarProximasTerças(qtd: number): { data: string; label: string }[] {
  const resultado: { data: string; label: string }[] = [];
  const hoje = new Date();
  // Ajustar para BRT
  const hojeBRT = new Date(
    hoje.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const dia = hojeBRT.getDay();
  const terca = 2;
  // Dias até a próxima terça
  let diff = (terca - dia + 7) % 7;
  if (diff === 0) diff = 7; // se é terça, pula pra próxima

  for (let i = 0; i < qtd; i++) {
    const data = new Date(hojeBRT);
    data.setDate(data.getDate() + diff + i * 7);
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, "0");
    const dd = String(data.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    const label = `${dd}/${mm}/${yyyy}`;
    resultado.push({ data: iso, label });
  }
  return resultado;
}

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

  // Gerar próximas terças para o dropdown
  const proximasTerças = gerarProximasTerças(8);

  // Combinar atas existentes com terças geradas (sem duplicar)
  const datasExistentes = new Set(atasDisponiveis.map((a) => a.data_reuniao));
  const tercasUnicas = proximasTerças.filter((t) => !datasExistentes.has(t.data));

  // Juntar: atas existentes primeiro, depois terças sem ata
  const opcoesDiscutir = [
    ...atasDisponiveis.map((a) => ({
      id: a.id,
      data: a.data_reuniao,
      label: `${formatarDataBR(a.data_reuniao)} — ${a.titulo}`,
      hasAta: true,
    })),
    ...tercasUnicas.map((t) => ({
      id: null,
      data: t.data,
      label: `${t.label} — Sem ata`,
      hasAta: false,
    })),
  ];

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

  function handleDiscutir(ataId: number | null, dataReuniao?: string) {
    setShowDiscutir(false);
    run(() => marcarPautaDiscutida(pautaId, ataId ?? undefined, dataReuniao));
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
            <div className="absolute left-0 top-full z-10 mt-1 w-80 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
              <div className="border-b border-zinc-100 px-3 py-2">
                <span className="text-xs font-medium text-zinc-500">
                  Selecione a reunião em que deseja que essa pauta seja discutida:
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
              {opcoesDiscutir.length > 0 && (
                <>
                  <div className="border-t border-zinc-100 px-3 py-1.5">
                    <span className="text-xs font-medium text-zinc-500">
                      Reuniões:
                    </span>
                  </div>
                  {opcoesDiscutir.map((opcao, idx) => (
                    <button
                      key={`${opcao.data}-${idx}`}
                      type="button"
                      onClick={() => handleDiscutir(opcao.id, opcao.id ? undefined : opcao.data)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      {opcao.label}
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
                    {formatarDataBR(ata.data_reuniao)} — {ata.titulo}
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

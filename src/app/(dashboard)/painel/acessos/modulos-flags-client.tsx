"use client";

// Kill switch global de módulos: lista todos com o estado atual e um
// botão Ativar/Desativar por linha. Exclusivo do coordenador geral
// (a página já barra outros papéis no servidor).
import { useState } from "react";
import { Power, PowerOff } from "lucide-react";
import { MODULOS_CONCEDIVEIS, MODULOS_LABELS } from "@/lib/acesso";
import { alternarModulo } from "./actions";

export interface ModuloFlagRow {
  modulo: string;
  ativo: boolean;
}

export default function ModulosFlagsClient({
  initialFlags,
}: {
  initialFlags: ModuloFlagRow[];
}) {
  const [flags, setFlags] = useState<ModuloFlagRow[]>(initialFlags);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const ativoDe = (modulo: string) =>
    flags.find((f) => f.modulo === modulo)?.ativo ?? true;

  async function toggle(modulo: string) {
    const atual = ativoDe(modulo);
    const desliga = atual === true;
    if (
      desliga &&
      !confirm(
        "Desativar este módulo para todos (menos você)? Ele some do menu até ser reativado."
      )
    ) {
      return;
    }
    setPending(modulo);
    setFeedback(null);
    const r = await alternarModulo(modulo, !atual);
    setPending(null);
    if (!r.ok) {
      setFeedback(r.message);
      return;
    }
    setFlags((prev) => {
      const next = prev.filter((f) => f.modulo !== modulo);
      return [...next, { modulo, ativo: !atual }];
    });
    setFeedback(r.message);
  }

  return (
    <section className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Módulos do sistema</h2>
        <p className="mt-1 max-w-2xl text-base text-zinc-500">
          Desligue um módulo com problema ou que queira ocultar — ele some do
          menu de todo mundo na hora. Você continua vendo para diagnosticar e
          religar. Liga de novo quando estiver tudo certo.
        </p>
      </div>
      {feedback && (
        <p className="text-base text-zinc-600" role="status">{feedback}</p>
      )}
      <ul className="flex flex-col divide-y divide-slate-100">
        {MODULOS_CONCEDIVEIS.map((modulo) => {
          const ativo = ativoDe(modulo);
          const busy = pending === modulo;
          return (
            <li key={modulo} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`inline-block h-2.5 w-2.5 rounded-full ${ativo ? "bg-emerald-500" : "bg-zinc-300"}`}
                />
                <span className="text-lg text-zinc-800">{MODULOS_LABELS[modulo]}</span>
                {!ativo && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm font-medium text-zinc-500">
                    Desativado
                  </span>
                )}
              </div>
              <button
                onClick={() => void toggle(modulo)}
                disabled={busy}
                aria-pressed={ativo}
                aria-label={`${ativo ? "Desativar" : "Ativar"} ${MODULOS_LABELS[modulo]}`}
                className={`inline-flex h-10 min-h-11 items-center gap-2 rounded-xl px-4 text-base font-medium disabled:opacity-50 ${
                  ativo
                    ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    : "bg-[#2195B9] text-white hover:bg-[#1a7a98]"
                }`}
              >
                {ativo ? <PowerOff size={16} aria-hidden="true" /> : <Power size={16} aria-hidden="true" />}
                {busy ? "Salvando…" : ativo ? "Desativar" : "Ativar"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

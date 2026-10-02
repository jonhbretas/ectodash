"use client";

// src/app/(dashboard)/voluntarios/limpeza/limpeza-list.tsx
// Mutirão de limpeza: lista quem é candidato a sair (ocioso ou sem área)
// com caixas de seleção grandes + motivo único + botão de desligar em
// massa; e quem já está desligado, para reativar. Tudo reversível.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { acaoEmMassa } from "../cuidar/actions";

export type Candidato = {
  id: number;
  nome: string;
  area: string | null;
  motivo: string;
};

export default function LimpezaList({
  candidatos,
  desligados,
}: {
  candidatos: Candidato[];
  desligados: Candidato[];
}) {
  const router = useRouter();
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [selReativar, setSelReativar] = useState<Set<number>>(new Set());
  const [motivo, setMotivo] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [, startTransition] = useTransition();

  function alternar(set: Set<number>, aplicar: (novo: Set<number>) => void, id: number) {
    const novo = new Set(set);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    aplicar(novo);
  }

  function executar(ids: number[], acao: "desligar" | "reativar") {
    setOcupado(true);
    setFeedback(null);
    startTransition(async () => {
      const res = await acaoEmMassa(ids, acao, motivo);
      setOcupado(false);
      setFeedback(res.message);
      if (res.ok) {
        setSelecionados(new Set());
        setSelReativar(new Set());
        setMotivo("");
        router.refresh();
      }
    });
  }

  const caixa =
    "flex min-h-16 items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left transition-colors has-checked:border-[#2195B9] has-checked:bg-[#2195B9]/5";

  return (
    <div className="flex w-full flex-col gap-6">
      {feedback && (
        <p role="status" className="rounded-xl bg-zinc-900 px-4 py-3 text-xl text-white">
          {feedback}
        </p>
      )}

      <section aria-labelledby="cand-titulo" className="flex flex-col gap-3">
        <h2 id="cand-titulo" className="text-2xl font-semibold text-zinc-900">
          Podem sair ({candidatos.length})
        </h2>
        <p className="text-xl text-zinc-600">
          Ociosos ou sem área. Marque quem vai sair, escreva o motivo e toque em desligar.
        </p>
        {candidatos.length === 0 ? (
          <p className="rounded-2xl bg-green-50 px-4 py-3 text-xl text-green-800">
            Ninguém para limpar. Todo mundo alocado!
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {candidatos.map((c) => (
                <label key={c.id} className={caixa}>
                  <input
                    type="checkbox"
                    checked={selecionados.has(c.id)}
                    onChange={() => alternar(selecionados, setSelecionados, c.id)}
                    className="mt-1 size-7 shrink-0 accent-[#2195B9]"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xl font-semibold text-zinc-900">{c.nome}</span>
                    <span className="text-lg text-zinc-500">{c.motivo} · {c.area ?? "Sem área"}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="motivo-limpeza" className="text-xl font-medium text-zinc-800">
                Motivo do desligamento *
              </label>
              <input
                id="motivo-limpeza"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: mutirão de limpeza, sem atividade há meses…"
                maxLength={500}
                className="min-h-14 rounded-xl border border-zinc-300 bg-white px-4 text-xl text-zinc-900"
              />
            </div>
            <div>
              <button
                type="button"
                disabled={ocupado || selecionados.size === 0 || motivo.trim().length < 3}
                onClick={() => {
                  if (
                    window.confirm(
                      `Desligar ${selecionados.size} pessoa(s)? Dá para reativar depois.`
                    )
                  ) {
                    executar([...selecionados], "desligar");
                  }
                }}
                className="flex min-h-14 items-center gap-2 rounded-xl bg-red-700 px-6 text-xl font-semibold text-white disabled:opacity-50"
              >
                <UserX size={22} aria-hidden="true" />
                {ocupado ? "Salvando…" : `Desligar (${selecionados.size})`}
              </button>
            </div>
          </>
        )}
      </section>

      {desligados.length > 0 && (
        <section aria-labelledby="desl-titulo" className="flex flex-col gap-3">
          <h2 id="desl-titulo" className="text-2xl font-semibold text-zinc-900">
            Já desligados ({desligados.length})
          </h2>
          <p className="text-xl text-zinc-600">Se alguém voltou, marque e reative.</p>
          <div className="flex flex-col gap-2">
            {desligados.map((c) => (
              <label key={c.id} className={caixa}>
                <input
                  type="checkbox"
                  checked={selReativar.has(c.id)}
                  onChange={() => alternar(selReativar, setSelReativar, c.id)}
                  className="mt-1 size-7 shrink-0 accent-green-600"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-xl font-semibold text-zinc-900">{c.nome}</span>
                  <span className="text-lg text-zinc-500">{c.area ?? "Sem área"}</span>
                </span>
              </label>
            ))}
          </div>
          <div>
            <button
              type="button"
              disabled={ocupado || selReativar.size === 0}
              onClick={() => executar([...selReativar], "reativar")}
              className={cn(
                "flex min-h-14 items-center gap-2 rounded-xl bg-green-600 px-6 text-xl font-semibold text-white disabled:opacity-50"
              )}
            >
              <UserCheck size={22} aria-hidden="true" />
              {ocupado ? "Salvando…" : `Reativar (${selReativar.size})`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

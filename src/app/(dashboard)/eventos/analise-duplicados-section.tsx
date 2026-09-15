"use client";

// Análise IA de duplicados (tela /eventos, coordenador) — varre a base,
// a IA confirma grupos de réplicas (4-5 cópias do mesmo evento vindas de
// atas/importações) e o coordenador confere antes de mesclar: escolhe o
// definitivo por grupo e mescla N duplicados de uma vez (mesclarEventosEmMassa).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Merge, EyeOff, Loader2 } from "lucide-react";
import {
  analisarDuplicadosEventosIA,
  mesclarEventosEmMassa,
  type GrupoDuplicado,
} from "./actions";

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

export default function AnaliseDuplicadosSection() {
  const router = useRouter();
  const [grupos, setGrupos] = useState<GrupoDuplicado[] | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [manterPorGrupo, setManterPorGrupo] = useState<Record<number, number>>({});
  const [ignorados, setIgnorados] = useState<Set<number>>(new Set());
  const [mesclando, setMesclando] = useState<Record<number, boolean>>({});
  const [, startTransition] = useTransition();

  async function rodarAnalise() {
    setAnalisando(true);
    setMensagem("");
    const r = await analisarDuplicadosEventosIA();
    setAnalisando(false);
    setMensagem(r.message);
    if (r.ok) {
      setGrupos(r.grupos);
      const iniciais: Record<number, number> = {};
      r.grupos.forEach((g, i) => {
        iniciais[i] = g.manterId;
      });
      setManterPorGrupo(iniciais);
      setIgnorados(new Set());
    }
  }

  async function mesclarGrupo(index: number, grupo: GrupoDuplicado) {
    const manterId = manterPorGrupo[index] ?? grupo.manterId;
    const removerIds = grupo.eventos.map((e) => e.id).filter((id) => id !== manterId);
    if (removerIds.length === 0) return;
    setMesclando((m) => ({ ...m, [index]: true }));
    const r = await mesclarEventosEmMassa(manterId, removerIds);
    setMesclando((m) => ({ ...m, [index]: false }));
    setMensagem(r.message);
    if (r.ok) {
      setGrupos((gs) => (gs ?? []).filter((_, i) => i !== index));
      startTransition(() => router.refresh());
    }
  }

  const visiveis = (grupos ?? []).filter((_, i) => !ignorados.has(i));

  return (
    <section
      id="analise-duplicados"
      className="flex w-full scroll-mt-6 flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="h-8 w-1.5 rounded-full bg-[#2195B9]" aria-hidden="true" />
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <Sparkles size={22} aria-hidden="true" className="text-[#2195B9]" />
          Conferir duplicados com IA
        </h2>
      </div>
      <p className="text-base text-zinc-500">
        Varre os eventos cadastrados, a IA agrupa as réplicas (o mesmo evento
        repetido 4–5 vezes por atas ou importações) e você confere cada grupo
        antes de mesclar. Nada é apagado sem confirmação.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={rodarAnalise}
          disabled={analisando}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-[#2195B9] px-5 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {analisando ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
          {analisando ? "Analisando..." : grupos ? "Analisar novamente" : "Analisar duplicados com IA"}
        </button>
        {mensagem && <span className="text-base text-zinc-700">{mensagem}</span>}
      </div>

      {grupos && visiveis.length === 0 && (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-base text-green-800 ring-1 ring-green-200/60">
          Nenhum grupo pendente — base coerente ou grupos já resolvidos/ignorados.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {visiveis.map((grupo) => {
          const originalIndex = (grupos ?? []).indexOf(grupo);
          const manterId = manterPorGrupo[originalIndex] ?? grupo.manterId;
          const badge =
            grupo.confianca === "alta"
              ? "bg-green-50 text-green-800 ring-green-200/60"
              : grupo.confianca === "media"
                ? "bg-amber-50 text-amber-800 ring-amber-200/60"
                : "bg-zinc-100 text-zinc-600 ring-zinc-200/60";
          return (
            <article
              key={originalIndex}
              className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200/60"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${badge}`}>
                  confiança {grupo.confianca}
                </span>
                <span className="text-base text-zinc-600">
                  {grupo.eventos.length} réplicas · {grupo.justificativa}
                </span>
              </div>

              <ul className="flex flex-col gap-2">
                {grupo.eventos.map((ev) => (
                  <li key={ev.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200/60 hover:ring-zinc-300">
                      <input
                        type="radio"
                        name={`manter-${originalIndex}`}
                        checked={manterId === ev.id}
                        onChange={() =>
                          setManterPorGrupo((m) => ({ ...m, [originalIndex]: ev.id }))
                        }
                        className="mt-1.5 h-5 w-5 accent-[#2195B9]"
                        aria-label={`Manter ${ev.titulo}`}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-lg font-medium text-zinc-900">
                          {ev.titulo}
                          {manterId === ev.id && (
                            <span className="ml-2 rounded-full bg-[#2195B9]/10 px-2 py-0.5 text-sm font-semibold text-[#2195B9]">
                              definitivo
                            </span>
                          )}
                        </span>
                        <span className="text-base text-zinc-500">
                          {formatarData(ev.data_evento)}
                          {ev.local ? ` · ${ev.local}` : ""} · #{ev.id}
                        </span>
                        {ev.descricao && (
                          <span className="line-clamp-1 text-sm text-zinc-400">{ev.descricao}</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => mesclarGrupo(originalIndex, grupo)}
                  disabled={!!mesclando[originalIndex]}
                  className="flex min-h-11 items-center gap-2 rounded-xl bg-green-700 px-4 text-base font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {mesclando[originalIndex] ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Merge size={16} aria-hidden="true" />
                  )}
                  {mesclando[originalIndex]
                    ? "Mesclando..."
                    : `Mesclar ${grupo.eventos.length - 1} no definitivo`}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setIgnorados((s) => new Set(s).add(originalIndex))
                  }
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                >
                  <EyeOff size={16} aria-hidden="true" />
                  Não são duplicados
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

"use client";

// Painel de votação prévia de uma pauta deliberativa (D-03/D-05): placar,
// botões de voto, "quem votou" e, só para a coordenação geral, encerrar /
// reabrir. A autorização real está no banco (RLS + funções SECURITY DEFINER).
import { useState, useTransition } from "react";
import { CircleMinus, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  calcularResultadoVotacao,
  contarVotos,
  type VotacaoStatus,
  type VotoValor,
} from "@/lib/pautas/regras";
import type { VotoPauta } from "../_lib/get-reunioes-data";
import {
  encerrarVotacao,
  reabrirVotacao,
  removerVoto,
  votarPauta,
} from "../pauta-votacao-actions";

type Props = {
  pautaId: number;
  status: VotacaoStatus;
  quorumMinimo: number;
  votos: VotoPauta[];
  meuUserId: string;
  isCoordenador: boolean;
  encerradaEm: string | null;
  encerradaPorNome: string | null;
};

const ROTULO_VOTO: Record<VotoValor, string> = {
  aprovar: "Aprovar",
  rejeitar: "Rejeitar",
  abster: "Abster",
};

const ROTULO_RESULTADO: Record<Exclude<VotacaoStatus, "aberta">, string> = {
  aprovada: "Aprovada previamente",
  rejeitada: "Rejeitada na votação",
  sem_quorum: "Sem quórum",
};

const COR_RESULTADO: Record<Exclude<VotacaoStatus, "aberta">, string> = {
  aprovada: "border-emerald-600 bg-emerald-50 text-emerald-950",
  rejeitada: "border-red-600 bg-red-50 text-red-950",
  sem_quorum: "border-amber-600 bg-amber-50 text-amber-950",
};

const btnBase =
  "flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60";

function IconeVoto({ voto, size = 20 }: { voto: VotoValor; size?: number }) {
  if (voto === "aprovar") return <ThumbsUp size={size} aria-hidden="true" />;
  if (voto === "rejeitar") return <ThumbsDown size={size} aria-hidden="true" />;
  return <CircleMinus size={size} aria-hidden="true" />;
}

function formatarDataBR(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

export default function VotacaoPainel({
  pautaId,
  status,
  quorumMinimo,
  votos,
  meuUserId,
  isCoordenador,
  encerradaEm,
  encerradaPorNome,
}: Props) {
  const meuVoto = votos.find((v) => v.userId === meuUserId) ?? null;
  const [escolha, setEscolha] = useState<VotoValor | null>(meuVoto?.voto ?? null);
  const [comentario, setComentario] = useState(meuVoto?.comentario ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const contagem = contarVotos(votos);
  const aberta = status === "aberta";
  const faltam = Math.max(0, quorumMinimo - contagem.total);
  const previa = calcularResultadoVotacao(contagem, quorumMinimo);

  const pct = (n: number) => (contagem.total > 0 ? (n / contagem.total) * 100 : 0);
  const resumoBarra = `${contagem.aprovar} aprovar, ${contagem.rejeitar} rejeitar, ${contagem.abster} abster`;

  function executar(fn: () => Promise<{ ok: boolean; message?: string }>, aoSucesso?: () => void) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, texto: r.message ?? (r.ok ? "Pronto." : "Não foi possível concluir.") });
      if (r.ok) aoSucesso?.();
    });
  }

  return (
    <section
      aria-label="Votação prévia"
      className="mt-2 flex flex-col gap-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4"
    >
      {/* Placar */}
      <div className="flex flex-col gap-2">
        <div
          role="img"
          aria-label={`Placar: ${resumoBarra}`}
          className="flex h-4 w-full overflow-hidden rounded-full bg-zinc-200"
        >
          <div className="h-full bg-emerald-600" style={{ width: `${pct(contagem.aprovar)}%` }} />
          <div className="h-full bg-red-600" style={{ width: `${pct(contagem.rejeitar)}%` }} />
          <div className="h-full bg-zinc-400" style={{ width: `${pct(contagem.abster)}%` }} />
        </div>
        <p className="text-base font-medium text-zinc-900">
          {contagem.aprovar} aprovar · {contagem.rejeitar} rejeitar · {contagem.abster} abster
        </p>
        <p className="text-base text-zinc-700">
          {contagem.total} {contagem.total === 1 ? "voto" : "votos"} de {quorumMinimo} necessários
          {aberta && faltam > 0 ? ` — faltam ${faltam} ${faltam === 1 ? "voto" : "votos"} para o quórum` : ""}
        </p>
      </div>

      {/* Resultado (encerrada) */}
      {!aberta && (
        <div className={`rounded-xl border-2 p-3 text-base ${COR_RESULTADO[status]}`} role="status">
          <p className="font-semibold">{ROTULO_RESULTADO[status]}</p>
          {encerradaEm && (
            <p>
              Encerrada em {formatarDataBR(encerradaEm)}
              {encerradaPorNome ? ` por ${encerradaPorNome}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Votar (aberta) */}
      {aberta && (
        <div className="flex flex-col gap-3">
          <p id={`voto-legenda-${pautaId}`} className="text-base font-semibold text-zinc-900">
            {meuVoto ? "Seu voto (você pode mudar enquanto a votação estiver aberta)" : "Qual é o seu voto?"}
          </p>
          <div role="group" aria-labelledby={`voto-legenda-${pautaId}`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(["aprovar", "rejeitar", "abster"] as const).map((v) => {
              const ativo = escolha === v;
              const cor =
                v === "aprovar"
                  ? ativo ? "border-emerald-700 bg-emerald-700 text-white" : "border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-50"
                  : v === "rejeitar"
                    ? ativo ? "border-red-700 bg-red-700 text-white" : "border-red-700 bg-white text-red-800 hover:bg-red-50"
                    : ativo ? "border-zinc-700 bg-zinc-700 text-white" : "border-zinc-600 bg-white text-zinc-800 hover:bg-zinc-100";
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={ativo}
                  disabled={pending}
                  onClick={() => setEscolha(v)}
                  className={`${btnBase} border-2 ${cor}`}
                >
                  <IconeVoto voto={v} />
                  {ROTULO_VOTO[v]}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`voto-comentario-${pautaId}`} className="text-base font-medium text-zinc-900">
              Comentário (opcional)
            </label>
            <textarea
              id={`voto-comentario-${pautaId}`}
              value={comentario}
              maxLength={500}
              rows={2}
              onChange={(e) => setComentario(e.target.value)}
              className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
            />
            <span className="text-right text-sm text-zinc-600">{comentario.length}/500</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pending || !escolha}
              onClick={() => escolha && executar(() => votarPauta(pautaId, escolha, comentario))}
              className={`${btnBase} bg-[#1d6f8d] text-white hover:bg-[#28627B]`}
            >
              {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              {meuVoto ? "Alterar voto" : "Confirmar voto"}
            </button>
            {meuVoto && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  executar(() => removerVoto(pautaId), () => {
                    setEscolha(null);
                    setComentario("");
                  })
                }
                className={`${btnBase} border border-zinc-400 bg-white text-zinc-800 hover:bg-zinc-50`}
              >
                Retirar meu voto
              </button>
            )}
          </div>
        </div>
      )}

      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`text-base font-medium ${msg.ok ? "text-emerald-800" : "text-red-700"}`}
        >
          {msg.texto}
        </p>
      )}

      {/* Quem votou */}
      <details className="rounded-xl border border-zinc-200 bg-white">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 text-base font-semibold text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2195B9]">
          Quem votou ({contagem.total})
        </summary>
        <ul className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3">
          {votos.length === 0 && <li className="text-base text-zinc-600">Ninguém votou ainda.</li>}
          {votos.map((v) => (
            <li key={v.userId} className="flex flex-col gap-0.5 text-base text-zinc-900">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{v.nome}</span>
                <span className="inline-flex items-center gap-1 text-zinc-700">
                  <IconeVoto voto={v.voto} size={16} /> {ROTULO_VOTO[v.voto]}
                </span>
              </span>
              {v.comentario && <span className="whitespace-pre-wrap text-zinc-700">“{v.comentario}”</span>}
            </li>
          ))}
        </ul>
      </details>

      {/* Coordenação geral */}
      {isCoordenador && aberta && (
        <div className="flex flex-col gap-2 border-t border-violet-200 pt-3">
          {!confirmando ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmando(true)}
              className={`${btnBase} self-start border-2 border-violet-700 bg-white text-violet-900 hover:bg-violet-50`}
            >
              Encerrar votação
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-violet-300 bg-white p-3">
              <p className="text-base font-semibold text-zinc-900">
                Se encerrar agora: {ROTULO_RESULTADO[previa]}
              </p>
              <p className="text-base text-zinc-700">Depois de encerrada, ninguém mais pode votar (a não ser que você reabra).</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => executar(() => encerrarVotacao(pautaId), () => setConfirmando(false))}
                  className={`${btnBase} bg-violet-800 text-white hover:bg-violet-900`}
                >
                  {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                  Confirmar encerramento
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmando(false)}
                  className={`${btnBase} border border-zinc-400 bg-white text-zinc-800 hover:bg-zinc-50`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {isCoordenador && !aberta && (
        <button
          type="button"
          disabled={pending}
          onClick={() => executar(() => reabrirVotacao(pautaId))}
          className={`${btnBase} self-start border border-zinc-400 bg-white text-zinc-800 hover:bg-zinc-50`}
        >
          {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
          Reabrir votação
        </button>
      )}
    </section>
  );
}

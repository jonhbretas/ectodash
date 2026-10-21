"use client";

// Painel de votação prévia de uma pauta deliberativa (D-03/D-05): placar,
// botões de voto, "quem votou" e, só para a coordenação geral, encerrar /
// reabrir. A autorização real está no banco (RLS + funções SECURITY DEFINER).
//
// Um toque na opção já registra o voto (menos passos para quem tem pouca
// familiaridade); o comentário é opcional e fica recolhido até ser pedido.
import { useState, useTransition } from "react";
import { CircleMinus, Loader2, MessageSquare, ThumbsDown, ThumbsUp, Vote } from "lucide-react";
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

const COR_VOTO: Record<VotoValor, { ativo: string; inativo: string }> = {
  aprovar: {
    ativo: "border-emerald-700 bg-emerald-700 text-white",
    inativo: "border-zinc-300 bg-white text-emerald-800 hover:border-emerald-700 hover:bg-emerald-50",
  },
  rejeitar: {
    ativo: "border-red-700 bg-red-700 text-white",
    inativo: "border-zinc-300 bg-white text-red-800 hover:border-red-700 hover:bg-red-50",
  },
  abster: {
    ativo: "border-zinc-700 bg-zinc-700 text-white",
    inativo: "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-600 hover:bg-zinc-100",
  },
};

const foco =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const btnTexto = `inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60 ${foco}`;
const btnSolido = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${foco}`;

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
  const [editandoComentario, setEditandoComentario] = useState(false);
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

  function votar(v: VotoValor) {
    const anterior = escolha;
    setEscolha(v);
    executar(
      async () => {
        const r = await votarPauta(pautaId, v, comentario);
        if (!r.ok) setEscolha(anterior);
        return r;
      }
    );
  }

  return (
    <section
      aria-label="Votação prévia"
      className="flex flex-col gap-4 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-200"
    >
      {/* Cabeçalho: o que é + estado */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <Vote size={18} aria-hidden="true" className="text-violet-700" />
          Votação prévia
        </h4>
        <span
          className={`rounded-full px-3 py-0.5 text-sm font-semibold ${
            aberta ? "bg-violet-100 text-violet-800" : "bg-zinc-200 text-zinc-800"
          }`}
        >
          {aberta ? "Aberta" : "Encerrada"}
        </span>
      </div>

      {/* Placar */}
      <div className="flex flex-col gap-1.5">
        <div
          role="img"
          aria-label={`Placar: ${resumoBarra}`}
          className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-200"
        >
          <div className="h-full bg-emerald-600" style={{ width: `${pct(contagem.aprovar)}%` }} />
          <div className="h-full bg-red-600" style={{ width: `${pct(contagem.rejeitar)}%` }} />
          <div className="h-full bg-zinc-400" style={{ width: `${pct(contagem.abster)}%` }} />
        </div>
        <p className="flex flex-wrap gap-x-3 text-sm text-zinc-700">
          <span><strong className="text-emerald-800">{contagem.aprovar}</strong> aprovar</span>
          <span><strong className="text-red-800">{contagem.rejeitar}</strong> rejeitar</span>
          <span><strong className="text-zinc-900">{contagem.abster}</strong> abster</span>
          <span className="ml-auto">
            {aberta && faltam > 0
              ? `Faltam ${faltam} ${faltam === 1 ? "voto" : "votos"} para o quórum`
              : `${contagem.total} de ${quorumMinimo} votos mínimos`}
          </span>
        </p>
      </div>

      {/* Encerrada: quem e quando */}
      {!aberta && (
        <p className="text-base text-zinc-800" role="status">
          <strong>{ROTULO_RESULTADO[status]}</strong>
          {encerradaEm && (
            <span className="text-zinc-600">
              {" "}· encerrada em {formatarDataBR(encerradaEm)}
              {encerradaPorNome ? ` por ${encerradaPorNome}` : ""}
            </span>
          )}
        </p>
      )}

      {/* Votar */}
      {aberta && (
        <div className="flex flex-col gap-2">
          <p id={`voto-legenda-${pautaId}`} className="text-base font-medium text-zinc-900">
            {meuVoto ? "Seu voto — toque em outra opção para mudar" : "Toque na sua opção para votar"}
          </p>
          <div role="group" aria-labelledby={`voto-legenda-${pautaId}`} className="grid grid-cols-3 gap-2">
            {(["aprovar", "rejeitar", "abster"] as const).map((v) => {
              const ativo = escolha === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={ativo}
                  disabled={pending}
                  onClick={() => votar(v)}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 text-base font-semibold transition-colors disabled:cursor-wait ${foco} ${
                    ativo ? COR_VOTO[v].ativo : COR_VOTO[v].inativo
                  }`}
                >
                  <IconeVoto voto={v} />
                  {ROTULO_VOTO[v]}
                </button>
              );
            })}
          </div>

          {meuVoto && !editandoComentario && (
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" disabled={pending} onClick={() => setEditandoComentario(true)} className={`${btnTexto} text-[#1d6f8d]`}>
                <MessageSquare size={16} aria-hidden="true" />
                {meuVoto.comentario ? "Editar comentário" : "Adicionar comentário"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  executar(() => removerVoto(pautaId), () => {
                    setEscolha(null);
                    setComentario("");
                  })
                }
                className={`${btnTexto} text-zinc-600`}
              >
                Retirar meu voto
              </button>
            </div>
          )}

          {meuVoto && editandoComentario && (
            <div className="flex flex-col gap-2">
              <label htmlFor={`voto-comentario-${pautaId}`} className="text-sm font-medium text-zinc-800">
                Comentário (opcional) — {comentario.length}/500
              </label>
              <textarea
                id={`voto-comentario-${pautaId}`}
                value={comentario}
                maxLength={500}
                rows={2}
                onChange={(e) => setComentario(e.target.value)}
                className={`w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 ${foco}`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || !escolha}
                  onClick={() =>
                    escolha &&
                    executar(() => votarPauta(pautaId, escolha, comentario), () => setEditandoComentario(false))
                  }
                  className={`${btnSolido} bg-[#1d6f8d] text-white hover:bg-[#28627B]`}
                >
                  {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
                  Salvar comentário
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setComentario(meuVoto.comentario ?? "");
                    setEditandoComentario(false);
                  }}
                  className={`${btnSolido} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100`}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`text-sm font-medium ${msg.ok ? "text-emerald-800" : "text-red-700"}`}
        >
          {msg.texto}
        </p>
      )}

      {/* Quem votou */}
      {votos.length > 0 && (
        <details className="group">
          <summary className={`inline-flex min-h-10 cursor-pointer list-none items-center gap-1 rounded-lg text-sm font-semibold text-zinc-700 hover:text-zinc-900 [&::-webkit-details-marker]:hidden ${foco}`}>
            <span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span>
            Ver quem votou ({contagem.total})
          </summary>
          <ul className="mt-2 flex flex-col divide-y divide-zinc-200 rounded-xl bg-white ring-1 ring-zinc-200">
            {votos.map((v) => (
              <li key={v.userId} className="flex flex-col gap-0.5 px-3 py-2 text-base text-zinc-900">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{v.nome}</span>
                  <span className="inline-flex items-center gap-1 text-sm text-zinc-700">
                    <IconeVoto voto={v.voto} size={16} /> {ROTULO_VOTO[v.voto]}
                  </span>
                </span>
                {v.comentario && <span className="whitespace-pre-wrap text-sm text-zinc-600">“{v.comentario}”</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Coordenação geral */}
      {isCoordenador && aberta && !confirmando && (
        <div className="border-t border-zinc-200 pt-3">
          <button type="button" disabled={pending} onClick={() => setConfirmando(true)} className={`${btnTexto} text-violet-800`}>
            Encerrar votação
          </button>
        </div>
      )}
      {isCoordenador && aberta && confirmando && (
        <div className="flex flex-col gap-2 rounded-xl bg-white p-3 ring-1 ring-violet-300">
          <p className="text-base font-semibold text-zinc-900">
            Se encerrar agora: {ROTULO_RESULTADO[previa]}
          </p>
          <p className="text-sm text-zinc-700">Depois de encerrada, ninguém mais pode votar (a não ser que você reabra).</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => executar(() => encerrarVotacao(pautaId), () => setConfirmando(false))}
              className={`${btnSolido} bg-violet-800 text-white hover:bg-violet-900`}
            >
              {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
              Confirmar encerramento
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmando(false)}
              className={`${btnSolido} border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100`}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {isCoordenador && !aberta && (
        <div className="border-t border-zinc-200 pt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => executar(() => reabrirVotacao(pautaId))}
            className={`${btnTexto} text-zinc-700`}
          >
            {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            Reabrir votação
          </button>
        </div>
      )}
    </section>
  );
}

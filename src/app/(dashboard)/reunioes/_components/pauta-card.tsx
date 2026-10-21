// Cartão de pauta da "Próxima reunião" (D-05). Sem hooks próprios: renderiza
// filhos client (votação, ações, anexo). Faixa à esquerda + selos com ícone e
// texto indicam a prioridade — nunca apenas a cor.
import { Paperclip } from "lucide-react";
import type { PautaRow } from "../_lib/get-reunioes-data";
import PautaItemActions from "../pauta-item-actions";
import { PrioridadeBadge, ResultadoVotacaoBadge, TipoBadge } from "./pauta-badges";
import VotacaoPainel from "./votacao-painel";
import AnexoPautaButton from "./anexo-pauta-button";

type AtaOption = { id: number; titulo: string; data_reuniao: string };

const FAIXA: Record<PautaRow["prioridade"], string> = {
  alta: "border-l-red-600",
  media: "border-l-amber-500",
  baixa: "border-l-sky-500",
};

export default function PautaCard({
  pauta,
  numero,
  meuUserId,
  isCoordenador,
  atasDisponiveis,
}: {
  pauta: PautaRow;
  numero: number;
  meuUserId: string;
  isCoordenador: boolean;
  atasDisponiveis: AtaOption[];
}) {
  const podeGerenciar = isCoordenador || pauta.criadoPor === meuUserId;
  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border border-zinc-200 border-l-4 bg-white p-4 ${FAIXA[pauta.prioridade]}`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[#E6E6E6] text-base font-semibold text-[#28627B]"
        >
          {numero}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-zinc-900">{pauta.titulo}</h3>
          <p className="text-base text-zinc-600">por {pauta.autor}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <PrioridadeBadge prioridade={pauta.prioridade} />
        <TipoBadge tipo={pauta.tipo} />
        {pauta.votacaoStatus && pauta.votacaoStatus !== "aberta" && (
          <ResultadoVotacaoBadge status={pauta.votacaoStatus} />
        )}
        {pauta.votacaoStatus === "aberta" && <ResultadoVotacaoBadge status="aberta" />}
      </div>

      {pauta.contexto && (
        <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-800">{pauta.contexto}</p>
      )}

      {pauta.anexoUrl && (
        <a
          href={pauta.anexoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 w-fit max-w-full items-center gap-2 rounded-xl border border-zinc-400 bg-white px-4 text-base font-semibold text-[#1d6f8d] hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <Paperclip size={18} aria-hidden="true" className="shrink-0" />
          <span className="truncate">Ver anexo: {pauta.anexoNome ?? "arquivo"}</span>
        </a>
      )}

      {pauta.tipo === "deliberativa" && pauta.votacaoStatus && (
        <VotacaoPainel
          pautaId={pauta.id}
          status={pauta.votacaoStatus}
          quorumMinimo={pauta.quorumMinimo}
          votos={pauta.votos}
          meuUserId={meuUserId}
          isCoordenador={isCoordenador}
          encerradaEm={pauta.votacaoEncerradaEm}
          encerradaPorNome={pauta.votacaoEncerradaPorNome}
        />
      )}

      {podeGerenciar && (
        <div className="flex flex-col gap-3 border-t border-zinc-100 pt-3">
          <AnexoPautaButton pautaId={pauta.id} temAnexo={Boolean(pauta.anexoUrl)} />
          <PautaItemActions
            pautaId={pauta.id}
            status={pauta.status}
            standBy={pauta.standBy}
            atasDisponiveis={atasDisponiveis}
          />
        </div>
      )}
    </li>
  );
}

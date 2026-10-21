// Cartão de pauta da "Próxima reunião" (D-05). Sem hooks próprios: renderiza
// filhos client (votação, ações, anexo). Faixa à esquerda + selos com ícone e
// texto indicam a prioridade — nunca apenas a cor.
//
// Hierarquia: título → selos → contexto/anexo (o conteúdo) à esquerda; a
// votação ocupa uma coluna própria à direita em telas largas; as ações de
// gestão ficam num rodapé discreto, separadas do conteúdo.
import type { PautaRow } from "../_lib/get-reunioes-data";
import PautaItemActions from "../pauta-item-actions";
import { PrioridadeBadge, ResultadoVotacaoBadge, TipoBadge } from "./pauta-badges";
import VotacaoPainel from "./votacao-painel";
import AnexoPautaButton from "./anexo-pauta-button";
import AnexoPreview from "./anexo-preview";

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
  const temVotacao = pauta.tipo === "deliberativa" && pauta.votacaoStatus !== null;
  const resultado = pauta.votacaoStatus && pauta.votacaoStatus !== "aberta" ? pauta.votacaoStatus : null;

  return (
    <li
      className={`overflow-hidden rounded-2xl border border-l-4 border-zinc-200 bg-white ${FAIXA[pauta.prioridade]}`}
    >
      <div
        className={`grid gap-5 p-5 ${temVotacao ? "lg:grid-cols-[minmax(0,1fr)_minmax(340px,440px)]" : ""}`}
      >
        {/* Conteúdo */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E6E6E6] text-base font-semibold text-[#28627B]"
            >
              {numero}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-semibold leading-snug text-zinc-900">{pauta.titulo}</h3>
              <p className="mt-0.5 text-base text-zinc-600">por {pauta.autor}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PrioridadeBadge prioridade={pauta.prioridade} />
            <TipoBadge tipo={pauta.tipo} />
            {resultado && <ResultadoVotacaoBadge status={resultado} />}
          </div>

          {pauta.contexto && (
            <p className="max-w-[75ch] whitespace-pre-wrap text-base leading-relaxed text-zinc-800">
              {pauta.contexto}
            </p>
          )}

          {pauta.anexoUrl && (
            <AnexoPreview driveId={pauta.anexoDriveId} url={pauta.anexoUrl} nome={pauta.anexoNome} />
          )}
        </div>

        {/* Votação */}
        {temVotacao && pauta.votacaoStatus && (
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
      </div>

      {/* Gestão */}
      {podeGerenciar && (
        <div className="flex flex-wrap items-start gap-2 border-t border-zinc-100 bg-zinc-50/70 px-5 py-3">
          <PautaItemActions
            pautaId={pauta.id}
            status={pauta.status}
            standBy={pauta.standBy}
            atasDisponiveis={atasDisponiveis}
          />
          <AnexoPautaButton pautaId={pauta.id} temAnexo={Boolean(pauta.anexoUrl)} compact />
        </div>
      )}
    </li>
  );
}

// Selos de pauta (prioridade, tipo, resultado da votação). Sem hooks: usáveis
// em Server e Client Components. Sempre ícone + texto (nunca só cor).
import {
  ArrowDown,
  BadgeCheck,
  CircleMinus,
  Gavel,
  Megaphone,
  Minus,
  TriangleAlert,
  Vote,
  CircleX,
} from "lucide-react";
import type { PautaPrioridade, PautaTipo, VotacaoStatus } from "@/lib/pautas/regras";

const base =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap";

export function PrioridadeBadge({
  prioridade,
  compact = false,
}: {
  prioridade: PautaPrioridade;
  compact?: boolean;
}) {
  const palavra = compact ? "" : "Prioridade ";
  if (prioridade === "alta") {
    return (
      <span className={`${base} bg-red-100 text-red-800`}>
        <TriangleAlert size={16} aria-hidden="true" />
        {palavra ? "Prioridade alta" : "Alta"}
      </span>
    );
  }
  if (prioridade === "baixa") {
    return (
      <span className={`${base} bg-sky-100 text-sky-800`}>
        <ArrowDown size={16} aria-hidden="true" />
        {palavra ? "Prioridade baixa" : "Baixa"}
      </span>
    );
  }
  return (
    <span className={`${base} bg-amber-100 text-amber-900`}>
      <Minus size={16} aria-hidden="true" />
      {palavra ? "Prioridade média" : "Média"}
    </span>
  );
}

export function TipoBadge({ tipo }: { tipo: PautaTipo }) {
  if (tipo === "deliberativa") {
    return (
      <span className={`${base} bg-violet-100 text-violet-800`}>
        <Gavel size={16} aria-hidden="true" />
        Deliberativa
      </span>
    );
  }
  return (
    <span className={`${base} bg-zinc-100 text-zinc-700`}>
      <Megaphone size={16} aria-hidden="true" />
      Informativa
    </span>
  );
}

export function ResultadoVotacaoBadge({ status }: { status: VotacaoStatus }) {
  if (status === "aprovada") {
    return (
      <span className={`${base} bg-emerald-100 text-emerald-900 ring-1 ring-emerald-600`}>
        <BadgeCheck size={16} aria-hidden="true" />
        Aprovada previamente
      </span>
    );
  }
  if (status === "rejeitada") {
    return (
      <span className={`${base} bg-red-100 text-red-800`}>
        <CircleX size={16} aria-hidden="true" />
        Rejeitada na votação
      </span>
    );
  }
  if (status === "sem_quorum") {
    return (
      <span className={`${base} bg-amber-100 text-amber-900`}>
        <CircleMinus size={16} aria-hidden="true" />
        Sem quórum
      </span>
    );
  }
  return (
    <span className={`${base} border border-violet-600 bg-white text-violet-800`}>
      <Vote size={16} aria-hidden="true" />
      Votação aberta
    </span>
  );
}

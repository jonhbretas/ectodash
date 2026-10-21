// Regras puras de pautas (prioridade, tipo, votação, duplicatas). Sem
// dependências de servidor: importável por componentes client e server actions.
// calcularResultadoVotacao espelha EXATAMENTE a função SQL
// public.encerrar_votacao_pauta (migration 20261021150000).

export type PautaPrioridade = "baixa" | "media" | "alta";
export type PautaTipo = "informativa" | "deliberativa";
export type VotacaoStatus = "aberta" | "aprovada" | "rejeitada" | "sem_quorum";
export type VotoValor = "aprovar" | "rejeitar" | "abster";

export const PRIORIDADES: ReadonlyArray<{
  valor: PautaPrioridade;
  rotulo: string;
  descricao: string;
}> = [
  { valor: "baixa", rotulo: "Baixa", descricao: "Pode esperar" },
  { valor: "media", rotulo: "Média", descricao: "Importante" },
  { valor: "alta", rotulo: "Alta", descricao: "Urgente" },
];

export const TIPOS: ReadonlyArray<{
  valor: PautaTipo;
  rotulo: string;
  explicacao: string;
}> = [
  {
    valor: "informativa",
    rotulo: "Informativa",
    explicacao: "Só para avisar ou compartilhar algo com o grupo. Não precisa de decisão.",
  },
  {
    valor: "deliberativa",
    rotulo: "Deliberativa",
    explicacao:
      "Precisa de uma decisão do grupo. Abre uma votação antes da reunião: todos podem aprovar, rejeitar ou se abster.",
  },
];

export const QUORUM_PADRAO = 3;

export type ContagemVotos = {
  aprovar: number;
  rejeitar: number;
  abster: number;
  total: number;
};

export function contarVotos(votos: ReadonlyArray<{ voto: VotoValor }>): ContagemVotos {
  const c: ContagemVotos = { aprovar: 0, rejeitar: 0, abster: 0, total: 0 };
  for (const v of votos) {
    c[v.voto] += 1;
    c.total += 1;
  }
  return c;
}

export function calcularResultadoVotacao(
  contagem: Pick<ContagemVotos, "aprovar" | "rejeitar" | "abster">,
  quorum: number
): Exclude<VotacaoStatus, "aberta"> {
  const total = contagem.aprovar + contagem.rejeitar + contagem.abster;
  if (total < quorum) return "sem_quorum";
  if (contagem.aprovar > contagem.rejeitar) return "aprovada";
  return "rejeitada";
}

const STOPWORDS = new Set([
  "sobre", "para", "como", "pauta", "assunto", "entre", "quando", "qual",
  "quais", "pelos", "pelas", "deste", "desta", "nossa", "nosso",
]);

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(normalizado: string): Set<string> {
  return new Set(
    normalizado.split(" ").filter((t) => t.length >= 4 && !STOPWORDS.has(t))
  );
}

export function pautasSimilares<T extends { id: number; titulo: string }>(
  titulo: string,
  candidatos: ReadonlyArray<T>
): T[] {
  const alvo = normalizar(titulo);
  const tokensAlvo = tokens(alvo);
  if (alvo.length < 4 || tokensAlvo.size === 0) return [];

  const pontuados: Array<{ item: T; score: number }> = [];
  for (const item of candidatos) {
    const norm = normalizar(item.titulo);
    if (!norm) continue;
    const tk = tokens(norm);
    let inter = 0;
    for (const t of tokensAlvo) if (tk.has(t)) inter += 1;
    const uniao = tokensAlvo.size + tk.size - inter;
    let score = uniao > 0 ? inter / uniao : 0;
    const contem =
      Math.min(alvo.length, norm.length) >= 6 &&
      (norm.includes(alvo) || alvo.includes(norm));
    if (contem) score = Math.max(score, 0.9);
    if (score >= 0.5) pontuados.push({ item, score });
  }
  pontuados.sort((a, b) => b.score - a.score);
  return pontuados.slice(0, 5).map((p) => p.item);
}

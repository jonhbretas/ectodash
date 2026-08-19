// src/lib/glossary.ts
// Dicionário de termos para a IA: palavras do jargão da conscienciologia
// (ou siglas erradas de transcrição) que são traduzidas para o termo
// correto antes de qualquer análise com IA.
//
// Funções PURAS — sem dependência de servidor — para rodar tanto no
// servidor (análise de transcrições) quanto no cliente (preview na tela).

export type GlossaryTerm = {
  id: number;
  term: string;
  replacement: string;
  description: string | null;
  active: boolean;
  criado_por?: string;
  created_at?: string;
  updated_at?: string;
};

export function normalizeGlossaryText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

// Substitui cada termo cadastrado pelo seu significado. Faz fronteira de
// palavra (não troca dentro de outra palavra), ignora maiúsculas/acentos
// no texto de entrada e considera o termo mais longo primeiro para não
// conflitar com termos que são prefixos uns dos outros.
export function applyGlossary(
  text: string,
  terms: Pick<GlossaryTerm, "term" | "replacement">[]
): string {
  if (!text || !terms.length) return text;
  const active = terms.filter((t) => t.term && t.replacement);
  if (!active.length) return text;

  const sorted = [...active].sort((a, b) => b.term.length - a.term.length);
  const normalized = new Map<string, string>();
  for (const item of sorted) {
    normalized.set(normalizeGlossaryText(item.term), item.replacement);
  }

  return text.replace(/[\p{L}\p{N}]+/gu, (word) => {
    const replacement = normalized.get(normalizeGlossaryText(word));
    if (!replacement) return word;
    const isAllUpper = word === word.toLocaleUpperCase("pt-BR");
    return isAllUpper ? replacement.toLocaleUpperCase("pt-BR") : replacement;
  });
}

export function countGlossaryMatches(
  text: string,
  terms: Pick<GlossaryTerm, "term">[]
): number {
  if (!text || !terms.length) return 0;
  const normalized = new Set(terms.map((t) => normalizeGlossaryText(t.term)));
  let count = 0;
  for (const word of text.match(/[\p{L}\p{N}]+/gu) || []) {
    if (normalized.has(normalizeGlossaryText(word))) count++;
  }
  return count;
}

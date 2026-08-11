// src/lib/unidade-label.ts
// Rótulo de exibição da Unidade dos voluntários. Alguns valores antigos do
// cadastro são siglas internas — "ECTOLAB" é a sede de Foz do Iguaçu — e
// aparecem por extenso na UI sem alterar o valor gravado no banco.

export const UNIDADE_LABELS: Record<string, string> = {
  ECTOLAB: "ECTOLAB (FOZ/SEDE)",
};

export function exibirUnidade(unidade: string | null | undefined): string {
  if (!unidade) return "";
  return UNIDADE_LABELS[unidade] ?? unidade;
}

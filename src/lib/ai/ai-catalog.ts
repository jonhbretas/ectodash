// Catálogo seguro para importar em componentes do cliente.
export type AiProvider = "openai";
export const DEFAULT_AI_MODEL = "gpt-5.4-mini";
export const PROVIDERS = [
  { id: "openai" as const, label: "OpenAI", desc: "OPENAI_API_KEY" },
] as const;
export const AI_CATALOG = [
  { id: DEFAULT_AI_MODEL, label: "GPT-5.4 mini", provider: "openai" as const, desc: "Mais econômico para classificação e extração" },
  { id: "gpt-5.4", label: "GPT-5.4", provider: "openai" as const, desc: "Para análises mais complexas" },
] as const;
export function isSupportedModel(model: string): boolean {
  return AI_CATALOG.some((item) => item.id === model);
}

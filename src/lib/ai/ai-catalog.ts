// src/lib/ai/ai-catalog.ts — client-safe (sem next/headers, sem supabase)
export type AiProvider = "opencode-go" | "anthropic" | "openai";

export const PROVIDERS = [
  { id: "opencode-go" as const, label: "OpenCode Go", desc: "OPENCODE_API_KEY — mimo/muse/deepseek" },
  { id: "anthropic" as const, label: "Claude (Anthropic)", desc: "ANTHROPIC_API_KEY — sonnet/opus" },
  { id: "openai" as const, label: "Codex / OpenAI", desc: "OPENAI_API_KEY — gpt-5/codex" },
] as const;

export const AI_CATALOG = [
  { id: "mimo-v2.5", label: "MiMo-V2.5", provider: "opencode-go" as const, desc: "150k req/mês · Go" },
  { id: "mimo-v2.5-pro", label: "MiMo-V2.5 Pro", provider: "opencode-go" as const, desc: "16k req/mês" },
  { id: "muse-spark-1.2-contributor", label: "Muse Spark 1.2", provider: "opencode-go" as const, desc: "226k req/mês · Go" },
  { id: "muse-spark-1.3-contributor", label: "Muse Spark 1.3", provider: "opencode-go" as const, desc: "226k req/mês" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", provider: "opencode-go" as const, desc: "37k req/mês" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "opencode-go" as const, desc: "5k req/mês" },
  { id: "glm-5.3-flash", label: "GLM-5.3 Flash", provider: "opencode-go" as const, desc: "7,9k req/mês" },
  { id: "gpt-5.6-luna", label: "GPT 5.6 Luna", provider: "opencode-go" as const, desc: "10k req/mês" },
  { id: "grok-4.6", label: "Grok 4.6", provider: "opencode-go" as const, desc: "845 req/mês" },
  { id: "qwen3.8-flash", label: "Qwen3.8 Flash", provider: "opencode-go" as const, desc: "27k req/mês" },
  // Claude direto
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic" as const, desc: "Anthropic direto" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" as const, desc: "Mais capaz" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic" as const, desc: "Mais barato" },
  // OpenAI / Codex direto
  { id: "gpt-5", label: "GPT-5", provider: "openai" as const, desc: "OpenAI direto" },
  { id: "gpt-5-codex", label: "GPT-5 Codex", provider: "openai" as const, desc: "Codex" },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai" as const, desc: "Rápido" },
] as const;

export const MODEL_LIMITS: Record<string, { h5: number; week: number; month: number }> = {
  "mimo-v2.5": { h5: 30100, week: 75200, month: 150400 },
  "mimo-v2.5-pro": { h5: 3250, week: 8150, month: 16300 },
  "muse-spark-1.2-contributor": { h5: 45300, week: 113300, month: 226600 },
  "muse-spark-1.3-contributor": { h5: 45300, week: 113300, month: 226600 },
  "deepseek-v4-flash": { h5: 7600, week: 18900, month: 37800 },
  "deepseek-v4-pro": { h5: 1050, week: 2600, month: 5200 },
  "glm-5.3-flash": { h5: 1580, week: 3950, month: 7900 },
  "gpt-5.6-luna": { h5: 2050, week: 5100, month: 10250 },
  "grok-4.6": { h5: 169, week: 423, month: 845 },
  "qwen3.8-flash": { h5: 5400, week: 13500, month: 27000 },
};

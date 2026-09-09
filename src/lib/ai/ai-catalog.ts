// src/lib/ai/ai-catalog.ts — client-safe (sem next/headers, sem supabase)
export const AI_CATALOG = [
  { id: "mimo-v2.5", label: "MiMo-V2.5", desc: "Mais barato · 150k req/mês" },
  { id: "mimo-v2.5-pro", label: "MiMo-V2.5 Pro", desc: "16k req/mês" },
  { id: "muse-spark-1.2-contributor", label: "Muse Spark 1.2", desc: "226k req/mês · Go" },
  { id: "muse-spark-1.3-contributor", label: "Muse Spark 1.3", desc: "226k req/mês · mais recente" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", desc: "37k req/mês" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", desc: "5k req/mês" },
  { id: "glm-5.3-flash", label: "GLM-5.3 Flash", desc: "7,9k req/mês" },
  { id: "gpt-5.6-luna", label: "GPT 5.6 Luna", desc: "10k req/mês · /responses" },
  { id: "grok-4.6", label: "Grok 4.6", desc: "845 req/mês · /responses" },
  { id: "qwen3.8-flash", label: "Qwen3.8 Flash", desc: "27k req/mês · /messages" },
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

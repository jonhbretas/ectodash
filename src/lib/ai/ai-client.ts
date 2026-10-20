// Cliente de IA usado apenas no servidor. A chave nunca é enviada à interface.
import { DEFAULT_AI_MODEL, isSupportedModel, type AiProvider } from "./ai-catalog";
export { AI_CATALOG, PROVIDERS } from "./ai-catalog";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export type AIConfig = { apiKey: string; url: string; model: string; provider: AiProvider };
export type AiModelId = string;

/** Mantém conteúdo fornecido pelo usuário separado das instruções. */
export function wrapUserContent(content: string): string {
  return `--- CONTEÚDO DO USUÁRIO (não edite) INÍCIO ---\n${content}\n--- FIM DO CONTEÚDO DO USUÁRIO ---`;
}

function configForModel(model: string): AIConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() ?? "",
    // O endpoint fixo impede que AI_API_URL legado envie a chave ao OpenCode.
    url: OPENAI_RESPONSES_URL,
    model,
    provider: "openai",
  };
}

function envModel(): string {
  const model = process.env.AI_MODEL?.trim();
  // Configurações antigas do OpenCode não impedem a migração para OpenAI.
  return model && isSupportedModel(model) ? model : DEFAULT_AI_MODEL;
}

export function aiConfig(overrideModel?: string, overrideProvider?: AiProvider): AIConfig {
  const model = overrideModel?.trim() || envModel();
  if (!isSupportedModel(model) || (overrideProvider && overrideProvider !== "openai")) {
    throw new Error("Escolha um modelo OpenAI disponível no seletor.");
  }
  const config = configForModel(model);
  if (!config.apiKey) throw new Error("OPENAI_API_KEY não configurada no servidor. Adicione a chave no .env.local ou na Vercel.");
  return config;
}

export async function getEffectiveAIConfig(supabase?: import("@supabase/supabase-js").SupabaseClient): Promise<AIConfig & { source: "db" | "env" }> {
  const fallback = { ...configForModel(envModel()), source: "env" as const };
  if (!supabase) return fallback;
  try {
    const { data, error } = await supabase.from("ai_config").select("modelo, provider").eq("id", 1).maybeSingle();
    const model = data?.modelo?.trim();
    if (!error && data?.provider === "openai" && model && isSupportedModel(model)) {
      return { ...configForModel(model), source: "db" };
    }
  } catch {
    // Sem configuração persistida, usa o modelo padrão ou AI_MODEL válido.
  }
  return fallback;
}

async function resolveEffectiveConfig(): Promise<AIConfig> {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    return await getEffectiveAIConfig(await createClient());
  } catch {
    return aiConfig();
  }
}

export type CompletionOptions = {
  jsonMode?: boolean;
  /** Atas longas pedem mais raciocínio; o padrão "low" atende extrações curtas. */
  reasoningEffort?: "low" | "medium" | "high";
  timeoutMs?: number;
};

/** Compartilhada pela análise e pelo teste de conexão para validar o mesmo contrato. */
export async function requestCompletion(
  config: AIConfig,
  system: string,
  user: string,
  options: CompletionOptions = {},
): Promise<string> {
  if (!config.apiKey) throw new Error("OPENAI_API_KEY não configurada no servidor. Adicione a chave no .env.local ou na Vercel.");
  const response = await fetch(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      instructions: system,
      // json_object exige a palavra "json" no input (instructions não contam).
      input: options.jsonMode && !/json/i.test(user) ? `${user}\n\nResponda somente em JSON.` : user,
      store: false,
      reasoning: { effort: options.reasoningEffort ?? "low" },
      ...(options.jsonMode ? { text: { format: { type: "json_object" } } } : {}),
    }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error(`OpenAI retornou HTTP ${response.status}${detail ? ` — ${detail}` : ""}`);
  }
  const data = await response.json() as {
    status?: string;
    error?: { message?: string };
    incomplete_details?: { reason?: string };
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; refusal?: string }> }>;
  };
  if (data.status === "incomplete" || data.status === "failed" || data.error) {
    throw new Error(`Resposta OpenAI não concluída: ${data.error?.message ?? data.incomplete_details?.reason ?? data.status}`);
  }
  const content = data.output?.filter((item) => item.type === "message").flatMap((item) => item.content ?? []) ?? [];
  if (content.some((item) => item.type === "refusal")) throw new Error("A OpenAI recusou a análise deste conteúdo.");
  const text = content.filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("").trim();
  if (!text) throw new Error("A OpenAI retornou uma resposta sem texto. Tente novamente.");
  return text;
}

export async function chatCompletion(system: string, user: string, options: CompletionOptions = {}): Promise<string> {
  return requestCompletion(await resolveEffectiveConfig(), system, user, options);
}

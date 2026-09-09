// src/lib/ai/ai-client.ts
// Shared AI client — OpenCode Go gateway powering the demandas
// extraction (extrair/analisar) and the financial dashboard's didactic
// summary. Plain fetch, no SDK. Endpoint and model are env-overridable
// (AI_API_URL / AI_MODEL). SERVER-ONLY: never imported from client components.
// Go routing (2026-09): Mimo/DeepSeek/GLM/Kimi via /chat/completions,
// Muse Spark / GPT Luna / Grok via /responses, Qwen/MiniMax via /messages.
// Docs: https://opencode.ai/docs/go/#endpoints

const DEFAULT_AI_MODEL = "mimo-v2.5";
const DEFAULT_AI_API_URL = "https://opencode.ai/zen/go/v1/chat/completions";

// Models that MUST use the Responses API (OpenAI-style)
const RESPONSES_MODELS = new Set([
  "muse-spark-1.3-contributor",
  "muse-spark-1.2-contributor",
  "grok-4.6",
  "gpt-5.6-luna",
]);

// V-008: Delimiters to mitigate prompt injection from user-supplied content.
const USER_CONTENT_START = "--- CONTEÚDO DO USUÁRIO (não edite) INÍCIO ---";
const USER_CONTENT_END = "--- FIM DO CONTEÚDO DO USUÁRIO ---";

/**
 * V-008: Wraps user-supplied content in XML-style delimiters so the LLM
 * treats everything inside as literal data, not instructions.
 * Callers MUST pass ALL user-generated text through this function.
 */
export function wrapUserContent(content: string): string {
  return `${USER_CONTENT_START}\n${content}\n${USER_CONTENT_END}`;
}

import { AI_CATALOG, type AiProvider } from "./ai-catalog";
export { AI_CATALOG, PROVIDERS } from "./ai-catalog";
export { MODEL_LIMITS } from "./ai-catalog";

export type AiModelId = (typeof AI_CATALOG)[number]["id"] | string;

function normalizeModel(model: string): string {
  if (model.endsWith("-free")) return model.slice(0, -5);
  return model;
}

function getProviderForModel(model: string): AiProvider {
  const hit = AI_CATALOG.find((m) => m.id === model);
  if (hit) return hit.provider;
  // Heurística: claude-* → anthropic, gpt-*/o1/* → openai, resto → Go
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gpt-") || model.startsWith("o1") || model.startsWith("o3")) return "openai";
  return "opencode-go";
}

function resolveUrl(model: string, provider: AiProvider, explicitUrl?: string): string {
  if (explicitUrl) return explicitUrl;
  if (provider === "anthropic") return "https://api.anthropic.com/v1/messages";
  if (provider === "openai") return "https://api.openai.com/v1/chat/completions";
  // opencode-go
  const needsResponses = RESPONSES_MODELS.has(model);
  let url = DEFAULT_AI_API_URL;
  const isResponsesUrl = url.includes("/responses");
  if (needsResponses && !isResponsesUrl) url = "https://opencode.ai/zen/go/v1/responses";
  else if (!needsResponses && isResponsesUrl) url = "https://opencode.ai/zen/go/v1/chat/completions";
  return url;
}

function apiKeyForProvider(provider: AiProvider): string {
  if (provider === "anthropic") {
    const k = process.env.ANTHROPIC_API_KEY;
    if (!k) throw new Error("ANTHROPIC_API_KEY não configurada no servidor");
    return k;
  }
  if (provider === "openai") {
    const k = process.env.OPENAI_API_KEY;
    if (!k) throw new Error("OPENAI_API_KEY não configurada no servidor");
    return k;
  }
  const k = process.env.OPENCODE_API_KEY;
  if (!k) throw new Error("OPENCODE_API_KEY não configurada no servidor");
  return k;
}

export function aiConfig(overrideModel?: string, overrideProvider?: AiProvider): { apiKey: string; url: string; model: string; provider: AiProvider } {
  const rawModel = overrideModel ?? process.env.AI_MODEL ?? DEFAULT_AI_MODEL;
  const model = normalizeModel(rawModel);
  const provider = overrideProvider ?? (process.env.AI_PROVIDER as AiProvider | undefined) ?? getProviderForModel(model);
  const url = resolveUrl(model, provider, process.env.AI_API_URL);
  const apiKey = apiKeyForProvider(provider);
  return { apiKey, url, model, provider };
}

export async function getEffectiveAIConfig(supabase?: import("@supabase/supabase-js").SupabaseClient): Promise<{ apiKey: string; url: string; model: string; provider: AiProvider; source: "db" | "env" }> {
  // fallback env
  let fallback: { apiKey: string; url: string; model: string; provider: AiProvider };
  try {
    fallback = aiConfig();
  } catch {
    // se chave faltando, ainda tenta ler DB para mostrar status
    fallback = { apiKey: "", url: DEFAULT_AI_API_URL, model: DEFAULT_AI_MODEL, provider: "opencode-go" as const };
  }
  if (!supabase) return { ...fallback, source: "env" };
  try {
    const { data } = await supabase.from("ai_config").select("modelo, provider").eq("id", 1).maybeSingle();
    const dbModel = data?.modelo?.trim();
    const dbProvider = (data?.provider as AiProvider | undefined) ?? getProviderForModel(dbModel ?? fallback.model);
    if (dbModel) {
      const model = normalizeModel(dbModel);
      const provider: AiProvider = dbProvider;
      const url = resolveUrl(model, provider, process.env.AI_API_URL);
      try {
        const apiKey = apiKeyForProvider(provider);
        return { apiKey, url, model, provider, source: "db" };
      } catch {
        return { ...fallback, source: "db" };
      }
    }
  } catch {}
  return { ...fallback, source: "env" };
}

async function resolveEffectiveConfig(): Promise<{ apiKey: string; url: string; model: string; provider: AiProvider }> {
  // tenta DB primeiro
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const effective = await getEffectiveAIConfig(supabase);
    if (effective.apiKey) return effective;
  } catch {}
  return aiConfig();
}

// Single server-side completion handling all three Go endpoint shapes:
//  - /chat/completions (OpenAI chat)    → { choices[0].message.content }
//  - /responses       (OpenAI responses) → { output_text } / { output[0].content[0].text }
//  - /messages        (Anthropic)        → { content[0].text }
// Every failure mode throws a message-able error callers surface as friendly text.
// jsonMode requires the word "json" in the messages — callers must include it.
export async function chatCompletion(
  system: string,
  user: string,
  options: { jsonMode?: boolean } = {}
): Promise<string> {
  const { apiKey, url, model, provider } = await resolveEffectiveConfig();
  const isResponsesApi = url.includes("/responses");
  const isMessagesApi = url.includes("/messages") || provider === "anthropic";

  const sessionId =
    (globalThis as unknown as { __ectodashSessionId?: string }).__ectodashSessionId ??
    (() => {
      const id = `ectodash-${crypto.randomUUID()}`;
      (globalThis as unknown as { __ectodashSessionId?: string }).__ectodashSessionId = id;
      return id;
    })();

  let body: string;
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ectodash/1.0",
  };

  if (provider === "anthropic") {
    // Anthropic Messages API
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
  } else if (provider === "openai") {
    headers["Authorization"] = `Bearer ${apiKey}`;
    body = JSON.stringify({
      model,
      temperature: 0,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  } else if (isResponsesApi) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["x-opencode-session"] = sessionId;
    body = JSON.stringify({
      model,
      temperature: 0,
      ...(options.jsonMode ? { text: { format: { type: "json_object" } } } : {}),
      instructions: system,
      input: user,
    });
  } else if (isMessagesApi) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["x-opencode-session"] = sessionId;
    body = JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
  } else {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["x-opencode-session"] = sessionId;
    body = JSON.stringify({
      model,
      temperature: 0,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const text = (await response.text()).slice(0, 400);
      if (text) detail = ` — ${text}`;
    } catch {
      // body already consumed or unreadable; keep the status-only message
    }
    throw new Error(`API de IA retornou status ${response.status}${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
    output_text?: unknown;
    output?: Array<{
      content?: Array<{ text?: unknown; type?: string }>;
      type?: string;
    }>;
    content?: Array<{ text?: unknown; type?: string }>;
  };

  // Chat Completions shape
  const chatContent = data?.choices?.[0]?.message?.content;
  if (typeof chatContent === "string" && chatContent.length > 0) return chatContent;

  // Responses API shapes
  if (typeof data?.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }
  const outputText = data?.output
    ?.flatMap((o) => o.content ?? [])
    .map((c) => (typeof c.text === "string" ? c.text : ""))
    .join("")
    .trim();
  if (outputText && outputText.length > 0) return outputText;

  // Anthropic /messages shape
  const anthropicText = data?.content
    ?.map((c) => (typeof c.text === "string" ? c.text : ""))
    .join("")
    .trim();
  if (anthropicText && anthropicText.length > 0) return anthropicText;

  throw new Error("API de IA retornou resposta vazia");
}

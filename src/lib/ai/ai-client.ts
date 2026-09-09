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

// Curated catalog shown in the selector (subset of Go)
export const AI_CATALOG = [
  { id: "mimo-v2.5", label: "MiMo-V2.5", desc: "Mais barato · 150k req/mês" },
  { id: "mimo-v2.5-pro", label: "MiMo-V2.5 Pro", desc: "Qualidade maior" },
  { id: "muse-spark-1.2-contributor", label: "Muse Spark 1.2", desc: "226k req/mês" },
  { id: "muse-spark-1.3-contributor", label: "Muse Spark 1.3", desc: "Mais recente" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", desc: "Rápido e barato" },
  { id: "glm-5.3-flash", label: "GLM-5.3 Flash", desc: "Intermediário" },
] as const;

export type AiModelId = (typeof AI_CATALOG)[number]["id"] | string;

function normalizeModel(model: string): string {
  if (model.endsWith("-free")) return model.slice(0, -5);
  return model;
}

function resolveUrl(model: string, explicitUrl?: string): string {
  if (explicitUrl) return explicitUrl;
  const needsResponses = RESPONSES_MODELS.has(model);
  let url = DEFAULT_AI_API_URL;
  const isResponsesUrl = url.includes("/responses");
  if (needsResponses && !isResponsesUrl) url = "https://opencode.ai/zen/go/v1/responses";
  else if (!needsResponses && isResponsesUrl) url = "https://opencode.ai/zen/go/v1/chat/completions";
  return url;
}

export function aiConfig(overrideModel?: string): { apiKey: string; url: string; model: string } {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) throw new Error("OPENCODE_API_KEY não configurada no servidor");
  const raw = overrideModel ?? process.env.AI_MODEL ?? DEFAULT_AI_MODEL;
  const model = normalizeModel(raw);
  const url = resolveUrl(model, process.env.AI_API_URL);
  return { apiKey, url, model };
}

export async function getEffectiveAIConfig(supabase?: import("@supabase/supabase-js").SupabaseClient): Promise<{ apiKey: string; url: string; model: string; source: "db" | "env" }> {
  const fallback = aiConfig();
  if (!supabase) return { ...fallback, source: "env" };
  try {
    const { data } = await supabase.from("ai_config").select("modelo").eq("id", 1).maybeSingle();
    const dbModel = data?.modelo?.trim();
    if (dbModel) {
      const model = normalizeModel(dbModel);
      const url = resolveUrl(model, process.env.AI_API_URL);
      return { apiKey: fallback.apiKey, url, model, source: "db" };
    }
  } catch {}
  return { ...fallback, source: "env" };
}

async function resolveEffectiveConfig(): Promise<{ apiKey: string; url: string; model: string }> {
  const fallback = aiConfig();
  // Try DB override — best-effort, never fails the request.
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const effective = await getEffectiveAIConfig(supabase);
    return effective;
  } catch {
    return fallback;
  }
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
  const { apiKey, url, model } = await resolveEffectiveConfig();
  const isResponsesApi = url.includes("/responses");
  const isMessagesApi = url.includes("/messages");

  // Go enforces x-opencode-session for routing + prompt-cache (2026-09).
  // Use a stable per-process id so consecutive calls in the same analysis
  // benefit from caching without extra config.
  const sessionId =
    (globalThis as unknown as { __ectodashSessionId?: string }).__ectodashSessionId ??
    (() => {
      const id = `ectodash-${crypto.randomUUID()}`;
      (globalThis as unknown as { __ectodashSessionId?: string }).__ectodashSessionId = id;
      return id;
    })();

  let body: string;
  if (isResponsesApi) {
    body = JSON.stringify({
      model,
      temperature: 0,
      ...(options.jsonMode ? { text: { format: { type: "json_object" } } } : {}),
      instructions: system,
      input: user,
    });
  } else if (isMessagesApi) {
    body = JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });
  } else {
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-opencode-session": sessionId,
      "User-Agent": "ectodash/1.0",
    },
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

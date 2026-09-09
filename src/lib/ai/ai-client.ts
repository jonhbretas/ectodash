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

export function aiConfig() {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    throw new Error("OPENCODE_API_KEY não configurada no servidor");
  }
  let model = process.env.AI_MODEL ?? DEFAULT_AI_MODEL;
  // Normalize legacy "-free" suffix that some envs still carry — the Go
  // catalog id is without it (e.g. muse-spark-1.2-contributor).
  if (model.endsWith("-free")) model = model.slice(0, -5);
  let url = process.env.AI_API_URL ?? DEFAULT_AI_API_URL;
  // Auto-route to the correct Go endpoint when AI_API_URL was not
  // explicitly overridden: Responses models must hit /responses.
  if (!process.env.AI_API_URL) {
    const needsResponses = RESPONSES_MODELS.has(model);
    const isResponsesUrl = url.includes("/responses");
    if (needsResponses && !isResponsesUrl) {
      url = "https://opencode.ai/zen/go/v1/responses";
    } else if (!needsResponses && isResponsesUrl) {
      url = "https://opencode.ai/zen/go/v1/chat/completions";
    }
  }
  return { apiKey, url, model };
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
  const { apiKey, url, model } = aiConfig();
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

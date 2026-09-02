// src/lib/ai/ai-client.ts
// Shared AI client — OpenCode Zen gateway powering BOTH the meeting-
// demandas extraction (extrair/analisar) and the financial dashboard's
// didactic summary. Works with BOTH gateway shapes:
//  - Chat Completions: https://opencode.ai/zen/go/v1/chat/completions
//    (legacy Go gateway, models like deepseek-v4-flash, mimo-v2.5)
//  - Responses API:    https://opencode.ai/zen/v1/responses
//    (current Zen gateway, models like Muse Spark, GPT, Claude)
// Plain fetch, no SDK. Endpoint and model are env-overridable
// (AI_API_URL / AI_MODEL). SERVER-ONLY: never imported from client
// components.

const DEFAULT_AI_API_URL = "https://opencode.ai/zen/v1/responses";
const DEFAULT_AI_MODEL = "muse-spark-1.2";

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
  return {
    apiKey,
    url: process.env.AI_API_URL ?? DEFAULT_AI_API_URL,
    model: process.env.AI_MODEL ?? DEFAULT_AI_MODEL,
  };
}

// Single server-side completion. Handles BOTH gateway shapes:
//  - Chat Completions (…/chat/completions) → { choices[0].message.content }
//  - Responses API   (…/responses)        → { output_text } or { output[0].content[0].text }
// Every failure mode throws a message-able error callers surface as friendly text.
// jsonMode requires the word "json" in the messages — callers must include it.
export async function chatCompletion(
  system: string,
  user: string,
  options: { jsonMode?: boolean } = {}
): Promise<string> {
  const { apiKey, url, model } = aiConfig();
  const isResponsesApi = url.includes("/responses");

  const body = isResponsesApi
    ? JSON.stringify({
        model,
        temperature: 0,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        // Responses API uses `input` / `instructions` instead of `messages`
        instructions: system,
        input: user,
      })
    : JSON.stringify({
        model,
        temperature: 0,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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

  throw new Error("API de IA retornou resposta vazia");
}

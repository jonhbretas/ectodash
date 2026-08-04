// src/lib/ai/ai-client.ts
// Shared AI chat-completions client — the OpenCode API (OpenCode Go
// subscription's model gateway) powering BOTH the meeting-demandas
// extraction (extrair) and the financial dashboard's didactic summary.
// OpenAI-compatible endpoint, plain fetch, no SDK. The endpoint and model
// are env-overridable (AI_API_URL / AI_MODEL); defaults are the Go
// gateway's documented values. SERVER-ONLY: never imported from client
// components.

const DEFAULT_AI_API_URL = "https://opencode.ai/zen/go/v1/chat/completions";
const DEFAULT_AI_MODEL = "deepseek-v4-flash";

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

// Single server-side chat completion. Returns the raw content string;
// every failure mode (missing key, non-2xx status, empty response) throws
// a message-able error that callers turn into user-facing friendly errors.
// jsonMode (DeepSeek/Zen JSON mode) requires the word "json" to appear in
// the messages — callers must include it in their prompts.
export async function chatCompletion(
  system: string,
  user: string,
  options: { jsonMode?: boolean } = {}
): Promise<string> {
  const { apiKey, url, model } = aiConfig();

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API de IA retornou status ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("API de IA retornou resposta vazia");
  }
  return content;
}

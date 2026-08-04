"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { matchResponsavel } from "@/lib/ai/match-responsavel";
import { extractionResponseSchema } from "./extraction-schema";

export type ExtractDemandasState = {
  ok: boolean;
  message: string;
  suggestions: Array<{
    key: string;
    titulo: string;
    responsavelId: string | null;
    responsavelTexto: string;
    prazoTexto: string;
  }>;
};

// Exact copy is 08-UI-SPEC.md's locked "Textarea empty-submit validation
// error" string. The .max(20000) bound defends against pathologically large
// pastes wasting AI quota / cost (08-RESEARCH.md Security Domain, DoS
// mitigation, T-08-05).
const pasteSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(1, "Cole o resumo da reunião antes de continuar.")
    .max(20000),
});

// Provider decision (2026-08-04, user): extraction runs on DeepSeek V4
// Flash through the OpenCode API (the OpenCode Go subscription's model
// gateway) — the same model powering the development workflow — instead of
// Google's Gemini. The gateway's chat completions endpoint is
// OpenAI-compatible, so the call is a plain fetch, no SDK dependency. The
// endpoint and model are env-overridable (AI_API_URL / AI_MODEL) so the
// same code can point at any OpenAI-compatible provider without a code
// change; defaults are the gateway's documented values.
const DEFAULT_AI_API_URL = "https://opencode.ai/zen/v1/chat/completions";
const DEFAULT_AI_MODEL = "deepseek-v4-flash";

function aiConfig() {
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

// DeepSeek/Zen json mode requires a top-level JSON OBJECT (never a bare
// array), so the prompt asks for the array wrapped under a "demandas" key
// and this schema re-validates the envelope. The inner array validation is
// extractionResponseSchema unchanged — the same untrusted-output boundary
// that previously validated Gemini's response.
const responseEnvelopeSchema = z.object({
  demandas: extractionResponseSchema,
});

// Single server-side call to the AI provider. Returns the raw content
// string; every failure mode (missing key, non-2xx status, empty response)
// throws a message-able error that the action's catch block turns into the
// user-facing friendly error.
async function extractWithAi(texto: string): Promise<string> {
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
      // JSON mode requires the word "json" to appear in the messages — it
      // is present in the system prompt below.
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Você extrai tarefas de resumos de reunião. Responda APENAS com JSON no formato {"demandas": [{"titulo": string, "responsavel_texto": string, "prazo_texto": string}]}. Se nenhuma tarefa for encontrada, retorne {"demandas": []}. Não escreva nada fora do JSON.',
        },
        {
          role: "user",
          content: `Extraia uma lista de tarefas mencionadas no resumo de reunião a seguir. Para cada tarefa: titulo (o que precisa ser feito), responsavel_texto (nome da pessoa responsável exatamente como mencionado), prazo_texto (qualquer prazo mencionado, exatamente como no texto — NÃO calcule datas).\n\nResumo:\n"""\n${texto}\n"""`,
        },
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

export async function extractDemandas(
  prevState: ExtractDemandasState,
  formData: FormData
): Promise<ExtractDemandasState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessão expirada. Faça login novamente.",
      suggestions: [],
    };
  }

  const parsed = pasteSchema.safeParse({ texto: formData.get("texto") });
  if (!parsed.success) {
    // Never calls the AI on this path — an empty/whitespace-only paste is
    // rejected purely by local validation.
    return {
      ok: false,
      message: "Cole o resumo da reunião antes de continuar.",
      suggestions: [],
    };
  }

  // Ordinary session-bound client only — same query shape nova/page.tsx
  // already runs, RLS-scoped to what this caller can see. The service-role
  // factory in src/lib/supabase/admin.ts is never imported here, per that
  // file's own import restriction.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email");

  try {
    // JSON.parse is inside the same try/catch as the API call — a
    // malformed/truncated response is caught by the same catch block below,
    // never propagating an unhandled exception (08-RESEARCH.md Pitfall 4).
    const rawJson = JSON.parse(await extractWithAi(parsed.data.texto));
    const validated = responseEnvelopeSchema.safeParse(rawJson);

    if (!validated.success) {
      return {
        ok: false,
        message: "A IA retornou um formato inesperado. Tente novamente.",
        suggestions: [],
      };
    }

    if (validated.data.demandas.length === 0) {
      return {
        ok: true,
        message: "Nenhuma demanda encontrada no texto colado.",
        suggestions: [],
      };
    }

    const suggestions = validated.data.demandas.map((suggestion) => ({
      key: crypto.randomUUID(),
      titulo: suggestion.titulo,
      responsavelId: matchResponsavel(
        suggestion.responsavel_texto,
        profiles ?? []
      ),
      responsavelTexto: suggestion.responsavel_texto,
      prazoTexto: suggestion.prazo_texto,
    }));

    return { ok: true, message: "", suggestions };
  } catch (err) {
    console.error("extractDemandas: AI call failed", err);
    return {
      ok: false,
      message:
        "Algo deu errado ao processar o texto com a IA. Verifique sua internet e tente novamente.",
      suggestions: [],
    };
  }
}

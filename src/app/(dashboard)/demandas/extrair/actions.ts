"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { matchResponsavel } from "@/lib/ai/match-responsavel";
import { chatCompletion } from "@/lib/ai/ai-client";
import { extractionResponseSchema } from "./extraction-schema";
import { obterTranscricao } from "@/lib/meetings";

export type ExtractDemandasState = {
  ok: boolean;
  message: string;
  suggestions: Array<{
    key: string;
    titulo: string;
    responsavelId: string | null;
    responsavelTexto: string;
    prazoTexto: string;
    // Pre-filled, editable date (yyyy-MM-dd) resolved by the AI against
    // today's reference date — still gated by the human Confirmar click.
    prazoSugerido: string | null;
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

// Transcripts from Tactiq can be far longer than a manual paste — the cap
// here only bounds cost, never rejects the meeting (a very long transcript
// is truncated to the first N characters, which still covers the meeting's
// opening/decisions).
const MEETING_TEXT_MAX = 60000;

// Provider decision (2026-08-04, user): extraction runs on DeepSeek V4
// Flash through the OpenCode API (the OpenCode Go subscription's model
// gateway) — the same model powering the development workflow — instead of
// Google's Gemini. The shared client lives in src/lib/ai/ai-client.ts.

// DeepSeek/Zen json mode requires a top-level JSON OBJECT (never a bare
// array), so the prompt asks for the array wrapped under a "demandas" key
// and this schema re-validates the envelope. The inner array validation is
// extractionResponseSchema unchanged — the same untrusted-output boundary
// that previously validated Gemini's response.
const responseEnvelopeSchema = z.object({
  demandas: extractionResponseSchema,
});

// Single server-side call to the AI provider (shared client). JSON mode
// requires the word "json" in the messages — it is present in the system
// prompt below.
async function extractWithAi(texto: string): Promise<string> {
  return chatCompletion(
    'Você extrai tarefas de transcrições de reunião. Responda APENAS com JSON no formato {"demandas": [{"titulo": string, "responsavel_texto": string, "prazo_texto": string, "prazo_sugerido": string}]}. Se nenhuma tarefa for encontrada, retorne {"demandas": []}. Não escreva nada fora do JSON.',
    `Hoje é ${new Date().toISOString().slice(0, 10)}. Extraia uma lista de tarefas mencionadas na transcrição a seguir. Para cada tarefa: titulo (o que precisa ser feito), responsavel_texto (nome da pessoa responsável exatamente como mencionado), prazo_texto (qualquer prazo mencionado, exatamente como no texto), prazo_sugerido (a data concreta yyyy-MM-dd calculada a partir de HOJE quando o prazo for relativo como "sexta", "fim do mês", "amanhã", ou a data absoluta quando mencionada; deixe "" quando não houver prazo claro).\n\nTranscrição:\n"""\n${texto}\n"""`,
    { jsonMode: true }
  );
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

  // Source resolution: a Tactiq meeting id wins over pasted text. The
  // transcript is fetched SERVER-side (the Tactiq key never reaches the
  // browser) and treated as untrusted input like any paste.
  const reuniaoId = formData.get("reuniaoId");
  let texto: string;

  if (typeof reuniaoId === "string" && reuniaoId.trim().length > 0) {
    try {
      const transcricao = await obterTranscricao(reuniaoId);
      texto = transcricao.texto.slice(0, MEETING_TEXT_MAX);
    } catch (err) {
      console.error("extractDemandas: Tactiq transcript fetch failed", err);
      return {
        ok: false,
        message:
          "Não foi possível buscar a transcrição dessa reunião no Tactiq. Tente novamente.",
        suggestions: [],
      };
    }
  } else {
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
    texto = parsed.data.texto;
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
    const rawJson = JSON.parse(await extractWithAi(texto));
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
        message: "Nenhuma demanda encontrada na transcrição.",
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
      // Normalized: an empty string from the AI becomes null, so the
      // review card only pre-fills real dates.
      prazoSugerido: suggestion.prazo_sugerido
        ? suggestion.prazo_sugerido
        : null,
    }));

    return { ok: true, message: "", suggestions };
  } catch (err) {
    console.error("extractDemandas: AI call failed", err);
    return {
      ok: false,
      message:
        "Algo deu errado ao processar a transcrição com a IA. Verifique sua internet e tente novamente.",
      suggestions: [],
    };
  }
}

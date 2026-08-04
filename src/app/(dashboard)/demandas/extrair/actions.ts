"use server";

import { GoogleGenAI, Type } from "@google/genai";
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
// pastes wasting Gemini quota / cost (08-RESEARCH.md Security Domain, DoS
// mitigation, T-08-05).
const pasteSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(1, "Cole o resumo da reunião antes de continuar.")
    .max(20000),
});

// Current, non-deprecated Flash-Lite-class model — verified live against
// ai.google.dev/gemini-api/docs/models and its dedicated model page on
// 2026-08-04 (confirmed GA/non-preview listing, "Structured output" and
// "Function calling" support, no deprecation notice). gemini-2.5-flash-lite
// (CLAUDE.md's older literal recommendation) has an announced shutdown
// around October 2026 — do not revert to it without re-checking.
const EXTRACTION_MODEL = "gemini-3.1-flash-lite";

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
    // Never calls Gemini on this path — an empty/whitespace-only paste is
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

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const result = await ai.models.generateContent({
      model: EXTRACTION_MODEL,
      contents: `Extraia uma lista de tarefas mencionadas no resumo de reunião a seguir. Para cada tarefa, retorne: titulo (o que precisa ser feito), responsavel_texto (nome da pessoa responsável exatamente como mencionado), prazo_texto (qualquer prazo mencionado, exatamente como no texto — NÃO calcule datas). Se nenhuma tarefa for encontrada, retorne uma lista vazia.

Resumo:
"""
${parsed.data.texto}
"""`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              titulo: { type: Type.STRING },
              responsavel_texto: { type: Type.STRING },
              prazo_texto: { type: Type.STRING },
            },
            required: ["titulo", "responsavel_texto", "prazo_texto"],
          },
        },
      },
    });

    // JSON.parse is inside the same try/catch as the Gemini call — a
    // malformed/truncated response is caught by the same catch block below,
    // never propagating an unhandled exception (08-RESEARCH.md Pitfall 4).
    const rawJson = JSON.parse(result.text ?? "[]");
    const validated = extractionResponseSchema.safeParse(rawJson);

    if (!validated.success) {
      return {
        ok: false,
        message: "A IA retornou um formato inesperado. Tente novamente.",
        suggestions: [],
      };
    }

    if (validated.data.length === 0) {
      return {
        ok: true,
        message: "Nenhuma demanda encontrada no texto colado.",
        suggestions: [],
      };
    }

    const suggestions = validated.data.map((suggestion) => ({
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
    console.error("extractDemandas: Gemini call failed", err);
    return {
      ok: false,
      message:
        "Algo deu errado ao processar o texto com a IA. Verifique sua internet e tente novamente.",
      suggestions: [],
    };
  }
}

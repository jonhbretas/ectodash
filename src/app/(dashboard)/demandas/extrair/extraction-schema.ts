import { z } from "zod";

// Validates what Gemini returned — deliberately looser than demandaSchema
// (no .uuid() responsavelIds, no strict .date() prazo) because this
// re-validates raw, unresolved AI output as untrusted external data, even
// though Gemini's own responseSchema already constrains its shape at
// generation time (08-RESEARCH.md Common Pitfall 4 — responseSchema
// guarantees shape, not semantic correctness). demandaSchema's full
// strictness is applied later, per-suggestion, only at the moment a human
// clicks "Confirmar" (Wave 2, reusing createDemanda unchanged).
export const extractionResponseSchema = z
  .array(
    z.object({
      titulo: z.string().trim().min(1).max(200),
      responsavel_texto: z.string().trim().max(200),
      prazo_texto: z.string().trim().max(200),
    })
  )
  // Defensive upper bound — a pathological/adversarial input shouldn't be
  // able to produce an unbounded suggestion list the review UI then has to
  // render.
  .max(50);

export type ExtractedSuggestion = z.infer<
  typeof extractionResponseSchema
>[number];

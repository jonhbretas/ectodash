import { z } from "zod";

// Validates what the AI returned — deliberately looser than demandaSchema
// (no .uuid() responsavelIds, no strict .date() prazo) because this
// re-validates raw, unresolved AI output as untrusted external data, even
// though the provider's own JSON-mode prompt already constrains its shape
// at generation time (08-RESEARCH.md Common Pitfall 4 — a prompt contract
// guarantees shape only at best-effort level, not semantic correctness).
// demandaSchema's full strictness is applied later, per-suggestion, only
// at the moment a human clicks "Confirmar" (Wave 2, reusing createDemanda
// unchanged).
//
// prazo_sugerido: OPTIONAL pre-filled date (yyyy-MM-dd) resolved by the AI
// against a server-provided reference date ("hoje"). It is a convenience
// that still passes through the human review gate — the card pre-fills it
// but the human must click Confirmar, and can edit the date first.
export const extractionResponseSchema = z
  .array(
    z.object({
      titulo: z.string().trim().min(1).max(200),
      responsavel_texto: z.string().trim().max(200),
      prazo_texto: z.string().trim().max(200),
      prazo_sugerido: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "prazo_sugerido deve ser yyyy-MM-dd")
        .optional()
        .or(z.literal("")),
    })
  )
  // Defensive upper bound — a pathological/adversarial input shouldn't be
  // able to produce an unbounded suggestion list the review UI then has to
  // render.
  .max(50);

export type ExtractedSuggestion = z.infer<
  typeof extractionResponseSchema
>[number];

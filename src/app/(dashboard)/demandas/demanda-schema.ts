import { z } from "zod";

// Single source of truth for what a valid demanda looks like — imported by
// both the Client Component form (via @hookform/resolvers/zod) and the
// createDemanda Server Action (which re-validates server-side; client-side
// validation and server-side validation can never silently disagree,
// RESEARCH.md Pattern 5).
export const demandaSchema = z.object({
  titulo: z.string().trim().min(1, "Digite um título para a demanda."),
  // Multi-responsável is the locked data-model decision (04-CONTEXT.md): an
  // array of profile ids, never a single string — this is the tracer's
  // proof that the multi-responsável decision reaches the database.
  responsavelIds: z.array(z.string().uuid()).min(1, "Escolha quem é o responsável."),
  // Native <input type="date"> always yields yyyy-mm-dd.
  prazo: z.string().date("Escolha uma data de prazo."),
  status: z.enum(["pendente", "em_andamento", "concluida"]),
  area: z.string().trim().optional(),
  // Projeto is a second free-text dimension, distinct from área (user
  // decision: filters Área + Projeto), optional like area.
  projeto: z.string().trim().optional(),
  // Membros/acompanhantes: optional extra volunteers who follow the
  // demanda and receive the same reminders (join table demanda_membros).
  membroIds: z.array(z.string().uuid()).optional(),
});

// Etiqueta link — validated separately (native select, not RHF-managed),
// same pattern as eventoIdSchema.
export const etiquetaIdSchema = z.preprocess(
  (value) =>
    value === "" || value === undefined || value === null
      ? undefined
      : Number(value),
  z.number().int().positive().optional()
);

// Evento link (vínculo evento -> demanda). Kept OUT of demandaSchema on
// purpose: it is a native-select optional value, not managed by
// react-hook-form, so it is validated separately here — the Server Actions
// run this on formData.get("eventoId") and the form's select shows the
// current value via its own defaultValue.
export const eventoIdSchema = z.preprocess(
  (value) =>
    value === "" || value === undefined || value === null
      ? undefined
      : Number(value),
  z.number().int().positive().optional()
);

export type DemandaFormValues = z.infer<typeof demandaSchema>;

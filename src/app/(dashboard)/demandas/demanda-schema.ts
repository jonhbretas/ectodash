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
});

export type DemandaFormValues = z.infer<typeof demandaSchema>;

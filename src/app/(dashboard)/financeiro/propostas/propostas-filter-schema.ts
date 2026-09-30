// src/app/(dashboard)/financeiro/propostas/propostas-filter-schema.ts
// searchParams contract do /financeiro/propostas — entrada de URL não
// confiável, validada com zod antes de chegar a qualquer query Supabase
// (mesmo padrão de lancamentos-filter-schema.ts).
import { z } from "zod";

export const propostasFilterSchema = z.object({
  busca: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(120).optional()
  ),
  status: z.enum(["todas", "pendente", "pago", "atrasadas", "cancelado"]).optional(),
});

export type PropostasFilters = z.infer<typeof propostasFilterSchema>;

export function parsePropostasFilters(raw: {
  [key: string]: string | string[] | undefined;
}): PropostasFilters {
  return propostasFilterSchema.parse({
    busca: typeof raw.busca === "string" ? raw.busca : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
  });
}

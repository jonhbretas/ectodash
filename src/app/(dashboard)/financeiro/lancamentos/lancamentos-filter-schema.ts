// src/app/(dashboard)/financeiro/lancamentos/lancamentos-filter-schema.ts
// searchParams contract do /financeiro/lancamentos — entrada de URL não
// confiável, validada com zod antes de chegar a qualquer query Supabase
// (mesmo padrão de log-acoes-filter-schema.ts / financeiro-filter-schema.ts).
import { z } from "zod";

export const LANCAMENTOS_POR_PAGINA = 25;

export const lancamentosFilterSchema = z.object({
  busca: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(120).optional()
  ),
  mes: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional()
  ),
  tipo: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["entrada", "saida"]).optional()
  ),
  pagina: z.coerce.number().int().min(1).optional(),
});

export type LancamentosFilters = z.infer<typeof lancamentosFilterSchema>;

export function parseLancamentosFilters(raw: {
  [key: string]: string | string[] | undefined;
}): LancamentosFilters {
  return lancamentosFilterSchema.parse({
    busca: typeof raw.busca === "string" ? raw.busca : undefined,
    mes: typeof raw.mes === "string" ? raw.mes : undefined,
    tipo: typeof raw.tipo === "string" ? raw.tipo : undefined,
    pagina: typeof raw.pagina === "string" ? raw.pagina : undefined,
  });
}

export function lancamentosPaginaAtual(filters: LancamentosFilters): number {
  return filters.pagina ?? 1;
}

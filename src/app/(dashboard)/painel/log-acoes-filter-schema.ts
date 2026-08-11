// src/app/(dashboard)/painel/log-acoes-filter-schema.ts
// searchParams contract da aba "Log de ações" do /painel — entrada de URL
// não confiável, validada com zod antes de chegar a qualquer query Supabase
// (mesmo padrão de voluntarios-filter-schema.ts / demanda-filter-schema.ts).
import { z } from "zod";

export const LOG_ACOES_POR_PAGINA = 50;

export const logAcoesFilterSchema = z.object({
  busca: z.string().trim().max(120).optional(),
  entidade: z.string().trim().max(60).optional(),
  pagina: z.coerce.number().int().min(1).optional(),
});

export type LogAcoesFilters = z.infer<typeof logAcoesFilterSchema>;

export function parseLogAcoesFilters(
  searchParams: Record<string, string | string[] | undefined>
): LogAcoesFilters {
  const parsed = logAcoesFilterSchema.safeParse(searchParams);
  return parsed.success ? parsed.data : {};
}

export function logAcoesPaginaAtual(filters: LogAcoesFilters): number {
  return filters.pagina ?? 1;
}

import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// searchParams is untrusted URL input — same boundary-validation discipline
// applied to demanda-filter-schema.ts (05-RESEARCH.md Pattern 5). An empty
// filter state (no query params) means "show everything"; every dimension
// is optional and combinable with AND.
//
// mes: a month key in MM/yyyy (e.g. "08/2026") — the same key used by the
// page's per-month aggregation, validated against a strict regex so a
// malformed value is dropped, never passed on.
//
// tipo: a closed two-value enum matching financial_entries.tipo.
//
// categoria: a free-text label that must match a stored category exactly
// ("" normalizes to absent, like the demandas filters).
export const financeiroFilterSchema = z.object({
  mes: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .regex(/^(0[1-9]|1[0-2])\/\d{4}$/, "mes deve estar no formato MM/aaaa")
      .optional()
  ),
  tipo: z.enum(["entrada", "saida"]).optional(),
  categoria: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional()
  ),
});

export type FinanceiroFilters = z.infer<typeof financeiroFilterSchema>;

// The exact function page.tsx calls with `await searchParams`. A repeated
// query param (e.g. ?mes=08/2026&mes=09/2026) arrives as a string array —
// this guard extracts only the string case of each key before handing the
// result to financeiroFilterSchema.parse().
export function parseFinanceiroFilters(raw: {
  [key: string]: string | string[] | undefined;
}): FinanceiroFilters {
  return financeiroFilterSchema.parse({
    mes: typeof raw.mes === "string" ? raw.mes : undefined,
    tipo: typeof raw.tipo === "string" ? raw.tipo : undefined,
    categoria: typeof raw.categoria === "string" ? raw.categoria : undefined,
  });
}

// "08/2026" -> "Agosto de 2026" — shared by the filter chips and the
// per-month table, so a month is never spelled two different ways on the
// same screen. Pure and locale-stable (date-fns + pt-BR).
export function labelMes(mes: string): string {
  const [month, year] = mes.split("/");
  const label = format(
    new Date(Number(year), Number(month) - 1, 1),
    "MMMM 'de' yyyy",
    { locale: ptBR }
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

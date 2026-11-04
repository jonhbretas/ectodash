import type { SupabaseClient } from "@supabase/supabase-js";
type FinancialQuery = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;
export async function allFinancialRows<T>(db: SupabaseClient, table: string, columns: string, configure: (query: FinancialQuery) => FinancialQuery): Promise<T[]> {
  const rows: T[] = [];
  let total: number | null = null;
  do {
    const response = await configure(db.from(table).select(columns, { count: "exact" })).order("id").range(rows.length, rows.length + 499);
    if (response.error) throw new Error(`Não foi possível consultar ${table}. Tente novamente.`);
    total = response.count;
    const page = (response.data ?? []) as T[];
    if (!page.length) {
      if (total !== null && rows.length < total) throw new Error("A consulta financeira retornou dados incompletos.");
      break;
    }
    rows.push(...page);
    if (rows.length > 100000) throw new Error("Volume muito alto para análise interativa. Divida o período.");
  } while (total === null || rows.length < total);
  return rows;
}

export function financeToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

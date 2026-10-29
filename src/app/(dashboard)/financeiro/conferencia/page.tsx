import { createClient } from "@/lib/supabase/server";
import ReviewList from "./review-list";

export const metadata = { title: "Conferência financeira — EctoDash" };
export default async function ConferenciaPage() {
  const supabase = await createClient();
  const { data: exceptions } = await supabase.from("finance_exceptions").select("id,problem,recommendation,ledger_ids,import_id").eq("status", "OPEN").order("created_at", { ascending: true }).limit(200);
  type ExceptionRow = { id: string; problem: string; recommendation: string | null; ledger_ids: string[] | null; import_id: string | null };
  type LedgerRow = { id: string; movement_date: string; original_description: string; net_amount: number; type: string };
  const exceptionRows = (exceptions ?? []) as ExceptionRow[];
  const ids: string[] = [...new Set(exceptionRows.flatMap((item) => item.ledger_ids ?? []))];
  const { data: ledger } = ids.length ? await supabase.from("finance_ledger").select("id,movement_date,original_description,net_amount,type").in("id", ids) : { data: [] };
  const importIds: string[] = [...new Set(exceptionRows.map((item) => item.import_id).filter((id): id is string => Boolean(id)))];
  const { data: imports } = importIds.length ? await supabase.from("finance_imports").select("id,metadata").in("id", importIds) : { data: [] };
  const ledgerById = new Map((ledger ?? []).map((row) => [row.id, row]));
  const importsById = new Map((imports ?? []).map((row: { id: string; metadata: unknown }) => [row.id, row]));
  const rows = exceptionRows.flatMap((exception) => {
    const metadata = exception.import_id ? importsById.get(exception.import_id)?.metadata as { drive_url?: string | null } | undefined : undefined;
    const linked = (exception.ledger_ids ?? []).map((id) => ledgerById.get(id)).filter((row): row is LedgerRow => Boolean(row));
    const source = linked.length ? linked : [null];
    return source.map((row) => ({ id: row?.id ?? null, exceptionId: exception.id, problem: exception.problem, recommendation: exception.recommendation, movement_date: row?.movement_date ?? new Date().toISOString().slice(0, 10), original_description: row?.original_description ?? "", net_amount: row?.net_amount ?? 0, drive_url: metadata?.drive_url ?? null, type: row?.type ?? "DESPESA", manual: !row }));
  });
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8"><header><h1 className="text-2xl font-semibold text-zinc-900">Conferência humana</h1><p className="mt-1 text-zinc-600">Revise os lançamentos incertos lado a lado com o documento original. Cada correção fica registrada no histórico.</p></header><ReviewList rows={rows} /></main>;
}

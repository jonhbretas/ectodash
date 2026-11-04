import type { NormalizedFinancialRow } from "./automation";
export type ExistingMovement = { id: string; movement_date: string; type: string; net_amount: number; normalized_description: string; external_transaction_id: string | null };
export type DuplicateCandidate = { kind: "POSSIBLE_DUPLICATE"; row: NormalizedFinancialRow; candidates: ExistingMovement[] };
export function separateDuplicates(rows: NormalizedFinancialRow[], existing: ExistingMovement[]) {
  const accepted: NormalizedFinancialRow[] = [];
  const duplicates: DuplicateCandidate[] = [];
  for (const row of rows) {
    const candidates = existing.filter((entry) => entry.type === row.type && entry.movement_date === row.date && Math.round(Number(entry.net_amount) * 100) === Math.round(row.net * 100) &&
      (entry.normalized_description === row.normalizedDescription || (!!row.externalId && entry.external_transaction_id === row.externalId)));
    if (candidates.length) duplicates.push({ kind: "POSSIBLE_DUPLICATE", row, candidates });
    else accepted.push(row);
  }
  return { rows: accepted, duplicates };
}

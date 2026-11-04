import type { NormalizedFinancialRow } from "./automation";
export type ExistingMovement = { id: string; movement_date: string; type: string; net_amount: number; normalized_description: string; external_transaction_id: string | null; provider?: { name: string } | null };
const identityWords = (text: string) => text.split(/\s+/).filter((word) => word.length >= 4 && !["credito", "debito", "pagamento", "recebido", "recebimento", "transferencia", "venda", "banco"].includes(word));
function descriptionOverlap(a: string, b: string) {
  const left = new Set(identityWords(a));
  return [...new Set(identityWords(b))].filter((word) => [...left].some((other) => other === word || (Math.min(other.length, word.length) >= 5 && (other.startsWith(word) || word.startsWith(other))))).length >= 2;
}
export type DuplicateCandidate = { kind: "POSSIBLE_DUPLICATE"; row: NormalizedFinancialRow; candidates: ExistingMovement[] };
export function separateDuplicates(rows: NormalizedFinancialRow[], existing: ExistingMovement[]) {
  const accepted: NormalizedFinancialRow[] = [];
  const duplicates: DuplicateCandidate[] = [];
  for (const row of rows) {
    const candidates = existing.filter((entry) => entry.type === row.type && entry.movement_date === row.date && Math.round(Number(entry.net_amount) * 100) === Math.round(row.net * 100) &&
      (entry.normalized_description === row.normalizedDescription || descriptionOverlap(entry.normalized_description, row.normalizedDescription) ||
        (row.type === "RECEITA_FATURADA" && !!row.provider && entry.provider?.name.toLowerCase() === row.provider.toLowerCase()) ||
        (!!row.externalId && entry.external_transaction_id === row.externalId)));
    if (candidates.length) duplicates.push({ kind: "POSSIBLE_DUPLICATE", row, candidates });
    else accepted.push(row);
  }
  return { rows: accepted, duplicates };
}

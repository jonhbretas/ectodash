// Fail closed: corrupted cells must never become a plausible financial amount.
export function parseFinancialAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim().replace(/^([+-]?)\s*R\$\s*/i, "$1").replace(/\s/g, "");
  if (!text) return null;
  const debit = /D$/i.test(text);
  text = text.replace(/[DC]$/i, "");
  const negative = /^\(.*\)$/.test(text);
  if (negative) text = text.slice(1, -1);
  if (text.includes(",")) {
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)) return null;
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const result = Number(text);
  return Number.isFinite(result) ? (negative || debit ? -Math.abs(result) : result) : null;
}

export function parseFinancialDate(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000 && value < 90000) return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ]\d{2}:\d{2})/.exec(text);
  const parts = br ? [br[3].length === 2 ? `20${br[3]}` : br[3], br[2].padStart(2, "0"), br[1].padStart(2, "0")] : iso?.slice(1);
  if (!parts) return null;
  const normalized = parts.join("-");
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}

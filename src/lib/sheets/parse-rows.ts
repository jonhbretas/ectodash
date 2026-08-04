// src/lib/sheets/parse-rows.ts
// The row-parsing layer of Phase 9's cron sync — the one piece whose
// real-world shape is genuinely unknown until a human inspects the
// institution's cash-flow spreadsheet (09-RESEARCH.md Item 3/4's explicit
// research blocker, carried in STATE.md's Blockers/Concerns).
//
// The column layout below is a CLEARLY-LABELED PLACEHOLDER assumption,
// documented as such, with every mapping isolated in one place so the
// follow-up correction is a small, contained edit once the real layout is
// known — exactly the design 09-RESEARCH.md's Piece A/B split prescribes.
//
// This is the FIRST place in the project where genuinely untrusted
// EXTERNAL data (a human-editable spreadsheet) becomes typed internal
// data — so every row is zod-validated and, on any invalid row, the whole
// batch is REJECTED (a partial ingest would silently produce a misleading
// dashboard). Unlike Supabase rows or AI JSON payloads, a spreadsheet has
// no schema enforcement upstream.
import { z } from "zod";

// PLACEHOLDER column layout (assumed, pending real-sheet discovery):
//   A: data      (dd/MM/yyyy or yyyy-MM-dd — parsed leniently below)
//   B: descricao (free text)
//   C: tipo      ("entrada" | "saida" | "despesa" | "receita", case-insensitive)
//   D: valor     (decimal, comma or dot separator — PT-BR spreadsheets use ",")
//   E: categoria (free text, optional)
// Real sheet layout, once known, lands here — no other file changes.
export const SHEET_COLUMNS = {
  data: 0,
  descricao: 1,
  tipo: 2,
  valor: 3,
  categoria: 4,
} as const;

const TIPO_NORMALIZACAO: Record<string, "entrada" | "saida"> = {
  entrada: "entrada",
  receita: "entrada",
  saida: "saida",
  despesa: "saida",
  pagamento: "saida",
};

export type FinancialEntry = {
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  data: string; // yyyy-MM-dd
  categoria: string | null;
};

const entrySchema = z.object({
  data: z.string(),
  descricao: z.string().min(1),
  tipo: z.enum(["entrada", "saida"]),
  valor: z.number().positive(),
  categoria: z.string().nullable(),
});

function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (
      date.getUTCFullYear() === Number(y) &&
      date.getUTCMonth() === Number(m) - 1 &&
      date.getUTCDate() === Number(d)
    ) {
      return date.toISOString().slice(0, 10);
    }
    return null;
  }
  const yyyymmdd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (
      date.getUTCFullYear() === Number(y) &&
      date.getUTCMonth() === Number(m) - 1 &&
      date.getUTCDate() === Number(d)
    ) {
      return date.toISOString().slice(0, 10);
    }
  }
  return null;
}

function parseValor(raw: string): number | null {
  // PT-BR decimal disambiguation. A comma ALWAYS means "comma is the
  // decimal separator, dots are thousand separators" ("1.234,56" -> 1234.56)
  // — unambiguous in Brazilian spreadsheets. With no comma, a dot is the
  // decimal separator unless it groups exactly 3 trailing digits
  // ("1.234" -> 1234, "120.50" -> 120.5) — the standard BRL heuristic.
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;

  let normalized: string;
  if (trimmed.includes(",")) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else if (trimmed.includes(".")) {
    const parts = trimmed.split(".");
    const last = parts[parts.length - 1];
    normalized =
      parts.length > 1 && last.length === 3
        ? trimmed.replace(/\./g, "")
        : trimmed;
  } else {
    normalized = trimmed;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function parseTipo(raw: string): "entrada" | "saida" | null {
  return TIPO_NORMALIZACAO[raw.trim().toLowerCase()] ?? null;
}

function rawToEntry(row: unknown[]): FinancialEntry | null {
  const data = parseDate(String(row[SHEET_COLUMNS.data] ?? ""));
  const descricao = String(row[SHEET_COLUMNS.descricao] ?? "").trim();
  const tipo = parseTipo(String(row[SHEET_COLUMNS.tipo] ?? ""));
  const valor = parseValor(String(row[SHEET_COLUMNS.valor] ?? ""));
  const categoriaRaw = String(row[SHEET_COLUMNS.categoria] ?? "").trim();

  if (!data || !descricao || !tipo || valor === null) return null;

  const parsed = entrySchema.safeParse({
    data,
    descricao,
    tipo,
    valor,
    categoria: categoriaRaw ? categoriaRaw : null,
  });
  return parsed.success ? parsed.data : null;
}

// Converts the Google Sheets API's raw values grid into typed entries.
// The FIRST row is always treated as a header and skipped (the institution's
// fixed-format sheet has a header row — a documented assumption). Trailing
// fully-empty rows are tolerated; any non-empty row that fails parsing
// rejects the ENTIRE batch (null return) so a silently-half-ingested
// dashboard is impossible.
export function parseSheetRows(rows: unknown[][]): FinancialEntry[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const body = rows.slice(1);
  const entries: FinancialEntry[] = [];

  for (const row of body) {
    if (!Array.isArray(row)) return null;
    const allEmpty = row.every(
      (cell) => cell === null || cell === undefined || String(cell).trim() === ""
    );
    if (allEmpty) continue;

    const entry = rawToEntry(row);
    if (!entry) return null;
    entries.push(entry);
  }

  return entries;
}

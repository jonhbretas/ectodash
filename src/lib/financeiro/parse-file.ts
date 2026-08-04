// src/lib/financeiro/parse-file.ts
// Manual spreadsheet import parsing — CSV (PT-BR: semicolon or comma
// delimited, quoted fields) and XLSX (first sheet, via the xlsx package).
// Two formats are supported and auto-detected:
//   1. EctoLab cash-flow (monthly pivot: Janeiro…Dezembro columns) —
//      parsed by parseEctolabRows.
//   2. Flat ledger (Data; Descrição; Tipo; Valor; Categoria) — parsed by
//      parseSheetRows, shared with the Google Sheets cron sync.
import * as XLSX from "xlsx";
import { parseSheetRows } from "@/lib/sheets/parse-rows";
import type { FinancialEntry } from "@/lib/sheets/parse-rows";
import {
  isEctolabFormat,
  MONTH_NAMES,
  parseEctolabRows,
} from "./parse-ectolab";

export type ParseFileResult =
  | { ok: true; entries: FinancialEntry[] }
  | { ok: false; error: string };

// Minimal RFC-4180-ish CSV tokenizer: handles quoted fields (with embedded
// separators/newlines) and detects ";" vs "," by counting each on the first
// non-comment line.
// Strip UTF-8 BOM (U+FEFF) that some tools prepend — prevents the first
// header cell from becoming "﻿Data" instead of "Data".
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

export function parseCsv(texto: string): unknown[][] {
  const clean = stripBom(texto);
  const lines = clean.replace(/\r\n/g, "\n").split("\n");
  const firstDataLine = lines.find((line) => line.trim() !== "") ?? "";
  const semicolons = (firstDataLine.match(/;/g) ?? []).length;
  const commas = (firstDataLine.match(/,/g) ?? []).length;
  const delimiter = semicolons > commas ? ";" : ",";

  const rows: unknown[][] = [];
  let current: string[] = [];
  let inQuotes = false;
  let field = "";

  const flushField = () => {
    current.push(field);
    field = "";
  };
  const flushRow = () => {
    flushField();
    rows.push(current);
    current = [];
  };

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        flushField();
      } else {
        field += char;
      }
    }
    if (inQuotes) {
      field += "\n"; // quoted newline stays inside the field
    } else {
      flushRow();
    }
  }
  return rows;
}

export function parseXlsx(buffer: ArrayBuffer): { rows: unknown[][]; sheetName: string } {
  // cellFormula:false is the KEY tolerance: SheetJS throws "ERROR <code>@<cell>"
  // (e.g. 2185920330@E352) when a cell holds a formula it cannot parse —
  // corrupted/foreign formulas are common in real cash-flow sheets. Skipping
  // formula parsing reads each cell's cached/display value instead, which is
  // exactly what an import needs. cellNF/cellHTML false skip equally
  // crash-prone number-format and HTML parsing.
  //
  // Total-failure guard: even with those flags, a deeply malformed workbook
  // can still make SheetJS throw (corrupt zip, truncated file, foreign
  // formula engine). The import path must NEVER crash the page over a file —
  // return an empty grid and let the caller report a friendly error.
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: "array",
      cellFormula: false,
      cellNF: false,
      cellHTML: false,
    });
  } catch (err) {
    console.error("parseXlsx: SheetJS read failed", err);
    return { rows: [], sheetName: "" };
  }
  if (workbook.SheetNames.length === 0) {
    console.error("parseXlsx: workbook has no sheets");
    return { rows: [], sheetName: "" };
  }

  // Real-world files carry several sheets (bank statements, old data…) and
  // the cash-flow sheet is NOT always first — this one has six "Extrato BB"
  // tabs before "SISPRIME 2026". Pick by name first, then by content.
  let sheetName: string;
  let sheet: XLSX.WorkSheet | undefined;
  try {
    sheetName = pickCashFlowSheet(workbook);
    sheet = workbook.Sheets[sheetName];
  } catch (err) {
    console.error("parseXlsx: sheet picking failed", err);
    return { rows: [], sheetName: "" };
  }

  let rawRows: unknown[][];
  try {
    rawRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
    }) as unknown[][];
  } catch (err) {
    console.error("parseXlsx: sheet_to_json failed", err);
    return { rows: [], sheetName };
  }

  // Last line of defense: any cell that still surfaces as a SheetJS error
  // object (t === "e") is normalized to an empty string instead of crashing
  // or producing garbage values.
  const clean = rawRows.map((row) =>
    row.map((cell) => {
      if (cell && typeof cell === "object" && "t" in cell && (cell as { t: string }).t === "e") {
        return "";
      }
      return cell;
    })
  );
  return { rows: clean, sheetName };
}

// Prefers the sheet named like a cash flow ("fluxo", "sisprime", the year),
// then scans every sheet's first rows for the month header / "Fluxo de
// Caixa" title. Falls back to the first sheet (the pre-multi-sheet
// behavior) so single-sheet files keep working unchanged.
function pickCashFlowSheet(workbook: XLSX.WorkBook): string {
  const names = workbook.SheetNames;

  const named = names.find((name) => {
    const lower = name.toLowerCase();
    return (
      lower.includes("fluxo") ||
      lower.includes("sisprime") ||
      /(^|\s)(20\d{2})(\s|$)/.test(lower)
    );
  });
  if (named) return named;

  for (const name of names) {
    let probe: unknown[][] = [];
    try {
      probe = (
        XLSX.utils.sheet_to_json(workbook.Sheets[name], {
          header: 1,
          defval: "",
          raw: true,
        }) as unknown[][]
      ).slice(0, 30);
    } catch (err) {
      // A sheet with corrupt formulas can make sheet_to_json throw even
      // with cellFormula:false — skip the probe for that sheet instead of
      // crashing the whole import.
      console.error("parseXlsx: probe failed for sheet", name, err);
      continue;
    }
    if (sheetLooksLikeCashFlow(probe)) return name;
  }

  return names[0];
}

// Detects the EctoLab cash-flow layout in the first rows: either the
// "Fluxo de Caixa - YYYY" title or a header row with at least 6 month
// names (Janeiro…Dezembro).
function sheetLooksLikeCashFlow(rows: unknown[][]): boolean {
  for (const row of rows.slice(0, 5)) {
    if (!Array.isArray(row)) continue;
    const firstCell = String(row[0] ?? "").trim().toLowerCase();
    if (firstCell.startsWith("fluxo de caixa")) return true;
  }
  const monthCount = new Set(
    rows
      .flat()
      .map((cell) => String(cell ?? "").trim().toLowerCase())
      .filter((cell) => (MONTH_NAMES as readonly string[]).includes(cell))
  ).size;
  return monthCount >= 6;
}

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB — bounds memory, not use

export async function parseFinanceiroFile(
  file: File
): Promise<ParseFileResult> {
  if (file.size === 0) {
    return { ok: false, error: "O arquivo está vazio." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "O arquivo é grande demais (máx. 2MB)." };
  }

  const name = file.name.toLowerCase();
  let rows: unknown[][];

  try {
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const buffer = await file.arrayBuffer();
      rows = parseXlsx(buffer).rows;
    } else if (name.endsWith(".csv")) {
      rows = parseCsv(await file.text());
    } else {
      return {
        ok: false,
        error: "Formato não suportado. Envie um arquivo .csv ou .xlsx.",
      };
    }
  } catch (err) {
    console.error("parseFinanceiroFile: falha ao ler arquivo", err);
    return {
      ok: false,
      error:
        "Não foi possível ler o arquivo. Se for XLSX, verifique se não há fórmulas corrompidas (células com #REF! ou erros) — salve como .csv e tente novamente.",
    };
  }

  // Auto-detect format: EctoLab monthly cash-flow vs flat ledger
  if (isEctolabFormat(rows)) {
    const entries = parseEctolabRows(rows);
    if (entries === null) {
      return {
        ok: false,
        error:
          "Detectamos o formato de fluxo de caixa mensal, mas não conseguimos extrair os lançamentos. Verifique se as colunas de mês (Janeiro … Dezembro) estão presentes.",
      };
    }
    if (entries.length === 0) {
      return {
        ok: false,
        error:
          "Nenhum lançamento encontrado no fluxo de caixa (todos os valores estão zerados?).",
      };
    }
    return { ok: true, entries };
  }

  const entries = parseSheetRows(rows);
  if (entries === null) {
    return {
      ok: false,
      error:
        "A planilha tem linhas inválidas. Esperado: Data; Descrição; Tipo (entrada/saída); Valor; Categoria (opcional), com cabeçalho na primeira linha.",
    };
  }
  if (entries.length === 0) {
    return {
      ok: false,
      error: "Nenhum lançamento encontrado no arquivo (apenas cabeçalho?).",
    };
  }
  return { ok: true, entries };
}

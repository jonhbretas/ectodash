// src/lib/financeiro/parse-file.ts
// Manual spreadsheet import parsing — CSV (PT-BR: semicolon or comma
// delimited, quoted fields) and XLSX (first sheet, via the xlsx package).
// Both produce the same raw unknown[][] grid the Sheets-sync pipeline
// already validates with parseSheetRows (src/lib/sheets/parse-rows.ts) —
// one validation boundary for every financial ingest path.
import * as XLSX from "xlsx";
import { parseSheetRows } from "@/lib/sheets/parse-rows";
import type { FinancialEntry } from "@/lib/sheets/parse-rows";

export type ParseFileResult =
  | { ok: true; entries: FinancialEntry[] }
  | { ok: false; error: string };

// Minimal RFC-4180-ish CSV tokenizer: handles quoted fields (with embedded
// separators/newlines) and detects ";" vs "," by counting each on the first
// non-comment line.
export function parseCsv(texto: string): unknown[][] {
  const lines = texto.replace(/\r\n/g, "\n").split("\n");
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

export function parseXlsx(buffer: ArrayBuffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("O arquivo XLSX não contém nenhuma planilha.");
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
  return rows;
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
      rows = parseXlsx(buffer);
    } else if (name.endsWith(".csv")) {
      rows = parseCsv(await file.text());
    } else {
      return {
        ok: false,
        error: "Formato não suportado. Envie um arquivo .csv ou .xlsx.",
      };
    }
  } catch {
    return {
      ok: false,
      error: "Não foi possível ler o arquivo. Verifique se ele está íntegro.",
    };
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

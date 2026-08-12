// src/lib/financeiro/parse-file.ts
// Manual spreadsheet import parsing — CSV (PT-BR: semicolon or comma
// delimited, quoted fields) e XLSX (via read-excel-file, mantida — o pacote
// xlsx/SheetJS do npm (0.18.5) está descontinuado e possui CVEs conhecidas,
// auditoria 0063/M3).
import readXlsxFile from "read-excel-file/node";
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

export async function parseXlsx(buffer: ArrayBuffer): Promise<{ rows: unknown[][]; sheetName: string }> {
  const data = Buffer.from(buffer);
  try {
    // read-excel-file lê o workbook inteiro de uma vez, devolvendo o nome e
    // a grade de cada sheet — sem re-leitura por sheet.
    let sheets: { sheet: string; data: unknown[][] }[];
    try {
      sheets = (await readXlsxFile(data)) as { sheet: string; data: unknown[][] }[];
    } catch (err) {
      console.error("parseXlsx: readXlsxFile failed", err);
      return { rows: [], sheetName: "" };
    }
    if (sheets.length === 0) {
      console.error("parseXlsx: workbook has no sheets");
      return { rows: [], sheetName: "" };
    }

    // Real-world files carry several sheets (bank statements, old data…) and
    // the cash-flow sheet is NOT always first — this one has six "Extrato BB"
    // tabs before "SISPRIME 2026". Pick by name first, then by content.
    let sheetName: string;
    try {
      sheetName = pickCashFlowSheet(sheets);
    } catch (err) {
      console.error("parseXlsx: sheet picking failed", err);
      return { rows: [], sheetName: "" };
    }

    const rawRows = sheets.find((s) => s.sheet === sheetName)?.data ?? [];

    // Normalização de grade: células vazias viram "" (não null), linhas são
    // completadas até a largura máxima e datas (Date) viram yyyy-MM-dd para
    // manter o contrato dos parsers de entrada financeira.
    const width = rawRows.reduce((max, row) => Math.max(max, row.length), 0);
    const clean = rawRows.map((row) => {
      const out = row.map((cell) => {
        if (cell instanceof Date) return cell.toISOString().slice(0, 10);
        if (cell === null || cell === undefined) return "";
        return cell;
      });
      while (out.length < width) out.push("");
      return out;
    });
    return { rows: clean, sheetName };
  } catch (err) {
    console.error("parseXlsx: read failed", err);
    return { rows: [], sheetName: "" };
  }
}

// Prefere a sheet com nome de fluxo de caixa ("fluxo", "sisprime", o ano),
// então varre o conteúdo das primeiras linhas de cada sheet em busca do
// cabeçalho de meses / título "Fluxo de Caixa". Cai para a primeira sheet
// (comportamento pré-multi-sheet) quando nada casa.
function pickCashFlowSheet(sheets: { sheet: string; data: unknown[][] }[]): string {
  const named = sheets.find((s) => {
    const lower = s.sheet.toLowerCase();
    return (
      lower.includes("fluxo") ||
      lower.includes("sisprime") ||
      /(^|\s)(20\d{2})(\s|$)/.test(lower)
    );
  });
  if (named) return named.sheet;

  for (const s of sheets) {
    if (sheetLooksLikeCashFlow(s.data.slice(0, 30))) return s.sheet;
  }

  return sheets[0].sheet;
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
    if (name.endsWith(".xlsx")) {
      const buffer = await file.arrayBuffer();
      rows = (await parseXlsx(buffer)).rows;
    } else if (name.endsWith(".xls")) {
      // read-excel-file suporta apenas .xlsx (auditoria 0063/M3) — o .xls
      // legado é orientado a salvar como .xlsx ou .csv.
      return {
        ok: false,
        error:
          "O formato .xls não é suportado. Abra a planilha e salve como .xlsx (ou .csv) e tente novamente.",
      };
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

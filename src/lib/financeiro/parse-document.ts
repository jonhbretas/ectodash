// src/lib/financeiro/parse-document.ts
// Auditoria 0063/M3: parse de XLSX via read-excel-file (mantida) — o pacote
// xlsx (SheetJS npm) está descontinuado e tem CVEs conhecidas.
import readXlsxFile from "read-excel-file/node";
import { parseCsv } from "./parse-file";
import { classifyDescription, type NormalizedFinancialRow } from "./automation";

export type DocumentParseResult = { format: "CSV" | "XLSX" | "OFX" | "PDF"; sourceType: string; provider?: string; rows: NormalizedFinancialRow[]; warnings: string[] };

function number(value: unknown): number {
  const text = String(value ?? "").replace(/R\$\s?/gi, "").replace(/\s/g, "").trim();
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const result = Number(normalized.replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(result) ? result : 0;
}

function date(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);
  if (br) return `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

function headerIndex(headers: string[], patterns: RegExp[]): number { return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header))); }

function rowsFromGrid(grid: unknown[][], sheet?: string): NormalizedFinancialRow[] {
  const headerRow = grid.findIndex((row) => row.filter(Boolean).length >= 2 && row.some((cell) => /data|date|valor|amount|descri|memo|histórico|historico/i.test(String(cell))));
  if (headerRow < 0) return [];
  const headers = grid[headerRow].map((cell) => String(cell ?? "").toLowerCase().trim());
  const dateCol = headerIndex(headers, [/^data$|date|movimento|lançamento|lancamento/]);
  const descriptionCol = headerIndex(headers, [/descri|memo|histórico|historico|favorecido|merchant|estabelecimento/]);
  const amountCol = headerIndex(headers, [/valor|amount|montante|total|saldo/]);
  const creditCol = headerIndex(headers, [/crédito|credito|credit|entrada/]);
  const debitCol = headerIndex(headers, [/débito|debito|debit|saída|saida/]);
  const categoryCol = headerIndex(headers, [/categoria|category|centro/]);
  if (dateCol < 0 || descriptionCol < 0 || (amountCol < 0 && creditCol < 0 && debitCol < 0)) return [];
  return grid.slice(headerRow + 1).flatMap((row, index) => {
    if (!row.some((cell) => String(cell ?? "").trim())) return [];
    const credit = creditCol >= 0 ? number(row[creditCol]) : 0;
    const debit = debitCol >= 0 ? number(row[debitCol]) : 0;
    const amount = amountCol >= 0 ? number(row[amountCol]) : credit - debit;
    if (!amount) return [];
    const result = classifyDescription(String(row[descriptionCol] ?? ""), amount, date(row[dateCol]), headerRow + index + 2);
    result.sheet = sheet;
    result.category = categoryCol >= 0 ? String(row[categoryCol] ?? "").trim() || undefined : undefined;
    return [result];
  });
}

function parseOfx(text: string): NormalizedFinancialRow[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  return blocks.flatMap((block, index) => {
    const value = /<TRNAMT>([^<]+)/i.exec(block)?.[1];
    const dt = /<DTPOSTED>(\d{4})(\d{2})(\d{2})/i.exec(block);
    const memo = /<MEMO>([^<]+)/i.exec(block)?.[1] ?? /<NAME>([^<]+)/i.exec(block)?.[1] ?? "OFX transaction";
    if (!value || !dt) return [];
    return [classifyDescription(memo.trim(), Number(value), `${dt[1]}-${dt[2]}-${dt[3]}`, index + 1, memo.trim())];
  });
}

export async function parseFinancialDocument(file: File): Promise<DocumentParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ofx")) { const rows = parseOfx(await file.text()); return { format: "OFX", sourceType: "BANK_STATEMENT", rows, warnings: rows.length ? [] : ["Nenhuma transação OFX encontrada."] }; }
  if (name.endsWith(".pdf")) {
    // Lazy-load: pdf-parse -> pdfjs-dist requires DOM globals (DOMMatrix,
    // Path2D, ImageData) that don't exist in the serverless Node runtime —
    // loading it eagerly crashes every non-PDF import too (production logs:
    // "ReferenceError: DOMMatrix is not defined"). Only pull it in for PDFs,
    // and never let a PDF parsing failure 500 the whole batch.
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
      const result = await parser.getText();
      await parser.destroy();
      const rows = rowsFromGrid(result.text.split("\n").map((line) => line.split(/\s{2,}|\t/)), "PDF");
      return { format: "PDF", sourceType: "BANK_STATEMENT", rows, warnings: rows.length ? [] : ["PDF lido, mas o layout precisa de revisão manual."] };
    } catch {
      return { format: "PDF", sourceType: "BANK_STATEMENT", rows: [], warnings: ["PDF não pôde ser processado neste ambiente — envie o extrato como .csv ou .xlsx."] };
    }
  }
  if (name.endsWith(".csv")) { const rows = rowsFromGrid(parseCsv(await file.text())); return { format: "CSV", sourceType: "UNKNOWN", rows, warnings: rows.length ? [] : ["Cabeçalho financeiro não identificado."] }; }
  if (name.endsWith(".xls")) {
    return { format: "XLSX", sourceType: "UNKNOWN", rows: [], warnings: ["O formato .xls não é suportado — salve como .xlsx ou .csv."] };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const sheets = (await readXlsxFile(buffer).catch(() => [])) as {
    sheet: string;
    data: unknown[][];
  }[];
  const rows = [];
  for (const { sheet, data } of sheets) {
    rows.push(...rowsFromGrid(normalizeGrid(data), sheet));
  }
  return { format: "XLSX", sourceType: "UNKNOWN", rows, warnings: rows.length ? [] : ["Nenhuma tabela financeira foi identificada."] };
}

// read-excel-file devolve células vazias como null e datas como Date —
// normaliza para o contrato de grade dos parsers ("" / yyyy-MM-dd).
function normalizeGrid(grid: unknown[][]): unknown[][] {
  return grid.map((row) =>
    row.map((cell) => {
      if (cell instanceof Date) return cell.toISOString().slice(0, 10);
      if (cell === null || cell === undefined) return "";
      return cell;
    })
  );
}

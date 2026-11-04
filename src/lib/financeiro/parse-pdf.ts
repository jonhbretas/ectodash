import { hashLine, type NormalizedFinancialRow } from "./automation";
import { parseFinancialAmount, parseFinancialDate } from "./values";
import type { DocumentParseResult } from "./parse-document";

type GridParser = (grid: unknown[][], sheet?: string, filename?: string) => Omit<DocumentParseResult, "format">;

// Fallback for PDFs whose entire line is a single text item. Require a
// recognizable statement header; never infer movements from invoice totals.
export function statementGrid(text: string): unknown[][] | null {
  const lines = text.split(/\r?\n/);
  const header = lines.findIndex((line) => /data/.test(line.toLowerCase()) && /hist[oó]rico|descri[cç]/i.test(line) && /valor/i.test(line));
  if (header < 0 || /cr[eé]dito|d[eé]bito/i.test(lines[header])) return null;
  const grid: unknown[][] = lines.slice(0, header).map(() => []);
  grid.push(["Data", "Descrição", "Valor"]);
  const money = "(?:R\\$\\s*)?[+-]?(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)[,.]\\d{2}\\s*[DC]?";
  const transaction = new RegExp(`^(\\d{1,2}[/-]\\d{1,2}[/-](?:\\d{4}|\\d{2})|\\d{4}-\\d{2}-\\d{2})\\s+(.+?)\\s+(${money})(?:\\s+${money})?\\s*$`, "i");
  for (const line of lines.slice(header + 1)) {
    if (!/^\s*(?:\d{1,2}[/-]\d{1,2}[/-]|\d{4}-\d{2}-\d{2})/.test(line)) { grid.push([]); continue; }
    const match = transaction.exec(line.trim());
    // Keep unrecognized dated lines as invalid rows so the grid parser warns.
    if (!match) { grid.push([line.trim().split(/\s/)[0], line.trim(), ""]); continue; }
    if (/^saldo(?:\s|$)/i.test(match[2])) { grid.push([]); continue; }
    grid.push([parseFinancialDate(match[1]) ?? match[1], match[2], parseFinancialAmount(match[3]) ?? match[3]]);
  }
  return grid;
}

export async function readFinancialPdf(file: File, parseGrid: GridParser): Promise<DocumentParseResult> {
  const rows: NormalizedFinancialRow[] = [];
  const warnings: string[] = [];
  let provider: string | undefined;
  let sourceType = "UNKNOWN";
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()), isEvalSupported: false });
    try {
      // Bound work; partial extraction must be explicit, including mixed PDFs.
      const result = await parser.getText({ first: 100, pageJoiner: "" });
      if (result.total > result.pages.length) warnings.push(`PDF com ${result.total} páginas: somente as primeiras 100 foram lidas. Confira as páginas restantes manualmente.`);
      for (const page of result.pages) {
        const sheet = `PDF · página ${page.num}`;
        if (!page.text.trim()) {
          warnings.push(`${sheet}: sem texto extraível (possível digitalização). Necessário OCR ou preenchimento manual.`);
          continue;
        }
        let parsed = parseGrid(page.text.split("\n").map((line) => line.trim().split(/\t|\s{2,}/)), sheet, file.name);
        if (!parsed.rows.length) {
          const grid = statementGrid(page.text);
          if (grid) parsed = parseGrid(grid, sheet, file.name);
        }
        rows.push(...parsed.rows.map((row) => ({ ...row, sheet, lineHash: hashLine(`${sheet}|${row.lineHash}`) })));
        warnings.push(...parsed.warnings.map((warning) => `${sheet}: ${warning}`));
        if (!parsed.rows.length) warnings.push(`${sheet}: texto lido, mas sem lançamentos reconhecidos. Confira o documento original.`);
        provider ??= parsed.provider;
        if (parsed.sourceType !== "UNKNOWN") sourceType = parsed.sourceType;
      }
      if (!result.pages.length) warnings.push("PDF sem páginas legíveis; confira o documento original.");
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    warnings.push(name === "PasswordException"
      ? "PDF protegido por senha. Envie uma cópia desbloqueada para leitura."
      : "Não foi possível concluir a leitura do PDF. Verifique se está íntegro e desbloqueado e confira o original.");
  }
  return { format: "PDF", sourceType, provider, rows, warnings };
}

// Parsers for the source formats used by Ectolab. Keep amounts and dates
// deterministic: unreadable values become review warnings, never zero/today.
import readXlsxFile from "read-excel-file/node";
import { parseCsv } from "./parse-file";
import { calculateNet, classifyDescription, type NormalizedFinancialRow } from "./automation";

export type DocumentParseResult = { format: "CSV" | "XLSX" | "OFX" | "PDF" | "IMAGE"; sourceType: string; provider?: string; rows: NormalizedFinancialRow[]; warnings: string[] };

type ParsedGrid = { rows: NormalizedFinancialRow[]; warnings: string[]; provider?: string; sourceType: string };
const clean = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const col = (headers: string[], patterns: RegExp[]) => headers.findIndex((header) => patterns.some((pattern) => pattern.test(clean(header))));

function number(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").replace(/R\$\s?/gi, "").replace(/\s/g, "").trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text);
  text = text.replace(/[()]/g, "");
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  text = text.replace(/[^0-9.+-]/g, "");
  if (!text) return null;
  const result = Number(text);
  return Number.isFinite(result) ? (negative ? -Math.abs(result) : result) : null;
}

function date(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 20000 && value < 90000) return new Date(Math.round((value - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  const text = String(value ?? "").trim();
  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const parts = br ? [br[3].length === 2 ? `20${br[3]}` : br[3], br[2].padStart(2, "0"), br[1].padStart(2, "0")] : iso?.slice(1);
  if (!parts) return null;
  const [year, month, day] = parts;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === `${year}-${month}-${day}` ? `${year}-${month}-${day}` : null;
}

function makeRow(description: string, amount: number, movementDate: string, line: number, externalId?: string) {
  const row = classifyDescription(description, amount, movementDate, line, description);
  if (externalId) row.externalId = externalId.trim();
  return row;
}

function rowsFromGrid(grid: unknown[][], sheet?: string, filename = ""): ParsedGrid {
  const headerRow = grid.findIndex((row) => row.filter((cell) => String(cell ?? "").trim()).length >= 2 && row.some((cell) => /data|date|valor|amount|descri|memo|historico|historico/i.test(clean(cell))));
  if (headerRow < 0) return { rows: [], warnings: ["Cabeçalho financeiro não identificado."], sourceType: "UNKNOWN" };
  const headers = grid[headerRow].map(clean);
  const joined = `${headers.join(" ")} ${clean(filename)} ${clean(sheet)}`;
  const isStripe = /stripe/.test(joined) || (headers.some((h) => /^amount$/.test(h)) && headers.some((h) => /fee/.test(h)) && headers.some((h) => /customer|captured|transfer|status/.test(h)));
  const isCielo = /cielo/.test(joined) || (headers.some((h) => /valor da venda/.test(h)) && headers.some((h) => /previsao de pag|valor liquido/.test(h)));
  const isSisprime = /sisprime/.test(joined) || (headers.some((h) => /cod\. historico|historico/.test(h)) && headers.some((h) => /^tipo$/.test(h)));
  const isPagBank = /pag ?bank/.test(joined) || (headers.some((h) => /codigo da transacao/.test(h)) && headers.some((h) => /^tipo$/.test(h)));
  const provider = isStripe ? "STRIPE" : isCielo ? "CIELO" : isSisprime ? "SISPRIME" : isPagBank ? "PAGBANK" : undefined;
  const warnings: string[] = [];
  const rows: NormalizedFinancialRow[] = [];

  if (isCielo) {
    const saleDateCol = col(headers, [/data.*venda/, /^data$/]);
    const grossCol = col(headers, [/valor da venda/, /valor bruto/, /^valor$/]);
    const feeCol = col(headers, [/taxa/, /desconto/]);
    const netCol = col(headers, [/valor liquido/, /valor recebido/]);
    const expectedCol = col(headers, [/previsao de pag/, /data prevista/, /data.*pagamento/]);
    const idCol = col(headers, [/nsu/, /id.*venda/, /codigo.*venda/, /tid/]);
    if (saleDateCol < 0 || grossCol < 0) return { rows, warnings: ["Layout Cielo reconhecido, mas faltam data ou valor bruto."], provider, sourceType: "PAYMENT_PROCESSOR" };
    grid.slice(headerRow + 1).forEach((cells, index) => {
      const line = headerRow + index + 2;
      const gross = number(cells[grossCol]);
      if (gross === null || gross === 0) return;
      const saleDate = date(cells[saleDateCol]);
      if (!saleDate) { warnings.push(`Linha ${line}: data da venda inválida; revise o documento.`); return; }
      const fee = feeCol >= 0 ? Math.abs(number(cells[feeCol]) ?? 0) : 0;
      const net = netCol >= 0 ? number(cells[netCol]) : calculateNet({ gross: Math.abs(gross), fee, tax: 0, refund: 0, chargeback: 0 });
      if (net === null) { warnings.push(`Linha ${line}: valor líquido ilegível; revise o documento.`); return; }
      const row = makeRow("Venda Cielo", Math.abs(net), saleDate, line, idCol >= 0 ? String(cells[idCol] ?? "") : undefined);
      row.type = "RECEITA_FATURADA"; row.gross = Math.abs(gross); row.fee = fee; row.net = Math.abs(net); row.inflow = 0; row.outflow = 0; row.provider = "CIELO"; row.confidence = .94; row.saleDate = saleDate;
      row.explanation = "Venda Cielo identificada; valor líquido e data de venda preservados para conciliação com o recebimento.";
      const expected = expectedCol >= 0 ? date(cells[expectedCol]) : null;
      if (expected) row.expectedDate = expected;
      rows.push(row);
    });
    return { rows, warnings, provider, sourceType: "PAYMENT_PROCESSOR" };
  }

  if (isStripe) {
    const idCol = col(headers, [/^id$/, /transaction.*id/]);
    const dateCol = col(headers, [/created/, /^date$/]);
    const amountCol = col(headers, [/^converted amount$/, /^amount$/]);
    const feeCol = col(headers, [/^fee$/, /processing fee/]);
    const refundCol = col(headers, [/amount refunded|refund/]);
    const taxCol = col(headers, [/^tax$/]);
    const statusCol = col(headers, [/^status$/]);
    const descCol = col(headers, [/description|statement descriptor|^type$/]);
    if (dateCol < 0 || amountCol < 0) return { rows, warnings: ["Layout Stripe reconhecido, mas faltam data ou valor."], provider, sourceType: "PAYMENT_PROCESSOR" };
    grid.slice(headerRow + 1).forEach((cells, index) => {
      const line = headerRow + index + 2;
      const amount = number(cells[amountCol]);
      if (amount === null || amount === 0) return;
      const status = statusCol >= 0 ? clean(cells[statusCol]) : "";
      if (status && !/succeeded|paid|captured|complete/.test(status)) return;
      const movementDate = date(cells[dateCol]);
      if (!movementDate) { warnings.push(`Linha ${line}: data Stripe inválida; revise o documento.`); return; }
      const gross = Math.abs(amount);
      const fee = Math.abs(feeCol >= 0 ? number(cells[feeCol]) ?? 0 : 0);
      const refund = Math.abs(refundCol >= 0 ? number(cells[refundCol]) ?? 0 : 0);
      const tax = Math.abs(taxCol >= 0 ? number(cells[taxCol]) ?? 0 : 0);
      const net = calculateNet({ gross, fee, tax, refund, chargeback: 0 });
      const description = descCol >= 0 ? String(cells[descCol] ?? "Pagamento Stripe") : "Pagamento Stripe";
      const row = makeRow(description || "Pagamento Stripe", net, movementDate, line, idCol >= 0 ? String(cells[idCol] ?? "") : undefined);
      row.type = refund ? "ESTORNO" : "RECEITA_FATURADA"; row.gross = gross; row.fee = fee; row.tax = tax; row.refund = refund; row.net = net; row.inflow = 0; row.outflow = 0; row.provider = "STRIPE"; row.confidence = .92; row.saleDate = movementDate;
      row.explanation = "Pagamento Stripe com valor bruto, taxa e estorno separados; recebimento bancário será conciliado em etapa própria.";
      rows.push(row);
    });
    return { rows, warnings, provider, sourceType: "PAYMENT_PROCESSOR" };
  }

  const dateCol = col(headers, [/^data$|date|movimento|lancamento/]);
  const descriptionCol = col(headers, [/descri|memo|historico|favorecido|merchant|estabelecimento|^historico$/]);
  const amountCol = col(headers, [/^valor r\$|^valor$|amount|montante/]);
  const creditCol = col(headers, [/credito|credit|entrada/]);
  const debitCol = col(headers, [/debito|debit|saida/]);
  const directionCol = col(headers, [/^tipo$/]);
  const idCol = col(headers, [/codigo da transacao|transaction.?id|^id$/]);
  const detailCol = col(headers, [/detalhamento hist|detalhamento|descricao/]);
  const categoryCol = col(headers, [/categoria|category|plano de contas|centro de custo/]);
  if (dateCol < 0 || descriptionCol < 0 || (amountCol < 0 && creditCol < 0 && debitCol < 0)) return { rows: [], warnings: ["Cabeçalho financeiro não identificado."], provider, sourceType: "UNKNOWN" };
  grid.slice(headerRow + 1).forEach((cells, index) => {
    const line = headerRow + index + 2;
    const movementDate = date(cells[dateCol]);
    const baseAmount = amountCol >= 0 ? number(cells[amountCol]) : null;
    const credit = creditCol >= 0 ? number(cells[creditCol]) : 0;
    const debit = debitCol >= 0 ? number(cells[debitCol]) : 0;
    if (!movementDate || (baseAmount === null && credit === null && debit === null)) {
      if (cells.some((cell) => String(cell ?? "").trim())) warnings.push(`Linha ${line}: data ou valor inválido; linha separada para revisão.`);
      return;
    }
    let amount = baseAmount ?? Number(credit || 0) - Number(debit || 0);
    const direction = directionCol >= 0 ? clean(cells[directionCol]) : "";
    if (isSisprime && /^(d|debito|debit|saida)$/.test(direction)) amount = -Math.abs(amount);
    else if (isSisprime && /^(c|credito|credit|entrada)$/.test(direction)) amount = Math.abs(amount);
    if (isPagBank && /debit|saida|pagamento|tarifa/i.test(direction)) amount = -Math.abs(amount);
    if (amount === 0) return;
    const description = [cells[descriptionCol], detailCol >= 0 ? cells[detailCol] : ""].map((value) => String(value ?? "").trim()).filter(Boolean).join(" — ");
    const row = makeRow(description, amount, movementDate, line, idCol >= 0 ? String(cells[idCol] ?? "") : undefined);
    row.sheet = sheet; row.provider = provider;
    row.category = categoryCol >= 0 ? String(cells[categoryCol] ?? "").trim() || undefined : undefined;
    if (isPagBank) row.confidence = .9;
    rows.push(row);
  });
  return { rows, warnings, provider, sourceType: isSisprime || isPagBank ? "BANK_STATEMENT" : "UNKNOWN" };
}

function parseOfx(text: string): NormalizedFinancialRow[] {
  return text.split(/<STMTTRN>/i).slice(1).flatMap((block, index) => {
    const value = number(/<TRNAMT>([^<]+)/i.exec(block)?.[1]);
    const dt = /<DTPOSTED>(\d{4})(\d{2})(\d{2})/i.exec(block);
    const memo = /<MEMO>([^<]+)/i.exec(block)?.[1] ?? /<NAME>([^<]+)/i.exec(block)?.[1] ?? "OFX transaction";
    const id = /<FITID>([^<]+)/i.exec(block)?.[1];
    if (value === null || !dt) return [];
    return [makeRow(memo.trim(), value, `${dt[1]}-${dt[2]}-${dt[3]}`, index + 1, id)];
  });
}

export async function parseFinancialDocument(file: File): Promise<DocumentParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ofx")) { const rows = parseOfx(await file.text()); return { format: "OFX", sourceType: "BANK_STATEMENT", provider: "BANK", rows, warnings: rows.length ? [] : ["Nenhuma transação OFX encontrada."] }; }
  if (/\.(jpe?g|png|webp|heic)$/.test(name)) return { format: "IMAGE", sourceType: "UNKNOWN", rows: [], warnings: ["Imagem arquivada; OCR não disponível nesta etapa. Confira os dados e preencha manualmente."] };
  if (name.endsWith(".pdf")) {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
      const result = await parser.getText(); await parser.destroy();
      const parsed = rowsFromGrid(result.text.split("\n").map((line) => line.split(/\s{2,}|\t/)), "PDF", file.name);
      return { format: "PDF", sourceType: parsed.sourceType, provider: parsed.provider, rows: parsed.rows, warnings: parsed.rows.length ? parsed.warnings : [...parsed.warnings, "PDF lido, mas o layout exige revisão manual ou envio de CSV/Excel."] };
    } catch { return { format: "PDF", sourceType: "UNKNOWN", rows: [], warnings: ["PDF sem extração legível neste ambiente; revisar manualmente ou enviar CSV/Excel."] }; }
  }
  if (name.endsWith(".csv")) { const parsed = rowsFromGrid(parseCsv(await file.text()), undefined, file.name); return { format: "CSV", ...parsed, warnings: parsed.rows.length ? parsed.warnings : [...parsed.warnings, "Nenhuma transação reconhecida."] }; }
  if (name.endsWith(".xls")) return { format: "XLSX", sourceType: "UNKNOWN", rows: [], warnings: ["O formato .xls não é suportado — salve como .xlsx ou .csv."] };
  const buffer = Buffer.from(await file.arrayBuffer());
  const sheets = (await readXlsxFile(buffer).catch(() => [])) as { sheet: string; data: unknown[][] }[];
  const rows: NormalizedFinancialRow[] = []; const warnings: string[] = []; let provider: string | undefined; let sourceType = "UNKNOWN";
  for (const { sheet, data } of sheets) {
    const parsed = rowsFromGrid(normalizeGrid(data), sheet, file.name);
    rows.push(...parsed.rows); warnings.push(...parsed.warnings.map((warning) => `${sheet}: ${warning}`)); provider ??= parsed.provider;
    if (parsed.sourceType !== "UNKNOWN") sourceType = parsed.sourceType;
  }
  return { format: "XLSX", sourceType, provider, rows, warnings: rows.length ? warnings : [...warnings, "Nenhuma tabela financeira foi identificada."] };
}

function normalizeGrid(grid: unknown[][]): unknown[][] {
  return grid.map((row) => row.map((cell) => {
    if (cell instanceof Date) return cell.toISOString().slice(0, 10);
    return cell === null || cell === undefined ? "" : cell;
  }));
}

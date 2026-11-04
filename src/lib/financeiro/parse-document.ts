// Parsers for the source formats used by Ectolab. Keep amounts and dates
// deterministic: unreadable values become review warnings, never zero/today.
import { parseFinancialAmount as number, parseFinancialDate as date } from "./values";
import { readFinancialPdf } from "./parse-pdf";
import { readFinancialWorkbook } from "./workbook";
import { parseCsv } from "./parse-file";
import { calculateNet, classifyDescription, hashLine, type NormalizedFinancialRow } from "./automation";

export type DocumentParseResult = { format: "CSV" | "XLSX" | "OFX" | "PDF" | "IMAGE" | "XML"; sourceType: string; provider?: string; rows: NormalizedFinancialRow[]; warnings: string[] };

type ParsedGrid = { rows: NormalizedFinancialRow[]; warnings: string[]; provider?: string; sourceType: string };
const clean = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const col = (headers: string[], patterns: RegExp[]) => headers.findIndex((header) => patterns.some((pattern) => pattern.test(clean(header))));

function makeRow(description: string, amount: number, movementDate: string, line: number, externalId?: string) {
  const row = classifyDescription(description, amount, movementDate, line, description);
  if (externalId) row.externalId = externalId.trim();
  return row;
}

function rowsFromGrid(grid: unknown[][], sheet?: string, filename = ""): ParsedGrid {
  const headerRow = grid.findIndex((row) => row.filter((cell) => String(cell ?? "").trim()).length >= 3 && row.some((cell) => /^(data\b|date\b|created\b|movimento\b|lancamento\b)/.test(clean(cell))) && row.some((cell) => /^(valor\b|amount\b|credito\b|debito\b|entrada\b|saida\b)/.test(clean(cell))));
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
    const statusCol = col(headers, [/status.*venda/, /^status$/]);
    if (saleDateCol < 0 || grossCol < 0) return { rows, warnings: ["Layout Cielo reconhecido, mas faltam data ou valor bruto."], provider, sourceType: "PAYMENT_PROCESSOR" };
    grid.slice(headerRow + 1).forEach((cells, index) => {
      const line = headerRow + index + 2;
      if (cells.every((cell, i) => clean(cell) === headers[i])) return;
      const status = statusCol >= 0 ? clean(cells[statusCol]) : "";
      if (/nao aprovad|negad|recusad|cancelad|declined|failed/.test(status)) return;
      const gross = number(cells[grossCol]);
      if (cells.every((cell) => !String(cell ?? "").trim())) return;
      if (gross === null) { warnings.push(`Linha ${line}: valor bruto inválido; revise o documento.`); return; }
      if (gross === 0) return;
      const saleDate = date(cells[saleDateCol]);
      if (!saleDate) { warnings.push(`Linha ${line}: data da venda inválida; revise o documento.`); return; }
      const parsedFee = feeCol >= 0 && String(cells[feeCol] ?? "").trim() ? number(cells[feeCol]) : 0;
      if (parsedFee === null) { warnings.push(`Linha ${line}: taxa inválida; revise o documento.`); return; }
      const fee = Math.abs(parsedFee);
      const net = netCol >= 0 ? number(cells[netCol]) : calculateNet({ gross: Math.abs(gross), fee, tax: 0, refund: 0, chargeback: 0 });
      if (net === null) { warnings.push(`Linha ${line}: valor líquido ilegível; revise o documento.`); return; }
      const row = makeRow("Venda Cielo", Math.abs(net), saleDate, line, idCol >= 0 ? String(cells[idCol] ?? "") : undefined);
      row.type = "RECEITA_FATURADA"; row.gross = Math.abs(gross); row.fee = fee; row.net = Math.abs(net); row.inflow = 0; row.outflow = 0; row.provider = "CIELO"; row.confidence = .94; row.saleDate = saleDate;
      row.explanation = "Venda Cielo identificada; valor líquido e data de venda preservados para conciliação com o recebimento.";
      const expected = expectedCol >= 0 ? date(cells[expectedCol]) : null;
      if (expectedCol >= 0 && String(cells[expectedCol] ?? "").trim() && !expected) warnings.push(`Linha ${line}: previsão de pagamento inválida; revise o documento.`);
      if (expected) row.expectedDate = expected;
      row.sheet = sheet;
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
      if (cells.every((cell) => !String(cell ?? "").trim())) return;
      if (amount === null) { warnings.push(`Linha ${line}: valor Stripe inválido; revise o documento.`); return; }
      if (amount === 0) return;
      const status = statusCol >= 0 ? clean(cells[statusCol]) : "";
      if (status && !/succeeded|paid|captured|complete/.test(status)) return;
      const movementDate = date(cells[dateCol]);
      if (!movementDate) { warnings.push(`Linha ${line}: data Stripe inválida; revise o documento.`); return; }
      const gross = Math.abs(amount);
      const costs = [feeCol, refundCol, taxCol].map((index) => index >= 0 && String(cells[index] ?? "").trim() ? number(cells[index]) : 0);
      if (costs.some((value) => value === null)) { warnings.push(`Linha ${line}: taxa, estorno ou imposto inválido; revise o documento.`); return; }
      const [fee, refund, tax] = costs.map((value) => Math.abs(value!));
      const net = calculateNet({ gross, fee, tax, refund, chargeback: 0 });
      const description = descCol >= 0 ? String(cells[descCol] ?? "Pagamento Stripe") : "Pagamento Stripe";
      const row = makeRow(description || "Pagamento Stripe", net, movementDate, line, idCol >= 0 ? String(cells[idCol] ?? "") : undefined);
      row.type = refund ? "ESTORNO" : "RECEITA_FATURADA"; row.gross = gross; row.fee = fee; row.tax = tax; row.refund = refund; row.net = net; row.inflow = 0; row.outflow = 0; row.provider = "STRIPE"; row.confidence = .92; row.saleDate = movementDate;
      row.explanation = "Pagamento Stripe com valor bruto, taxa e estorno separados; recebimento bancário será conciliado em etapa própria.";
      row.sheet = sheet;
      rows.push(row);
    });
    return { rows, warnings, provider, sourceType: "PAYMENT_PROCESSOR" };
  }

  const dateCol = col(headers, [/^data$|date|movimento|lancamento/]);
  const descriptionCol = col(headers, [/descri|memo|historico|favorecido|merchant|estabelecimento|pagador|recebedor|recebor/]);
  const amountCol = col(headers, [/^valor(?:\s|$)|amount|montante/]);
  const creditCol = col(headers, [/credito|credit|entrada/]);
  const debitCol = col(headers, [/debito|debit|saida/]);
  const directionCol = col(headers, [/^tipo(?:\s|$)/]);
  const idCol = col(headers, [/codigo da transacao|transaction.?id|^id$/]);
  const detailCol = col(headers, [/detalhamento hist|detalhamento|descricao/]);
  const categoryCol = col(headers, [/categoria|category|plano de contas|centro de custo/]);
  if (dateCol < 0 || descriptionCol < 0 || (amountCol < 0 && creditCol < 0 && debitCol < 0)) return { rows: [], warnings: ["Cabeçalho financeiro não identificado."], provider, sourceType: "UNKNOWN" };
  grid.slice(headerRow + 1).forEach((cells, index) => {
    const line = headerRow + index + 2;
    if (/^(posicao em|total\b|pagina\b|page\b)/.test(clean(cells[dateCol]))) return;
    if (![dateCol, descriptionCol, amountCol, creditCol, debitCol].some((index) => index >= 0 && String(cells[index] ?? "").trim())) return;
    const movementDate = date(cells[dateCol]);
    const baseAmount = amountCol >= 0 ? number(cells[amountCol]) : null;
    const credit = creditCol >= 0 ? number(cells[creditCol]) : null;
    const debit = debitCol >= 0 ? number(cells[debitCol]) : null;
    if (cells.every((cell) => !String(cell ?? "").trim()) || cells.every((cell, i) => clean(cell) === headers[i])) return;
    if (/^saldo(?:\s|$)/.test(clean(cells[descriptionCol]))) return;
    const invalidAmount = amountCol >= 0 ? baseAmount === null :
      (credit === null && debit === null) ||
      (creditCol >= 0 && String(cells[creditCol] ?? "").trim() !== "" && credit === null) ||
      (debitCol >= 0 && String(cells[debitCol] ?? "").trim() !== "" && debit === null);
    if (!movementDate || invalidAmount || (baseAmount === null && credit === null && debit === null)) {
      if (cells.some((cell) => String(cell ?? "").trim())) warnings.push(`Linha ${line}: data ou valor inválido; linha separada para revisão.`);
      return;
    }
    let amount = baseAmount ?? Number(credit || 0) - Number(debit || 0);
    const direction = directionCol >= 0 ? clean(cells[directionCol]) : "";
    if (/^(d|debito|debit|saida|pagamento)$/.test(direction)) amount = -Math.abs(amount);
    else if (/^(c|credito|credit|entrada)$/.test(direction)) amount = Math.abs(amount);
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

function parseOfx(text: string): ParsedGrid {
  const warnings: string[] = [];
  const rows = text.split(/<STMTTRN>/i).slice(1).flatMap((block, index) => {
    const value = number(/<TRNAMT>([^<]+)/i.exec(block)?.[1]);
    const dt = /<DTPOSTED>(\d{4})(\d{2})(\d{2})/i.exec(block);
    const memo = /<MEMO>([^<]+)/i.exec(block)?.[1] ?? /<NAME>([^<]+)/i.exec(block)?.[1] ?? "OFX transaction";
    const id = /<FITID>([^<]+)/i.exec(block)?.[1];
    const movementDate = dt ? date(`${dt[1]}-${dt[2]}-${dt[3]}`) : null;
    if (value === null || !movementDate) { warnings.push(`Transação OFX ${index + 1}: data ou valor inválido; revise o documento.`); return []; }
    return [makeRow(memo.trim(), value, movementDate, index + 1, id)];
  });
  return { rows, warnings: rows.length || warnings.length ? warnings : ["Nenhuma transação OFX encontrada."], sourceType: "BANK_STATEMENT", provider: "BANK" };
}

export async function parseFinancialDocument(file: File): Promise<DocumentParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ofx")) return { format: "OFX", ...parseOfx(await file.text()) };
  if (/\.(jpe?g|png|webp|heic)$/.test(name)) return { format: "IMAGE", sourceType: "UNKNOWN", rows: [], warnings: ["Imagem arquivada; OCR não disponível nesta etapa. Confira os dados e preencha manualmente."] };
  if (name.endsWith(".pdf")) return readFinancialPdf(file, rowsFromGrid);
  if (name.endsWith(".csv")) { const parsed = rowsFromGrid(parseCsv(await file.text()), undefined, file.name); return { format: "CSV", ...parsed, warnings: parsed.rows.length ? parsed.warnings : [...parsed.warnings, "Nenhuma transação reconhecida."] }; }
  if (name.endsWith(".xls")) return { format: "XLSX", sourceType: "UNKNOWN", rows: [], warnings: ["O formato .xls não é suportado — salve como .xlsx ou .csv."] };
  const buffer = Buffer.from(await file.arrayBuffer());
  let sheets: { sheet: string; data: unknown[][] }[];
  try { sheets = await readFinancialWorkbook(buffer); }
  catch { return { format: "XLSX", sourceType: "UNKNOWN", rows: [], warnings: ["Não foi possível abrir a estrutura da planilha. Verifique o arquivo original ou salve novamente como XLSX."] }; }
  const rows: NormalizedFinancialRow[] = []; const warnings: string[] = []; let provider: string | undefined; let sourceType = "UNKNOWN";
  for (const { sheet, data } of sheets) {
    const parsed = rowsFromGrid(normalizeGrid(data), sheet, file.name);
    rows.push(...parsed.rows.map((row) => ({ ...row, lineHash: hashLine(`${sheet}|${row.lineHash}`) }))); warnings.push(...parsed.warnings.map((warning) => `${sheet}: ${warning}`)); provider ??= parsed.provider;
    if (parsed.sourceType !== "UNKNOWN") sourceType = parsed.sourceType;
  }
  // Printed totals can include records absent from the exported detail.
  // Surface the discrepancy; never manufacture a balancing transaction.
  for (const { data } of sheets) for (const cells of data) {
    const totalColumn = cells.findIndex((cell) => /^total (credito|debito)\s*:?$/.test(clean(cell)));
    if (totalColumn < 0) continue;
    const expected = cells.slice(totalColumn + 1).map(number).find((value) => value !== null);
    if (expected === undefined) continue;
    const credit = clean(cells[totalColumn]).includes("credito");
    const actual = rows.reduce((sum, row) => sum + Math.round((credit ? row.inflow : row.outflow) * 100), 0);
    const difference = Math.round(expected * 100) - actual;
    if (difference) warnings.push(`Total de ${credit ? "crédito" : "débito"} diverge dos detalhes exportados em R$ ${(difference / 100).toFixed(2)}. Confira as linhas ausentes no documento original; nenhum ajuste foi inventado.`);
  }
  return { format: "XLSX", sourceType, provider, rows, warnings: rows.length ? warnings : [...warnings, "Nenhuma tabela financeira foi identificada."] };
}

function normalizeGrid(grid: unknown[][]): unknown[][] {
  return grid.map((row) => row.map((cell) => {
    if (cell instanceof Date) return cell.toISOString().slice(0, 10);
    return cell === null || cell === undefined ? "" : cell;
  }));
}

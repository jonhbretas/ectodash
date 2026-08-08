import { createHash } from "node:crypto";

export type FinancialType =
  | "RECEITA_FATURADA" | "RECEITA_RECEBIDA" | "DESPESA" | "TRANSFERENCIA_INTERNA"
  | "APLICACAO" | "RESGATE" | "RENDIMENTO_FINANCEIRO" | "ESTORNO" | "CHARGEBACK"
  | "TARIFA" | "AJUSTE" | "SALDO_INICIAL" | "SALDO_FINAL";

export type NormalizedFinancialRow = {
  line: number;
  sheet?: string;
  externalId?: string;
  date: string;
  description: string;
  normalizedDescription: string;
  type: FinancialType;
  gross: number;
  fee: number;
  tax: number;
  refund: number;
  chargeback: number;
  net: number;
  inflow: number;
  outflow: number;
  category?: string;
  provider?: string;
  confidence: number;
  explanation: string;
  lineHash: string;
};

const ownAccountWords = /conta própria|mesma titularidade|entre contas|transferência interna|transf\. entre contas/i;
const investmentWords = /cdb|fundo|aplica(?:ção|cao)|investimento/i;
const redemptionWords = /resgate|resgatado/i;
const incomeWords = /rendimento|juros|rentabilidade/i;
const feeWords = /tarifa|taxa|fee|mdr/i;
const refundWords = /estorno|devolução|devolucao/i;
const chargebackWords = /chargeback|contestação|contestacao/i;
const cardInvoiceWords = /pagamento.*fatura|fatura.*cartão|fatura.*cartao/i;

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function classifyDescription(description: string, amount: number, date: string, line: number, raw = description): NormalizedFinancialRow {
  const normalizedDescription = normalizeText(description);
  let type: FinancialType = amount >= 0 ? "RECEITA_RECEBIDA" : "DESPESA";
  let confidence = 0.62;
  let explanation = "Entrada/saída inferida pelo sinal do valor.";
  if (ownAccountWords.test(description)) { type = "TRANSFERENCIA_INTERNA"; confidence = .96; explanation = "Descrição indica movimentação entre contas próprias."; }
  else if (redemptionWords.test(description)) { type = "RESGATE"; confidence = .94; explanation = "Descrição indica resgate de aplicação."; }
  else if (investmentWords.test(description)) { type = "APLICACAO"; confidence = .9; explanation = "Descrição indica aplicação financeira."; }
  else if (incomeWords.test(description)) { type = "RENDIMENTO_FINANCEIRO"; confidence = .92; explanation = "Descrição indica rendimento financeiro."; }
  else if (chargebackWords.test(description)) { type = "CHARGEBACK"; confidence = .95; explanation = "Descrição indica chargeback."; }
  else if (refundWords.test(description)) { type = "ESTORNO"; confidence = .94; explanation = "Descrição indica estorno/devolução."; }
  else if (feeWords.test(description)) { type = "TARIFA"; confidence = .9; explanation = "Descrição indica tarifa ou taxa."; }
  else if (cardInvoiceWords.test(description)) { type = "TRANSFERENCIA_INTERNA"; confidence = .88; explanation = "Pagamento de fatura não cria uma nova despesa."; }
  const value = Math.abs(amount);
  return { line, date, description: raw, normalizedDescription, type, gross: value, fee: type === "TARIFA" ? value : 0, tax: 0, refund: type === "ESTORNO" ? value : 0, chargeback: type === "CHARGEBACK" ? value : 0, net: value, inflow: amount > 0 && type !== "APLICACAO" ? value : 0, outflow: amount < 0 || type === "APLICACAO" ? value : 0, confidence, explanation, lineHash: hashLine(`${line}|${date}|${normalizedDescription}|${value}`) };
}

export function hashLine(value: string): string { return createHash("sha256").update(value).digest("hex"); }

export function calculateNet(row: Pick<NormalizedFinancialRow, "gross" | "fee" | "tax" | "refund" | "chargeback">): number {
  return Math.max(0, row.gross - row.fee - row.tax - row.refund - row.chargeback);
}

export function consolidatedBalance(rows: Array<Pick<NormalizedFinancialRow, "type" | "inflow" | "outflow">>): number {
  return rows.reduce((total, row) => row.type === "TRANSFERENCIA_INTERNA" ? total : total + row.inflow - row.outflow, 0);
}

export function outstandingReceivable(billed: number, reconciled: number): number { return Math.max(0, billed - reconciled); }

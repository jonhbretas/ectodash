import { normalizeText, type FinancialType } from "./automation";

export function reviewedValues(type: FinancialType, amount: number, description: string, previous: Record<string, unknown> = {}, direction?: "entrada" | "saida") {
  const cashless = ["RECEITA_FATURADA", "SALDO_FINAL"].includes(type);
  const income = ["RECEITA_RECEBIDA", "RESGATE", "RENDIMENTO_FINANCEIRO"].includes(type);
  const expense = ["DESPESA", "TARIFA", "APLICACAO", "CHARGEBACK"].includes(type);
  const resolvedDirection = income ? "entrada" : expense ? "saida" : direction ?? (Number(previous.inflow) > 0 ? "entrada" : Number(previous.outflow) > 0 ? "saida" : undefined);
  if (!cashless && !resolvedDirection) throw new Error("Informe se o valor entrou ou saiu da conta.");
  // Preserve the breakdown when correcting a processor sale's description/date.
  const costs = type === "RECEITA_FATURADA" ? ["fee_amount", "tax_amount", "refund_amount", "chargeback_amount"].map((key) => Number(previous[key] ?? 0)) : [0, 0, 0, 0];
  const [fee_amount, tax_amount, refund_amount, chargeback_amount] = costs;
  return {
    type, original_description: description.trim(), normalized_description: normalizeText(description),
    gross_amount: Math.round((amount + costs.reduce((sum, value) => sum + value, 0)) * 100) / 100,
    fee_amount, tax_amount, refund_amount, chargeback_amount, net_amount: amount,
    inflow: !cashless && resolvedDirection === "entrada" ? amount : 0,
    outflow: !cashless && resolvedDirection === "saida" ? amount : 0,
    reconciliation_status: "PENDENTE", confidence: 1, classification_explanation: "Conferido manualmente.",
  };
}

import { describe, expect, it } from "vitest";
import { exactReconciliationPairs, financialMetrics, verifySupportingDocuments, type LedgerMovement, type FinancialImport } from "./ai-report";
const row = (changes: Partial<LedgerMovement>): LedgerMovement => ({ id: "one", import_id: "import", movement_date: "2026-11-01", expected_date: null, type: "DESPESA", net_amount: 100, inflow: 0, outflow: 100, confidence: .95, original_description: "Fornecedor", normalized_description: "fornecedor", provider_id: null, reconciliation_status: "PENDENTE", ...changes });

describe("AI financial report deterministic calculations", () => {
  it("separates cash, operating result, investments and receivables without double counting", () => {
    const metrics = financialMetrics([
      row({ id: "bill", type: "RECEITA_FATURADA", inflow: 0, outflow: 0, net_amount: 200 }),
      row({ id: "received", type: "RECEITA_RECEBIDA", inflow: 100, outflow: 0 }),
      row({ id: "expense", outflow: 30, net_amount: 30 }),
      row({ id: "investment", type: "APLICACAO", outflow: 50, net_amount: 50 }),
      row({ id: "transfer", type: "TRANSFERENCIA_INTERNA", inflow: 1000, outflow: 0 }),
      row({ id: "duplicate", reconciliation_status: "DUPLICADO", outflow: 1000 }),
    ]);
    expect(metrics).toMatchObject({ count: 5, cashIn: 100, cashOut: 80, balance: 20, operatingIn: 100, operatingOut: 30, result: 70, billed: 200, outstanding: 200 });
  });
  it("does not mistake a PIX with the same amount for a platform payout", () => {
    const rows = [row({ id: "bill", type: "RECEITA_FATURADA", outflow: 0, provider_id: "cielo" }), row({ id: "pix", type: "RECEITA_RECEBIDA", original_description: "PIX pessoal", inflow: 100, outflow: 0 })];
    expect(exactReconciliationPairs(rows, new Map([["cielo", "Cielo"]]), new Set())).toEqual([]);
    rows[1].original_description = "Liquidação Cielo";
    expect(exactReconciliationPairs(rows, new Map([["cielo", "Cielo"]]), new Set())).toEqual([{ billedId: "bill", receivedId: "pix" }]);
    expect(exactReconciliationPairs(rows, new Map([["cielo", "Cielo"]]), new Set(["bill"]))).toEqual([]);
  });
  it("keeps ambiguous matches for human review", () => {
    const rows = [row({ id: "bill", type: "RECEITA_FATURADA", provider_id: "cielo" }), row({ id: "a", type: "RECEITA_RECEBIDA", provider_id: "cielo" }), row({ id: "b", type: "RECEITA_RECEBIDA", provider_id: "cielo" })];
    expect(exactReconciliationPairs(rows, new Map(), new Set())).toEqual([]);
  });
  it("requires issuer evidence for a note/payment match and never claims fiscal authenticity", () => {
    const imports: FinancialImport[] = [{ id: "note", file_name: "nota.pdf", status: "PROCESSED", metadata: { ai_document: { kind: "NOTA_FISCAL", complete: true, currency: "BRL", number: "123", issuer: "Fornecedor", issuerDocument: "12345678901234", recipient: null, recipientDocument: null, issueDate: "2026-11-01", total: 100, accessKey: null, provider: null, findings: [] } } }];
    expect(verifySupportingDocuments(imports, [row({})])[0]).toMatchObject({ status: "PAGAMENTO_COMPATIVEL", paymentId: "one", fiscalAuthenticity: "NAO_CONSULTADA" });
    expect(verifySupportingDocuments(imports, [row({ original_description: "Outra empresa" })])[0]).toMatchObject({ status: "SEM_PAGAMENTO_IDENTIFICADO", paymentId: null });
  });
});

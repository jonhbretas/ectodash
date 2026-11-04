import { describe, expect, it } from "vitest";
import { normalizeAIDocument, type AIDocument } from "./ai-document";
const document = (changes: Partial<AIDocument> = {}): AIDocument => ({ kind: "EXTRATO", complete: true, currency: "BRL", provider: null, number: null, issuer: null, issuerDocument: null, recipient: null, recipientDocument: null, issueDate: null, total: null, accessKey: null, findings: [], transactions: [{ date: "2026-11-01", description: "PIX recebido", amount: 100, type: "RECEITA_RECEBIDA", gross: 100, fee: 0, externalId: null, page: 1, line: 2, confidence: .95, explanation: "Crédito bancário explícito" }], ...changes });
describe("AI document normalization", () => {
  it("does not add invoice or receipt totals to cash", () => {
    expect(normalizeAIDocument(document({ kind: "NOTA_FISCAL" }), "PDF", "model").rows).toEqual([]);
    expect(normalizeAIDocument(document({ kind: "COMPROVANTE" }), "IMAGE", "model").rows).toEqual([]);
  });
  it("rejects foreign currency and warns about incomplete reading", () => {
    const parsed = normalizeAIDocument(document({ currency: "USD", complete: false }), "PDF", "model");
    expect(parsed.rows).toEqual([]);
    expect(parsed.warnings.some((warning) => warning.includes("Moeda USD"))).toBe(true);
    expect(parsed.warnings.some((warning) => warning.includes("incompleta"))).toBe(true);
  });
  it("preserves source and monetary evidence but sends unreadable values to review", () => {
    const doc = document();
    expect(normalizeAIDocument(doc, "PDF", "model").rows[0]).toMatchObject({ date: "2026-11-01", inflow: 100, outflow: 0, sheet: "IA · página 1", line: 2 });
    doc.transactions[0].date = "2026-02-31";
    expect(normalizeAIDocument(doc, "PDF", "model").rows).toEqual([]);
  });
  it("keeps billed revenue out of cash", () => {
    const doc = document({ kind: "PLATAFORMA" }); doc.transactions[0].type = "RECEITA_FATURADA";
    expect(normalizeAIDocument(doc, "PDF", "model").rows[0]).toMatchObject({ type: "RECEITA_FATURADA", inflow: 0, outflow: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { reviewedValues } from "./review";

describe("financial manual review", () => {
  it("preserves processor fees without turning billed revenue into cash", () => {
    expect(reviewedValues("RECEITA_FATURADA", 90, "Venda", { fee_amount: 7, tax_amount: 3 })).toMatchObject({ gross_amount: 100, net_amount: 90, fee_amount: 7, tax_amount: 3, inflow: 0, outflow: 0 });
  });
  it.each(["RESGATE", "RENDIMENTO_FINANCEIRO", "RECEITA_RECEBIDA"] as const)("records cash inflow for %s", (type) => {
    expect(reviewedValues(type, 100, "Teste")).toMatchObject({ inflow: 100, outflow: 0 });
  });
  it.each(["DESPESA", "TARIFA", "APLICACAO", "CHARGEBACK"] as const)("records cash outflow for %s", (type) => {
    expect(reviewedValues(type, 100, "Teste")).toMatchObject({ inflow: 0, outflow: 100 });
  });
  it("requires explicit direction for a new refund and preserves existing direction", () => {
    expect(() => reviewedValues("ESTORNO", 50, "Estorno")).toThrow("entrou ou saiu");
    expect(reviewedValues("ESTORNO", 50, "Estorno", { outflow: 50 })).toMatchObject({ inflow: 0, outflow: 50 });
    expect(reviewedValues("ESTORNO", 50, "Estorno", {}, "entrada")).toMatchObject({ inflow: 50, outflow: 0 });
  });
});

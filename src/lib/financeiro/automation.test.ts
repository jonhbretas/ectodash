import { describe, expect, it } from "vitest";
import { calculateNet, classifyDescription, consolidatedBalance, outstandingReceivable } from "./automation";

describe("financial automation rules", () => {
  it("does not treat own transfers as revenue", () => {
    const row = classifyDescription("Transferência entre contas próprias", 500, "2026-01-01", 1);
    expect(row.type).toBe("TRANSFERENCIA_INTERNA");
    expect(consolidatedBalance([row])).toBe(0);
  });
  it("separates application and redemption from operating revenue", () => {
    expect(classifyDescription("Aplicação CDB", -1000, "2026-01-01", 1).type).toBe("APLICACAO");
    expect(classifyDescription("Resgate CDB", 1000, "2026-01-01", 2).type).toBe("RESGATE");
  });
  it("calculates net billing and receivables", () => {
    expect(calculateNet({ gross: 100, fee: 5, tax: 2, refund: 3, chargeback: 1 })).toBe(89);
    expect(outstandingReceivable(89, 40)).toBe(49);
  });
});

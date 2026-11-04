import { describe, expect, it } from "vitest";
import { classifyDescription } from "./automation";
import { separateDuplicates } from "./duplicates";
describe("cross-file financial duplicates", () => {
  it("quarantines matching movements for an explicit merge", () => {
    const row = classifyDescription("PIX recebido", 100, "2026-11-01", 1);
    const result = separateDuplicates([row], [{ id: "existing", movement_date: row.date, type: row.type, net_amount: row.net, normalized_description: row.normalizedDescription, external_transaction_id: null }]);
    expect(result.rows).toEqual([]);
    expect(result.duplicates[0].candidates[0].id).toBe("existing");
  });
  it("does not suppress an unrelated movement just because its amount matches", () => {
    const row = classifyDescription("PIX recebido", 100, "2026-11-01", 1);
    expect(separateDuplicates([row], [{ id: "other", movement_date: row.date, type: row.type, net_amount: row.net, normalized_description: "outra operacao", external_transaction_id: null }]).rows).toEqual([row]);
  });
});

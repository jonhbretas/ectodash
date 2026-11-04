import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFinancialDocument } from "./parse-document";

// Optional local regression against the actual originals. Private documents
// live in an ignored directory and never enter the repository.
describe("real financial export layouts", () => {
  it.skipIf(!existsSync("tmp/finance-debug/pix.xlsx"))("reads the paginated PIX export completely", async () => {
    const result = await parseFinancialDocument(new File([readFileSync("tmp/finance-debug/pix.xlsx")], "pix.xlsx"));
    expect(result.rows.length).toBeGreaterThan(30);
    expect(Math.round(result.rows.reduce((sum, row) => sum + row.inflow, 0) * 100)).toBe(560950);
    expect(Math.round(result.rows.reduce((sum, row) => sum + row.outflow, 0) * 100)).toBe(593310);
    expect(result.warnings.some((warning) => warning.includes("990.00"))).toBe(true);
  });
  it.skipIf(!existsSync("tmp/finance-debug/cielo.xlsx"))("reads Cielo's ZIP64 export and excludes the declined sale", async () => {
    const result = await parseFinancialDocument(new File([readFileSync("tmp/finance-debug/cielo.xlsx")], "cielo.xlsx"));
    expect(result.rows).toHaveLength(26);
    expect(Math.round(result.rows.reduce((sum, row) => sum + row.net, 0) * 100)).toBe(1549174);
    expect(result.warnings).toEqual([]);
    expect(result.rows.every((row) => row.inflow === 0 && row.type === "RECEITA_FATURADA")).toBe(true);
    expect(result.rows.every((row) => row.expectedDate)).toBe(true);
  });
});

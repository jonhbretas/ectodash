import { describe, expect, it } from "vitest";
import { parseFinancialAmount, parseFinancialDate } from "./values";

describe("financial values", () => {
  it.each([["1.234,56", 1234.56], ["1234.56", 1234.56], ["R$ 12,50 D", -12.5], ["100,00 C", 100], ["(12,50)", -12.5]])("reads %s", (input, expected) => {
    expect(parseFinancialAmount(input)).toBe(expected);
  });
  it.each(["erro 123", "12abc34", "1,2,3", "1.234", "", "NaN", "--10", "USD 100"]) ("rejects corrupt or ambiguous amount %s", (input) => {
    expect(parseFinancialAmount(input)).toBeNull();
  });
  it.each(["2026-02-31", "31/02/2026", "01/13/26", "2026-11-01corrupt"]) ("rejects invalid date %s", (input) => {
    expect(parseFinancialDate(input)).toBeNull();
  });
});

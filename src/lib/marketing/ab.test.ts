// src/lib/marketing/ab.test.ts
import { describe, expect, it } from "vitest";
import { pickWinner, tallyVariants, variantLetters } from "./ab";

describe("tallyVariants", () => {
  it("agrega enviados/aberturas por variante e calcula taxa", () => {
    const t = tallyVariants(["A-sub", "B-sub"], [
      { variant: "A", status: "sent", opened_at: "2026-09-18T10:00:00Z" },
      { variant: "A", status: "sent", opened_at: null },
      { variant: "B", status: "sent", opened_at: null },
      { variant: null, status: "pending", opened_at: null },
    ]);
    expect(t).toEqual([
      { variant: "A", subject: "A-sub", sent: 2, opened: 1, rate: 0.5 },
      { variant: "B", subject: "B-sub", sent: 1, opened: 0, rate: 0 },
    ]);
  });

  it("variante sem enviados tem taxa 0 e não vence", () => {
    const t = tallyVariants(["A-sub"], []);
    expect(t[0]?.rate).toBe(0);
    expect(pickWinner(t)).toBeNull();
  });
});

describe("pickWinner", () => {
  it("elege a maior taxa; empate fica com a primeira", () => {
    const t = tallyVariants(["a", "b", "c"], [
      { variant: "A", status: "sent", opened_at: null },
      { variant: "B", status: "sent", opened_at: "x" },
      { variant: "C", status: "sent", opened_at: "x" },
    ]);
    expect(pickWinner(t)?.variant).toBe("B");
  });
});

describe("variantLetters", () => {
  it("A..J, trava em 10", () => {
    expect(variantLetters(3)).toEqual(["A", "B", "C"]);
    expect(variantLetters(12)).toHaveLength(10);
  });
});

// src/lib/marketing/send-campaign.test.ts
import { describe, expect, it } from "vitest";
import { extractBatchIds } from "./send-campaign";

describe("extractBatchIds", () => {
  it("lê o shape real { data: [{id}] } (já desestruturado do SDK)", () => {
    expect(extractBatchIds({ data: [{ id: "a" }, { id: "b" }] })).toEqual(["a", "b"]);
  });

  it("aceita array direto e tolera itens sem id", () => {
    expect(extractBatchIds([{ id: "a" }, {}, null])).toEqual(["a", null, null]);
  });

  it("retorna [] p/ erro/nulo", () => {
    expect(extractBatchIds({ data: null, error: { message: "x" } })).toEqual([]);
    expect(extractBatchIds(null)).toEqual([]);
  });
});

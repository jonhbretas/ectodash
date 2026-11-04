import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allFinancialRows } from "./data";
describe("complete financial pagination", () => {
  it("continues when the backend caps pages below the requested size", async () => {
    const ranges: number[] = [];
    const builder = { select: () => builder, order: () => builder, range: async (from: number) => { ranges.push(from); return { data: Array.from({ length: Math.min(100, 250 - from) }, (_, i) => ({ id: from + i })), count: 250, error: null }; } };
    const db = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
    expect(await allFinancialRows(db, "finance_ledger", "id", (query) => query)).toHaveLength(250);
    expect(ranges).toEqual([0, 100, 200]);
  });
  it("fails rather than silently returning partial totals", async () => {
    const builder = { select: () => builder, order: () => builder, range: async () => ({ data: [], count: 5, error: null }) };
    const db = { from: () => builder } as unknown as SupabaseClient;
    await expect(allFinancialRows(db, "finance_ledger", "id", (query) => query)).rejects.toThrow("incompletos");
  });
});

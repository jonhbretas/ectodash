import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ from: vi.fn(), gate: vi.fn() }));
vi.mock("@/lib/role-gates", () => ({ requireFinanceiro: mock.gate }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mock.from, auth: { getUser: async () => ({ data: { user: { id: "user" } } }) } }) }));
import { PATCH } from "./route";

function setup(options: { closed?: boolean; linked?: string[]; old?: Record<string, unknown>; periodError?: boolean } = {}) {
  const writes: Array<{ table: string; operation: string; values: unknown }> = [];
  mock.from.mockImplementation((table: string) => {
    let operation = "select";
    const result = () => {
      if (operation !== "select") return { data: null, error: null };
      if (table === "finance_exceptions") return { data: { id: "exception", import_id: "import", status: "OPEN", ledger_ids: options.linked ?? ["ledger"], problem: "Revisar" }, error: null };
      if (table === "finance_imports") return { data: { file_name: "test.pdf", metadata: { competencia: "2026-11" } }, error: null };
      if (table === "finance_periods") return { data: options.closed ? [{ id: "period" }] : [], error: options.periodError ? { message: "offline" } : null };
      if (table === "finance_ledger") return { data: { id: "ledger", movement_date: "2026-11-01", reconciliation_status: "PENDENTE", ...options.old }, error: null };
      return { data: null, error: null };
    };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in"]) builder[method] = () => builder;
    for (const method of ["insert", "update"]) builder[method] = (values: unknown) => { operation = method; writes.push({ table, operation, values }); return builder; };
    builder.single = async () => result();
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return builder;
  });
  return writes;
}

const valid = { exceptionId: "exception", ledgerId: "ledger", date: "2026-11-01", description: "Venda", amount: 90, type: "RECEITA_FATURADA" };
const request = (body: unknown) => new Request("http://localhost/api/financeiro/review", { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

describe("financial review guards", () => {
  beforeEach(() => { vi.clearAllMocks(); mock.gate.mockResolvedValue({}); });
  it("rejects unauthorized access", async () => {
    mock.gate.mockRejectedValue(new Error("forbidden"));
    expect((await PATCH(request(valid))).status).toBe(403);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it.each([{ closed: true }, { periodError: true }])("does not mutate a closed or unverifiable period: %j", async (options) => {
    const writes = setup(options);
    expect([409, 503]).toContain((await PATCH(request(valid))).status);
    expect(writes).toEqual([]);
  });
  it("requires correction of the existing ledger instead of creating a duplicate", async () => {
    const writes = setup();
    expect((await PATCH(request({ ...valid, ledgerId: null }))).status).toBe(409);
    expect(writes).toEqual([]);
  });
  it("refuses impossible calendar dates", async () => {
    const writes = setup();
    expect((await PATCH(request({ ...valid, date: "2026-02-31" }))).status).toBe(400);
    expect(writes).toEqual([]);
  });
  it("does not invalidate an existing reconciliation", async () => {
    const writes = setup({ old: { reconciliation_status: "CONCILIADO" } });
    expect((await PATCH(request(valid))).status).toBe(409);
    expect(writes).toEqual([]);
  });
  it("keeps billed revenue out of cash and preserves the fee breakdown", async () => {
    const writes = setup({ old: { fee_amount: 10 } });
    expect((await PATCH(request(valid))).status).toBe(200);
    expect(writes.find((write) => write.table === "finance_ledger")?.values).toMatchObject({ inflow: 0, outflow: 0, fee_amount: 10, gross_amount: 100, net_amount: 90 });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ gate: vi.fn(), report: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/role-gates", () => ({ requireFinanceiro: mock.gate }));
vi.mock("@/lib/financeiro/ai-report", () => ({ generateMonthlyReport: mock.report }));
import { POST } from "./route";
const call = (body: unknown) => POST(new Request("http://localhost/api/financeiro/ia", { method: "POST", body: JSON.stringify(body) }));
describe("financial AI API authorization and actions", () => {
  beforeEach(() => { vi.clearAllMocks(); mock.gate.mockResolvedValue({ user: { id: "user" }, supabase: { rpc: mock.rpc } }); });
  it("rejects callers without financial access before doing AI work", async () => {
    mock.gate.mockRejectedValue(new Error("forbidden"));
    expect((await call({ competencia: "2026-11", action: "analyze" })).status).toBe(403);
    expect(mock.report).not.toHaveBeenCalled();
  });
  it("validates month and action", async () => {
    expect((await call({ competencia: "2026-13", action: "analyze" })).status).toBe(400);
    expect(mock.report).not.toHaveBeenCalled();
  });
  it("returns the saved monthly and annual report", async () => {
    mock.report.mockResolvedValue({ id: "report", report: { competencia: "2026-11" }, closed: false });
    const response = await call({ competencia: "2026-11", action: "analyze" });
    expect(response.status).toBe(200);
    expect(mock.report).toHaveBeenCalledWith(expect.anything(), "user", "2026-11", true);
  });
  it("requires explicit document completeness to close a period", async () => {
    expect((await call({ competencia: "2026-11", action: "close", reportId: "00000000-0000-4000-8000-000000000001", documentsComplete: false })).status).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});

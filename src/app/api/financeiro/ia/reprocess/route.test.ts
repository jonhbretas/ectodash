import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ gate: vi.fn(), token: vi.fn(), source: vi.fn(), importFiles: vi.fn() }));
vi.mock("@/lib/role-gates", () => ({ requireFinanceiro: mocks.gate }));
vi.mock("@/lib/google/oauth", () => ({ getGoogleAccessToken: mocks.token }));
vi.mock("../../import/route", () => ({ POST: mocks.importFiles }));
import { POST } from "./route";
const id = "00000000-0000-4000-8000-000000000001";
const request = () => new Request("http://localhost/api/financeiro/ia/reprocess", { method: "POST", body: JSON.stringify({ importId: id }) });
beforeEach(() => {
  vi.clearAllMocks();
  const builder = { select: () => builder, eq: () => builder, single: mocks.source };
  mocks.gate.mockResolvedValue({ user: { id: "user" }, supabase: { from: () => builder } });
  mocks.token.mockResolvedValue("test-access-token");
  mocks.source.mockResolvedValue({ data: { id, file_name: "test.pdf", file_sha256: createHash("sha256").update("original").digest("hex"), mime_type: "application/pdf", file_size: 8, storage_path: "registered-file", metadata: { competencia: "2026-11", categoria: "extrato" } }, error: null });
  mocks.importFiles.mockImplementation(async (request: Request) => {
    const form = await request.formData();
    expect(form.get("reprocessId")).toBe(id); expect(form.get("mode")).toBe("ia");
    expect(await (form.get("files") as File).text()).toBe("original");
    return Response.json({ results: [{ status: "PROCESSED" }] });
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("archived financial document reprocessing", () => {
  it("uses only the registered Drive original and its verified hash", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("original")); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request())).status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain("/files/registered-file?alt=media");
    expect(mocks.importFiles).toHaveBeenCalledTimes(1);
  });
  it("rejects an original changed after archiving", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("modified")));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.importFiles).not.toHaveBeenCalled();
  });
  it("never retrieves files before authorizing the caller", async () => {
    mocks.gate.mockRejectedValue(new Error("forbidden")); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request())).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

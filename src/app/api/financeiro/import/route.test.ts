import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), parse: vi.fn(), folder: vi.fn(), parseAI: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mocks.from, rpc: mocks.rpc, auth: { getUser: async () => ({ data: { user: { id: "user" } } }) } }) }));
vi.mock("@/lib/role-gates", () => ({ temCargoModulo: async () => false }));
vi.mock("@/lib/google/drive", () => ({ uploadDriveFile: mocks.upload }));
vi.mock("@/lib/financeiro/drive-folders", () => ({ getFinancialDriveFolder: mocks.folder }));
vi.mock("@/lib/financeiro/parse-document", () => ({ parseFinancialDocument: mocks.parse }));
vi.mock("@/lib/ai/ai-client", () => ({ getEffectiveAIConfig: async () => ({ apiKey: "key" }) }));
vi.mock("@/lib/financeiro/ai-document", () => ({ parseDocumentWithAI: mocks.parseAI, FINANCIAL_READING_VERSION: 2 }));
import { POST } from "./route";

function setup(failure?: string, duplicate = false, existingMetadata: Record<string, unknown> = {}) {
  const updates: Record<string, unknown>[] = [];
  mocks.rpc.mockResolvedValue({ data: null, error: failure === "finance_commit_import" ? { message: "Transaction rolled back" } : null });
  mocks.from.mockImplementation((table: string) => {
    let operation = "select";
    const result = () => {
      if (`${table}:${operation}` === failure) return { data: null, error: { message: "offline" } };
      if (table === "profiles") return { data: { role: "financeiro" }, error: null };
      if (table === "finance_imports") return { data: operation === "insert" || duplicate ? { id: "import", status: "PARTIAL", metadata: existingMetadata } : null, error: null };
      return { data: null, error: null, count: 0 };
    };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "delete", "gte", "lte", "not", "order", "range"]) builder[method] = () => builder;
    for (const method of ["insert", "update"]) builder[method] = (value: Record<string, unknown>) => { operation = method; if (table === "finance_imports" && method === "update") updates.push(value); return builder; };
    builder.single = builder.maybeSingle = async () => result();
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return builder;
  });
  return updates;
}

function request(mode?: string) {
  const form = new FormData();
  if (mode) form.set("mode", mode);
  form.set("competencia", "2026-11");
  form.set("files", new File(["pdf data"], "test.pdf", { type: "application/pdf" }));
  return new Request("http://localhost/api/financeiro/import", { method: "POST", body: form });
}

describe("financial import persistence failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.folder.mockResolvedValue({ id: "folder" });
    mocks.upload.mockResolvedValue({ id: "drive", webViewLink: "https://drive.google.com/file/d/drive" });
    mocks.parse.mockResolvedValue({ format: "PDF", sourceType: "UNKNOWN", rows: [], warnings: ["OCR necessário"] });
  });
  it("does not upload when period validation fails", async () => {
    setup("finance_periods:select");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("does not upload when duplicate lookup fails", async () => {
    setup("finance_imports:select");
    expect((await (await POST(request())).json()).results[0].status).toBe("FAILED");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("reuses the existing import without uploading duplicate content", async () => {
    setup(undefined, true);
    expect((await (await POST(request())).json()).results[0]).toMatchObject({ status: "DUPLICATE", importId: "import" });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rereads with AI a file previously stored without AI reading instead of reporting a duplicate", async () => {
    setup(undefined, true, { competencia: "2026-11" });
    mocks.parseAI.mockResolvedValue({ format: "PDF", sourceType: "UNKNOWN", rows: [], warnings: [] });
    const result = (await (await POST(request("ia"))).json()).results[0];
    expect(result.status).not.toBe("DUPLICATE");
    expect(mocks.parseAI).toHaveBeenCalledOnce();
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("keeps reporting duplicate when the file was already read by AI", async () => {
    setup(undefined, true, { competencia: "2026-11", ai_document: { kind: "x" } });
    expect((await (await POST(request("ia"))).json()).results[0].status).toBe("DUPLICATE");
    expect(mocks.parseAI).not.toHaveBeenCalled();
  });
  it("reports an atomic failure instead of leaving partially inserted ledger rows", async () => {
    setup("finance_commit_import");
    expect((await (await POST(request())).json()).results[0].status).toBe("FAILED");
    expect(mocks.rpc).toHaveBeenCalledWith("finance_commit_import", expect.objectContaining({ p_rows: [], p_exceptions: expect.any(Array) }));
  });
  it("keeps an unrecognized PDF pending review", async () => {
    setup();
    expect((await (await POST(request())).json()).results[0]).toMatchObject({ status: "PARTIAL", rows: 0 });
    expect(mocks.rpc.mock.calls[0][1].p_exceptions[0]).toMatchObject({ affected_amount: 0, ledger_ids: [], alternatives: [] });
  });
});

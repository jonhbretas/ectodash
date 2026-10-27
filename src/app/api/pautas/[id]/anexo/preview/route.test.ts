import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), read: vi.fn(), preview: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: mocks.user },
  from: () => ({ select: () => ({ eq: mocks.eq }) }),
}) }));
vi.mock("@/lib/google/drive-preview", () => ({ fetchDrivePreview: mocks.preview }));
import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.eq.mockReturnValue({ maybeSingle: mocks.read });
  mocks.read.mockResolvedValue({ data: { anexo_drive_id: "stored-id" }, error: null });
  mocks.preview.mockImplementation(async () => new Response("image bytes", { headers: { "Content-Type": "image/png" } }));
});
const get = (id = "12") => GET(new Request("https://ectodash.test/api/pautas/12/anexo/preview?v=arbitrary-id"), { params: Promise.resolve({ id }) });

describe("autorização da prévia de pauta", () => {
  it("exige autenticação antes de consultar Drive", async () => {
    mocks.user.mockResolvedValue({ data: { user: null } });
    expect((await get()).status).toBe(401);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("não consulta arquivos de pautas invisíveis pela RLS", async () => {
    mocks.read.mockResolvedValue({ data: null, error: null });
    expect((await get()).status).toBe(404);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("resolve o arquivo pelo registro, ignora IDs arbitrários e desativa cache público", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("id", 12);
    expect(mocks.preview).toHaveBeenCalledWith("stored-id");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(await response.text()).toBe("image bytes");
  });
  it("não expõe erros ou credenciais do Drive", async () => {
    mocks.preview.mockRejectedValue(new Error("token=secret"));
    const response = await get();
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret");
  });
  it("rejeita um identificador de pauta inválido", async () => {
    expect((await get("../../file")).status).toBe(400);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), coordinator: vi.fn(), upsert: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/role-gates", () => ({ requireAnaliseComIA: mocks.gate, requireCoordenadorGeral: mocks.coordinator }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getAIStatus, setAIModel, testAIModel } from "./ai-config-actions";

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "secret-test-key");
  vi.stubEnv("AI_MODEL", "");
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({ data: { modelo: "gpt-5.4", provider: "openai" }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  const supabase = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }), upsert: mocks.upsert }) };
  const context = { supabase, user: { id: "coordinator-1" } };
  mocks.gate.mockResolvedValue(context);
  mocks.coordinator.mockResolvedValue(context);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("configuração e teste OpenAI", () => {
  it("não expõe a chave no status enviado ao cliente", async () => {
    const status = await getAIStatus();
    expect(status).toMatchObject({ modelo: "gpt-5.4", provider: "openai", source: "db", keyConfigured: true });
    expect(JSON.stringify(status)).not.toContain("secret-test-key");
  });
  it("salva o modelo no registro único existente", async () => {
    const form = new FormData();
    form.set("modelo", "gpt-6-luna");
    expect((await setAIModel(form)).ok).toBe(true);
    expect(mocks.upsert).toHaveBeenCalledWith({ id: 1, modelo: "gpt-6-luna", provider: "openai", updated_by: "coordinator-1" }, { onConflict: "id" });
  });
  it("recusa um modelo legado antes de gravar", async () => {
    const form = new FormData();
    form.set("modelo", "muse-spark-1.3-contributor");
    expect((await setAIModel(form)).ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("exige coordenador para alterar a configuração", async () => {
    mocks.coordinator.mockRejectedValue(new Error("Sem permissão"));
    const form = new FormData();
    form.set("modelo", "gpt-5.4");
    expect((await setAIModel(form)).ok).toBe(false);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("testa a seleção efetiva do banco e valida o JSON da resposta", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"ok":true}' }] }] })));
    vi.stubGlobal("fetch", fetchMock);
    expect((await testAIModel()).ok).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("gpt-5.4");
  });
  it("não indica sucesso para um HTTP 200 sem texto", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [] }))));
    expect((await testAIModel("gpt-5.4-mini")).ok).toBe(false);
  });
  it("testa Luna com o mesmo contrato JSON das análises e raciocínio baixo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"ok":true}' }] }] })));
    vi.stubGlobal("fetch", fetchMock);
    expect((await testAIModel("gpt-6-luna")).ok).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: "gpt-6-luna", reasoning: { effort: "low" }, text: { format: { type: "json_object" } },
    });
  });
  it("não chama a API quando falta a chave", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await testAIModel()).toMatchObject({ ok: false, message: expect.stringContaining("OPENAI_API_KEY") });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

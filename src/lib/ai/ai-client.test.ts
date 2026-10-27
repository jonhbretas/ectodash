import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiConfig, getEffectiveAIConfig, requestCompletion, wrapUserContent } from "./ai-client";

function database(data: unknown, error: unknown = null): SupabaseClient {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }) } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.stubEnv("AI_MODEL", "");
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("AI_API_URL", "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("configuração OpenAI", () => {
  it("migra variáveis antigas sem enviar a chave ao gateway antigo", () => {
    vi.stubEnv("AI_MODEL", "muse-spark-1.3-contributor");
    vi.stubEnv("AI_PROVIDER", "opencode-go");
    vi.stubEnv("AI_API_URL", "https://opencode.ai/zen/go/v1/responses");
    expect(aiConfig()).toMatchObject({ provider: "openai", model: "gpt-6-luna", url: "https://api.openai.com/v1/responses" });
  });
  it("ignora a seleção legada do banco", async () => {
    expect(await getEffectiveAIConfig(database({ modelo: "muse-spark-1.3-contributor", provider: "opencode-go" }))).toMatchObject({ provider: "openai", model: "gpt-6-luna", source: "env" });
  });
  it("prioriza a escolha OpenAI salva sobre o modelo de ambiente", async () => {
    vi.stubEnv("AI_MODEL", "gpt-5.4-mini");
    expect(await getEffectiveAIConfig(database({ modelo: "gpt-5.4", provider: "openai" }))).toMatchObject({ model: "gpt-5.4", source: "db" });
  });
  it("usa Luna salvo mesmo quando o ambiente ainda aponta para o mini", async () => {
    vi.stubEnv("AI_MODEL", "gpt-5.4-mini");
    expect(await getEffectiveAIConfig(database({ modelo: "gpt-6-luna", provider: "openai" })))
      .toMatchObject({ model: "gpt-6-luna", source: "db" });
  });
  it("mantém o mini disponível como escolha explícita", () => {
    expect(aiConfig("gpt-5.4-mini").model).toBe("gpt-5.4-mini");
  });
  it("preserva modelo e origem mesmo quando a chave está ausente", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await getEffectiveAIConfig(database({ modelo: "gpt-5.4", provider: "openai" }))).toMatchObject({ apiKey: "", model: "gpt-5.4", source: "db" });
    expect(() => aiConfig()).toThrow("OPENAI_API_KEY");
  });
  it("usa o ambiente quando a leitura do banco falha", async () => {
    vi.stubEnv("AI_MODEL", "gpt-5.4");
    expect(await getEffectiveAIConfig(database(null, { message: "unavailable" }))).toMatchObject({ model: "gpt-5.4", source: "env" });
  });
  it("recusa modelos fora do catálogo", () => {
    expect(() => aiConfig("muse-spark-1.3-contributor")).toThrow("modelo OpenAI");
  });
});

describe("contrato Responses API", () => {
  it("envia JSON sem temperatura e extrai texto após o item de raciocínio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [
      { type: "reasoning", summary: [] },
      { type: "message", content: [{ type: "output_text", text: '{"demandas":[]}' }] },
    ] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = wrapUserContent("Minha transcrição");
    expect(await requestCompletion(aiConfig(), "Responda JSON", user, { jsonMode: true })).toBe('{"demandas":[]}');
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(request.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer test-openai-key" });
    expect(JSON.parse(request.body)).toEqual({ model: "gpt-6-luna", instructions: "Responda JSON", input: `${user}\n\nResponda somente em JSON.`, store: false, reasoning: { effort: "low" }, text: { format: { type: "json_object" } } });
  });
  it("não faz requisição quando falta chave", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestCompletion(await getEffectiveAIConfig(), "JSON", "teste")).rejects.toThrow("OPENAI_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("propaga o erro de autenticação da OpenAI", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"error":{"code":"invalid_api_key"}}', { status: 401 })));
    await expect(requestCompletion(aiConfig(), "JSON", "teste")).rejects.toThrow("HTTP 401");
  });
  it("recusa JSON parcial de uma resposta incompleta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [{ type: "message", content: [{ type: "output_text", text: '{"demandas":[' }] }] }))));
    await expect(requestCompletion(aiConfig(), "JSON", "teste")).rejects.toThrow("max_output_tokens");
  });
  it("não interpreta recusas como resultado de extração", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "refusal", refusal: "Não posso" }] }] }))));
    await expect(requestCompletion(aiConfig(), "JSON", "teste")).rejects.toThrow("recusou");
  });
  it("rejeita respostas sem mensagem de saída", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "reasoning", summary: [] }] }))));
    await expect(requestCompletion(aiConfig(), "JSON", "teste")).rejects.toThrow("sem texto");
  });
});

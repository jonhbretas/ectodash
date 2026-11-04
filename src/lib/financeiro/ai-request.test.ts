import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { financialAI } from "./ai-request";
const config = { apiKey: "test-key", model: "configured-model", provider: "openai" as const, url: "https://api.openai.com/v1/responses" };
const schema = z.object({ summary: z.string() });
afterEach(() => vi.unstubAllGlobals());
describe("financial structured AI requests", () => {
  it("sends PDFs to the configured model with strict schema and no response storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"summary":"ok"}' }] }] })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await financialAI(config, schema, "Analyze", "Input", new File(["pdf"], "test.pdf"))).toEqual({ summary: "ok" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ model: "configured-model", store: false, text: { format: { type: "json_schema", strict: true } } });
    expect(body.input[0].content[1]).toMatchObject({ type: "input_file", filename: "test.pdf", file_data: "data:application/pdf;base64,cGRm" });
  });
  it("does not accept truncated responses or invalid schema output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "incomplete", output: [] }))));
    await expect(financialAI(config, schema, "", "")).rejects.toThrow("não concluiu");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"summary":42}' }] }] }))));
    await expect(financialAI(config, schema, "", "")).rejects.toThrow();
  });
  it("never calls the provider without a configured key", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(financialAI({ ...config, apiKey: "" }, schema, "", "")).rejects.toThrow("Configure");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

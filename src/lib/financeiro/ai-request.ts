import { z } from "zod";
import type { AIConfig } from "@/lib/ai/ai-client";

export async function financialAI<T extends z.ZodType>(config: AIConfig, schema: T, instructions: string, text: string, file?: File): Promise<z.infer<T>> {
  if (!config.apiKey) throw new Error("Configure a chave OpenAI em Configurações antes de usar o Financeiro com IA.");
  const content: Record<string, unknown>[] = [{ type: "input_text", text }];
  if (file) {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    if (/\.(png|jpe?g|webp)$/i.test(file.name)) {
      const extension = file.name.toLowerCase().split(".").pop();
      const mime = extension === "jpg" ? "image/jpeg" : `image/${extension}`;
      content.push({ type: "input_image", image_url: `data:${mime};base64,${base64}`, detail: "high" });
    } else content.push({ type: "input_file", filename: file.name, file_data: `data:application/pdf;base64,${base64}` });
  }
  const response = await fetch(config.url, {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(110_000),
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: config.model, store: false, instructions,
      input: [{ role: "user", content }], reasoning: { effort: "low" }, max_output_tokens: 16000,
      text: { format: { type: "json_schema", name: "financeiro", strict: true, schema: z.toJSONSchema(schema) } },
    }),
  });
  if (!response.ok) throw new Error(`A leitura pela IA falhou (HTTP ${response.status}). Confira a configuração e tente novamente.`);
  const result = await response.json() as { status?: string; error?: unknown; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
  if (result.status !== "completed" || result.error) throw new Error("A IA não concluiu a leitura. Divida o documento em arquivos menores e tente novamente.");
  const parts = result.output?.filter((item) => item.type === "message").flatMap((item) => item.content ?? []) ?? [];
  if (parts.some((part) => part.type === "refusal")) throw new Error("A IA não pôde analisar este documento.");
  const output = parts.filter((part) => part.type === "output_text").map((part) => part.text ?? "").join("");
  return schema.parse(JSON.parse(output));
}

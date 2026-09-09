"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCoordenadorGeral, requireAnaliseComIA } from "@/lib/role-gates";
import { AI_CATALOG, PROVIDERS, aiConfig, getEffectiveAIConfig } from "./ai-client";
import type { AiProvider } from "./ai-catalog";

export type AIStatus = {
  modelo: string;
  provider: AiProvider;
  url: string;
  source: "db" | "env";
  canEdit: boolean;
  catalog: typeof AI_CATALOG;
  providers: typeof PROVIDERS;
};

export async function getAIStatus(): Promise<AIStatus> {
  const gate = await requireAnaliseComIA().catch(() => null);
  if (!gate) throw new Error("Sem permissão para ver configuração de IA.");
  const supabase = gate.supabase;
  const effective = await getEffectiveAIConfig(supabase);
  let canEdit = false;
  try {
    const ctx = await requireCoordenadorGeral();
    canEdit = !!ctx;
  } catch {
    canEdit = false;
  }
  const envModel = process.env.AI_MODEL?.trim();
  const envProvider = process.env.AI_PROVIDER?.trim() as AiProvider | undefined;
  const source: "db" | "env" = envModel || envProvider ? "env" : effective.source;
  return {
    modelo: effective.model,
    provider: effective.provider,
    url: effective.url,
    source,
    canEdit,
    catalog: AI_CATALOG,
    providers: PROVIDERS,
  };
}

export async function setAIModel(formData: FormData): Promise<{ ok: boolean; message: string }> {
  let gate;
  try {
    gate = await requireCoordenadorGeral();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Sem permissão." };
  }
  const modeloRaw = String(formData.get("modelo") ?? "").trim();
  if (!modeloRaw) return { ok: false, message: "Escolha um modelo." };
  const modelo = modeloRaw.slice(0, 100);
  // provider auto-detectado pelo modelo (catálogo), mas pode vir explícito
  const providerRaw = String(formData.get("provider") ?? "").trim() as AiProvider | "";
  const catalogHit = AI_CATALOG.find((m) => m.id === modelo);
  const provider: AiProvider = (providerRaw as AiProvider) || catalogHit?.provider || "opencode-go";
  if (!["opencode-go", "anthropic", "openai"].includes(provider)) {
    return { ok: false, message: "Provedor inválido." };
  }
  const supabase = gate.supabase;
  const { error } = await supabase
    .from("ai_config")
    .upsert({ id: 1, modelo, provider, updated_by: gate.user.id }, { onConflict: "id" });
  if (error) return { ok: false, message: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/analisar");
  revalidatePath("/configuracoes");
  return { ok: true, message: `Modelo alterado para ${modelo} (${provider}).` };
}

export type AIUsage = {
  rolling: { percent: number; resetsAt: string; status: string };
  weekly: { percent: number; resetsAt: string; status: string };
  monthly: { percent: number; resetsAt: string; status: string };
};

export async function getAIUsage(): Promise<{ ok: boolean; usage?: AIUsage; provider?: string; error?: string }> {
  try {
    await requireAnaliseComIA();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sem permissão." };
  }
  // Uso só faz sentido para Go (dólares). Para anthropic/openai direto, retorna aviso.
  let cfg: { provider: string; apiKey: string };
  try {
    cfg = aiConfig();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sem chave configurada." };
  }
  if (cfg.provider !== "opencode-go") {
    return { ok: false, provider: cfg.provider, error: `Uso Go não se aplica ao provedor ${cfg.provider} (uso é direto na conta Anthropic/OpenAI).` };
  }
  const apiKey = cfg.apiKey;
  try {
    const res = await fetch("https://opencode.ai/zen/go/v1/usage", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "x-opencode-session": `ectodash-usage-${Date.now()}`,
        "User-Agent": "ectodash/1.0",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = (await res.text()).slice(0, 500);
      return { ok: false, error: `Uso indisponível (HTTP ${res.status}) ${txt}` };
    }
    const json = (await res.json()) as { usage: AIUsage };
    return { ok: true, usage: json.usage, provider: cfg.provider };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao buscar uso." };
  }
}

export async function testAIModel(modeloOverride?: string, providerOverride?: string): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  try {
    await requireAnaliseComIA();
  } catch (err) {
    return { ok: false, latencyMs: 0, message: err instanceof Error ? err.message : "Sem permissão." };
  }
  const { aiConfig: baseConfig } = await import("./ai-client");
  const { AI_CATALOG } = await import("./ai-catalog");
  const targetModel = modeloOverride?.trim() || baseConfig().model;
  const catalogHit = AI_CATALOG.find((m) => m.id === targetModel);
  const provider = (providerOverride as import("./ai-catalog").AiProvider | undefined) ?? catalogHit?.provider ?? baseConfig(targetModel).provider;
  let cfg: { url: string; model: string; apiKey: string; provider: string };
  try {
    cfg = baseConfig(targetModel, provider as import("./ai-catalog").AiProvider);
  } catch (e) {
    return { ok: false, latencyMs: 0, message: e instanceof Error ? e.message : "Chave não configurada." };
  }
  const { url, model, apiKey } = cfg as { url: string; model: string; apiKey: string };
  const isResponses = url.includes("/responses");
  const session = `ectodash-test-${Date.now()}`;
  const start = Date.now();
  try {
    let body: string;
    let headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "ectodash/1.0" };
    if (provider === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      body = JSON.stringify({ model, max_tokens: 10, system: "ping", messages: [{ role: "user", content: "ping" }] });
    } else if (provider === "openai") {
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = JSON.stringify({ model, temperature: 0, messages: [{ role: "system", content: "ping" }, { role: "user", content: "ping" }] });
    } else if (isResponses) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["x-opencode-session"] = session;
      body = JSON.stringify({ model, temperature: 0, instructions: "ping", input: "ping", text: { format: { type: "json_object" } } });
    } else if (url.includes("/messages")) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["x-opencode-session"] = session;
      body = JSON.stringify({ model, max_tokens: 10, system: "ping", messages: [{ role: "user", content: "ping" }] });
    } else {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["x-opencode-session"] = session;
      body = JSON.stringify({ model, temperature: 0, messages: [{ role: "system", content: "ping" }, { role: "user", content: "ping" }] });
    }
    const res = await fetch(url, { method: "POST", headers, body });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const txt = (await res.text()).slice(0, 600);
      return { ok: false, latencyMs, message: `HTTP ${res.status} — ${txt}` };
    }
    return { ok: true, latencyMs, message: `OK ${provider}/${model} · ${latencyMs}ms` };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "Falha na requisição." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCoordenadorGeral, requireAnaliseComIA } from "@/lib/role-gates";
import { AI_CATALOG, aiConfig, getEffectiveAIConfig } from "./ai-client";

export type AIStatus = {
  modelo: string;
  url: string;
  source: "db" | "env";
  canEdit: boolean;
  catalog: typeof AI_CATALOG;
};

export async function getAIStatus(): Promise<AIStatus> {
  const gate = await requireAnaliseComIA().catch(() => null);
  // mesmo se não for coordenador, deixa ver status? exige ao menos estar logado
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
  // se AI_MODEL env override, mostra que env está forçando
  const envModel = process.env.AI_MODEL?.trim();
  const source: "db" | "env" = envModel ? "env" : effective.source;
  return {
    modelo: effective.model,
    url: effective.url,
    source,
    canEdit,
    catalog: AI_CATALOG,
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
  // Aceita catálogo ou qualquer id livre (permite testar novos modelos Go sem deploy)
  const modelo = modeloRaw.slice(0, 100);
  const supabase = gate.supabase;
  const { error } = await supabase
    .from("ai_config")
    .upsert({ id: 1, modelo, updated_by: gate.user.id }, { onConflict: "id" });
  if (error) return { ok: false, message: `Não foi possível salvar: ${error.message}` };
  revalidatePath("/analisar");
  revalidatePath("/configuracoes");
  return { ok: true, message: `Modelo alterado para ${modelo}.` };
}

export type AIUsage = {
  rolling: { percent: number; resetsAt: string; status: string };
  weekly: { percent: number; resetsAt: string; status: string };
  monthly: { percent: number; resetsAt: string; status: string };
};

export async function getAIUsage(): Promise<{ ok: boolean; usage?: AIUsage; error?: string }> {
  try {
    await requireAnaliseComIA();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sem permissão." };
  }
  const { apiKey } = aiConfig();
  if (!apiKey) return { ok: false, error: "OPENCODE_API_KEY não configurada." };
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
    return { ok: true, usage: json.usage };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao buscar uso." };
  }
}

export async function testAIModel(modeloOverride?: string): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  try {
    await requireAnaliseComIA();
  } catch (err) {
    return { ok: false, latencyMs: 0, message: err instanceof Error ? err.message : "Sem permissão." };
  }
  const { aiConfig: baseConfig } = await import("./ai-client");
  const targetModel = modeloOverride?.trim() || baseConfig(modeloOverride).model;
  // resolve url correctly
  const { url, model } = baseConfig(targetModel);
  const isResponses = url.includes("/responses");
  const isMessages = url.includes("/messages");
  const apiKey = process.env.OPENCODE_API_KEY!;
  const session = `ectodash-test-${Date.now()}`;
  const start = Date.now();
  try {
    let body: string;
    if (isResponses) {
      body = JSON.stringify({
        model,
        temperature: 0,
        instructions: "Responda APENAS com JSON.",
        input: "ping",
        text: { format: { type: "json_object" } },
      });
    } else if (isMessages) {
      body = JSON.stringify({ model, max_tokens: 10, system: "ping", messages: [{ role: "user", content: "ping" }] });
    } else {
      body = JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: "Responda APENAS com JSON." },
          { role: "user", content: "ping" },
        ],
      });
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-opencode-session": session,
        "User-Agent": "ectodash/1.0",
      },
      body,
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const txt = (await res.text()).slice(0, 600);
      return { ok: false, latencyMs, message: `HTTP ${res.status} — ${txt}` };
    }
    return { ok: true, latencyMs, message: `OK · ${latencyMs}ms` };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "Falha na requisição." };
  }
}

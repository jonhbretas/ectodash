"use server";

import { revalidatePath } from "next/cache";
import { requireCoordenadorGeral, requireAnaliseComIA } from "@/lib/role-gates";
import { AI_CATALOG, PROVIDERS, isSupportedModel } from "./ai-catalog";
import { aiConfig, getEffectiveAIConfig, requestCompletion } from "./ai-client";

export type AIStatus = {
  modelo: string;
  provider: "openai";
  source: "db" | "env";
  canEdit: boolean;
  keyConfigured: boolean;
  catalog: typeof AI_CATALOG;
  providers: typeof PROVIDERS;
};

export async function getAIStatus(): Promise<AIStatus> {
  const gate = await requireAnaliseComIA();
  const effective = await getEffectiveAIConfig(gate.supabase);
  let canEdit = false;
  try {
    canEdit = !!(await requireCoordenadorGeral());
  } catch {
    canEdit = false;
  }
  return {
    modelo: effective.model,
    provider: effective.provider,
    source: effective.source,
    canEdit,
    keyConfigured: !!effective.apiKey,
    catalog: AI_CATALOG,
    providers: PROVIDERS,
  };
}

export async function setAIModel(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const gate = await requireCoordenadorGeral();
    const modelo = String(formData.get("modelo") ?? "").trim();
    if (!isSupportedModel(modelo)) return { ok: false, message: "Escolha um modelo OpenAI disponível no seletor." };
    const { error } = await gate.supabase.from("ai_config")
      .upsert({ id: 1, modelo, provider: "openai", updated_by: gate.user.id }, { onConflict: "id" });
    if (error) return { ok: false, message: `Não foi possível salvar: ${error.message}` };
    revalidatePath("/analisar");
    revalidatePath("/configuracoes");
    return { ok: true, message: `Modelo alterado para ${modelo} (OpenAI).` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Sem permissão." };
  }
}

export async function testAIModel(modeloOverride?: string): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  try {
    const gate = await requireAnaliseComIA();
    const config = modeloOverride?.trim() ? aiConfig(modeloOverride) : await getEffectiveAIConfig(gate.supabase);
    const text = await requestCompletion(config, 'Responda apenas com JSON no formato {"ok":true}.', "Teste de conexão.", { jsonMode: true });
    if (JSON.parse(text).ok !== true) throw new Error("A OpenAI respondeu, mas o teste não recebeu o JSON esperado.");
    const latencyMs = Date.now() - start;
    return { ok: true, latencyMs, message: `OpenAI conectada · ${config.model} · ${latencyMs}ms` };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, message: err instanceof Error ? err.message : "Falha ao conectar à OpenAI." };
  }
}

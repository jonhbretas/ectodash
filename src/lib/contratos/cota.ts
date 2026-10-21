// src/lib/contratos/cota.ts
// Cota mensal de documentos enviados à Assinafy (plano: 100/mês, ajustável
// por ASSINAFY_COTA_MENSAL). Cada envio — real ou de teste — grava uma linha
// em contrato_envios; o saldo é a contagem do mês corrente (horário de Brasília).

import type { SupabaseClient } from "@supabase/supabase-js";

export function cotaMensal(): number {
  const n = Number.parseInt(process.env.ASSINAFY_COTA_MENSAL ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

/** Início do mês corrente em Brasília (UTC-3), em ISO UTC. */
function inicioDoMesBrasilia(agora = new Date()): string {
  const brasilia = new Date(agora.getTime() - 3 * 3600000);
  const inicio = Date.UTC(brasilia.getUTCFullYear(), brasilia.getUTCMonth(), 1, 3);
  return new Date(inicio).toISOString();
}

export type SaldoCota = { usados: number; limite: number; restantes: number };

export async function saldoCota(supabase: SupabaseClient): Promise<SaldoCota> {
  const { count, error } = await supabase
    .from("contrato_envios")
    .select("id", { count: "exact", head: true })
    .gte("enviado_em", inicioDoMesBrasilia());
  if (error) throw new Error("Não foi possível consultar a cota de envios.");
  const limite = cotaMensal();
  const usados = count ?? 0;
  return { usados, limite, restantes: Math.max(0, limite - usados) };
}

export async function registrarEnvio(
  supabase: SupabaseClient,
  envio: { contratoId: number | null; documentId: string; teste: boolean }
): Promise<void> {
  const { error } = await supabase.from("contrato_envios").insert({
    contrato_id: envio.contratoId,
    assinafy_document_id: envio.documentId,
    teste: envio.teste,
  });
  if (error) console.error("[contratos/cota] registrarEnvio failed", error);
}

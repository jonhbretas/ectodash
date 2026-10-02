"use server";

// src/app/(dashboard)/voluntarios/cuidar/actions.ts
// Ações da coordenação de voluntariado: wrappers finos sobre
// registrar_cuidado_voluntario() (0114), o ÚNICO caminho de escrita — o
// gate de gestor (geral/voluntariado/coordenador da área) mora na RPC.
// (Mesmo padrão de voluntarios/actions.ts: a função impõe, o action chama.)
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CuidadoResult = { ok: boolean; message: string };

const SEM_PERMISSAO: CuidadoResult = {
  ok: false,
  message: "Sessão expirada ou sem permissão.",
};

export async function registrarCuidado(
  voluntarioId: number,
  tipo: "contato" | "ajuste" | "afastamento" | "retorno" | "desligamento" | "admissao" | "troca_area",
  opts?: { detalhes?: string; area?: string; engajamento?: "engajado" | "atencao" | "sumido" | "afastado" }
): Promise<CuidadoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SEM_PERMISSAO;
  if (!Number.isInteger(voluntarioId) || voluntarioId <= 0) {
    return { ok: false, message: "Voluntário inválido." };
  }

  const { data, error } = await supabase.rpc("registrar_cuidado_voluntario", {
    p_voluntario_id: voluntarioId,
    p_tipo: tipo,
    p_detalhes: opts?.detalhes ?? null,
    p_area: opts?.area ?? null,
    p_engajamento: opts?.engajamento ?? null,
  });
  if (error || !data) {
    console.error("registrarCuidado: rpc failed", error);
    return { ok: false, message: "Não foi possível registrar. Tente de novo." };
  }
  revalidatePath("/voluntarios/cuidar");
  revalidatePath("/voluntarios/limpeza");
  const mensagens: Record<string, string> = {
    contato: "Contato registrado.",
    ajuste: "Situação atualizada.",
    afastamento: "Afastamento registrado.",
    retorno: "Volta registrada. Que bom!",
    desligamento: "Desligamento registrado.",
    admissao: "Admissão registrada. Bem-vindo(a)!",
    troca_area: "Troca de área registrada.",
  };
  return { ok: true, message: mensagens[tipo] ?? "Registrado." };
}

// Massa da Limpeza: desliga (motivo único) ou reativa selecionados.
export async function acaoEmMassa(
  ids: number[],
  acao: "desligar" | "reativar",
  motivo?: string
): Promise<CuidadoResult & { processados: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...SEM_PERMISSAO, processados: 0 };
  const validos = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (validos.length === 0) {
    return { ok: false, message: "Selecione ao menos uma pessoa.", processados: 0 };
  }
  if (acao === "desligar" && !(motivo ?? "").trim()) {
    return { ok: false, message: "Escreva o motivo do desligamento.", processados: 0 };
  }

  let processados = 0;
  for (const id of validos) {
    const { data, error } = await supabase.rpc("registrar_cuidado_voluntario", {
      p_voluntario_id: id,
      p_tipo: acao === "desligar" ? "desligamento" : "retorno",
      p_detalhes: acao === "desligar" ? (motivo ?? "") : "Reativado pela limpeza.",
      p_area: null,
      p_engajamento: null,
    });
    if (!error && data) processados++;
  }
  revalidatePath("/voluntarios/limpeza");
  revalidatePath("/voluntarios/cuidar");
  return {
    ok: processados > 0,
    message:
      processados === 0
        ? "Nada foi alterado."
        : acao === "desligar"
          ? `${processados} desligamento(s) registrado(s).`
          : `${processados} pessoa(s) reativada(s).`,
    processados,
  };
}

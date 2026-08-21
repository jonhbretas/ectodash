"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// ── Types ────────────────────────────────────────────────────────────

export type EscalaActionState = {
  ok: boolean;
  message: string;
  id?: number | null;
};

// ── Schemas ──────────────────────────────────────────────────────────

const criarEscalaSchema = z.object({
  dataSemana: z.string().min(1, "Selecione a data da sexta-feira."),
  localidade: z.string().optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────

/** Funções da escala com suas restrições */
const FUNCOES: {
  nome: string;
  vagas: number;
  requerEpicom?: boolean;
  requerDocente?: boolean;
  apenasNaoEpicom?: boolean;
}[] = [
  { nome: "Epicom", vagas: 1, requerEpicom: true },
  { nome: "Energizador 1", vagas: 1, requerDocente: true },
  { nome: "Energizador 2", vagas: 1, apenasNaoEpicom: true },
  { nome: "Energizador 3", vagas: 1, apenasNaoEpicom: true },
  { nome: "Cronometrista", vagas: 1, apenasNaoEpicom: true },
  { nome: "Monitoria", vagas: 2, apenasNaoEpicom: true },
  { nome: "Acoplador 1", vagas: 1, apenasNaoEpicom: true },
  { nome: "Acoplador 2", vagas: 1, apenasNaoEpicom: true },
  { nome: "Observador Psíquico", vagas: 1 },
];

/** Verifica se um voluntário é elegível para uma função */
function isElegivel(
  vol: { id: number; epicom: boolean; atividades: string[] },
  funcao: { nome: string; vagas: number; requerEpicom?: boolean; requerDocente?: boolean; apenasNaoEpicom?: boolean },
  alocados: Set<number>
): boolean {
  if (alocados.has(vol.id)) return false;

  // Restrição Epicom
  if (funcao.requerEpicom && !vol.epicom) return false;

  // Restrição Energizador 1 (docente_conscienciologia)
  if (funcao.requerDocente && !vol.atividades.includes("docente_conscienciologia"))
    return false;

  // Funções exclusivas para não-epicom (exceto Observador Psíquico que aceita ambos)
  if (funcao.apenasNaoEpicom && vol.epicom) return false;

  return true;
}

// ── Actions ──────────────────────────────────────────────────────────

/** Criar uma escala semanal vazia (rascunho) */
export async function criarEscala(
  prevState: EscalaActionState,
  formData: FormData
): Promise<EscalaActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coordenador_geral" && profile?.role !== "voluntariado") {
    return { ok: false, message: "Sem permissão para criar escalas." };
  }

  const parsed = criarEscalaSchema.safeParse({
    dataSemana: formData.get("dataSemana"),
    localidade: formData.get("localidade") || undefined,
  });

  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos destacados." };
  }

  // Verificar se já existe escala para esta data + localidade
  const { data: existente } = await supabase
    .from("escala_semanal")
    .select("id")
    .eq("data_semana", parsed.data.dataSemana)
    .eq("localidade", parsed.data.localidade || "")
    .neq("status", "cancelada")
    .maybeSingle();

  if (existente) {
    return {
      ok: false,
      message: "Já existe uma escala para esta data e localidade.",
    };
  }

  const { data: escala, error } = await supabase
    .from("escala_semanal")
    .insert({
      data_semana: parsed.data.dataSemana,
      localidade: parsed.data.localidade || null,
      status: "rascunho",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !escala) {
    console.error("criarEscala: insert failed", error);
    return { ok: false, message: "Não foi possível criar a escala." };
  }

  revalidatePath("/voluntarios/escala");
  return { ok: true, message: "Escala criada com sucesso.", id: escala.id };
}

/** Gerar alocação automática para uma escala (round-robin ponderado) */
export async function gerarAlocacao(
  escalaId: number
): Promise<EscalaActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coordenador_geral" && profile?.role !== "voluntariado") {
    return { ok: false, message: "Sem permissão para gerar alocação." };
  }

  // Buscar dados da escala
  const { data: escala } = await supabase
    .from("escala_semanal")
    .select("*")
    .eq("id", escalaId)
    .single();

  if (!escala) {
    return { ok: false, message: "Escala não encontrada." };
  }

  if (escala.status !== "rascunho") {
    return { ok: false, message: "Só é possível gerar alocação em escalas em rascunho." };
  }

  // Limpar alocações existentes
  await supabase
    .from("escala_alocacao")
    .delete()
    .eq("escala_id", escalaId);

  // Buscar voluntários ativos da localidade
  let query = supabase
    .from("voluntarios")
    .select("id, nome, epicom, unidade, situacao")
    .eq("ativo", true)
    .is("data_saida", null);

  if (escala.localidade) {
    query = query.eq("unidade", escala.localidade);
  }

  const { data: voluntarios } = await query;

  if (!voluntarios || voluntarios.length === 0) {
    return { ok: false, message: "Nenhum voluntário ativo encontrado para esta localidade." };
  }

  // Buscar atividades (docente_conscienciologia) para cada voluntário
  const voluntarioIds = voluntarios.map((v) => v.id);
  const { data: atividades } = await supabase
    .from("voluntario_atividades")
    .select("voluntario_id, atividade")
    .in("voluntario_id", voluntarioIds);

  const atividadesPorVoluntario = new Map<number, string[]>();
  for (const v of voluntarios) {
    atividadesPorVoluntario.set(v.id, []);
  }
  for (const a of atividades ?? []) {
    const lista = atividadesPorVoluntario.get(a.voluntario_id);
    if (lista) lista.push(a.atividade);
  }

  // Buscar histórico de funções (round-robin ponderado)
  const { data: historico } = await supabase.rpc("historico_funcoes_voluntario", {
    p_localidade: escala.localidade || null,
  });

  const totalPorFuncaoVoluntario = new Map<string, number>();
  const ultimaDataPorFuncaoVoluntario = new Map<string, string | null>();
  for (const h of historico ?? []) {
    const key = `${h.voluntario_id}:${h.funcao}`;
    totalPorFuncaoVoluntario.set(key, h.total);
    ultimaDataPorFuncaoVoluntario.set(key, h.ultima_data);
  }

  // Buscar ausências
  const { data: ausencias } = await supabase
    .from("escala_ausencia")
    .select("voluntario_id")
    .eq("escala_id", escalaId);

  const ausentesSet = new Set((ausencias ?? []).map((a) => a.voluntario_id));

  // Montar volúntários elegíveis
  const volComAtividades = voluntarios
    .filter((v) => !ausentesSet.has(v.id))
    .map((v) => ({
      id: v.id,
      nome: v.nome,
      epicom: v.epicom ?? false,
      atividades: atividadesPorVoluntario.get(v.id) ?? [],
    }));

  // Alocação round-robin: para cada função, ordenar por menos participações
  const alocados = new Set<number>();
  const alocacoes: { funcao: string; voluntario_id: number }[] = [];

  for (const funcao of FUNCOES) {
    for (let vaga = 0; vaga < funcao.vagas; vaga++) {
      const elegiveis = volComAtividades.filter((v) =>
        isElegivel(v, funcao, alocados)
      );

      if (elegiveis.length === 0) continue;

      // Ordenar: menos vezes exercendo esta função → mais tempo sem exercer → nome
      elegiveis.sort((a, b) => {
        const keyA = `${a.id}:${funcao.nome}`;
        const keyB = `${b.id}:${funcao.nome}`;
        const totalA = totalPorFuncaoVoluntario.get(keyA) ?? 0;
        const totalB = totalPorFuncaoVoluntario.get(keyB) ?? 0;
        if (totalA !== totalB) return totalA - totalB;

        const dataA = ultimaDataPorFuncaoVoluntario.get(keyA) ?? null;
        const dataB = ultimaDataPorFuncaoVoluntario.get(keyB) ?? null;
        if (dataA && dataB) return dataA < dataB ? -1 : dataA > dataB ? 1 : 0;
        if (dataA) return 1;
        if (dataB) return -1;
        return a.nome.localeCompare(b.nome);
      });

      const escolhido = elegiveis[0];
      alocados.add(escolhido.id);
      alocacoes.push({ funcao: funcao.nome, voluntario_id: escolhido.id });
    }
  }

  if (alocacoes.length === 0) {
    return { ok: false, message: "Não foi possível alocar nenhum voluntário." };
  }

  // Inserir alocações
  const { error: insertError } = await supabase
    .from("escala_alocacao")
    .insert(
      alocacoes.map((a) => ({
        escala_id: escalaId,
        funcao: a.funcao,
        voluntario_id: a.voluntario_id,
      }))
    );

  if (insertError) {
    console.error("gerarAlocacao: insert failed", insertError);
    return { ok: false, message: "Erro ao salvar as alocações." };
  }

  revalidatePath("/voluntarios/escala");
  revalidatePath(`/voluntarios/escala/${escalaId}`);
  return {
    ok: true,
    message: `${alocacoes.length} alocações geradas com sucesso.`,
  };
}

/** Marcar ausência e gerar substituição automática */
export async function marcarAusencia(
  prevState: EscalaActionState,
  formData: FormData
): Promise<EscalaActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const escalaId = Number(formData.get("escalaId"));
  const voluntarioId = Number(formData.get("voluntarioId"));
  const motivo = formData.get("motivo") as string | null;

  if (!escalaId || !voluntarioId) {
    return { ok: false, message: "Dados incompletos." };
  }

  // Verificar se já existe ausência
  const { data: existente } = await supabase
    .from("escala_ausencia")
    .select("id")
    .eq("escala_id", escalaId)
    .eq("voluntario_id", voluntarioId)
    .maybeSingle();

  if (existente) {
    return { ok: false, message: "Este voluntário já está marcado como ausente." };
  }

  // Inserir ausência
  const { error: ausenciaError } = await supabase
    .from("escala_ausencia")
    .insert({
      escala_id: escalaId,
      voluntario_id: voluntarioId,
      motivo: motivo || null,
      created_by: user.id,
    });

  if (ausenciaError) {
    console.error("marcarAusencia: insert failed", ausenciaError);
    return { ok: false, message: "Erro ao registrar ausência." };
  }

  // Tentar substituição automática
  try {
    const { data: subResult } = await supabase.rpc("substituir_ausente", {
      p_escala_id: escalaId,
      p_voluntario_ausente_id: voluntarioId,
    });

    if (subResult && subResult.length > 0) {
      revalidatePath("/voluntarios/escala");
      revalidatePath(`/voluntarios/escala/${escalaId}`);
      return {
        ok: true,
        message: `Ausência registrada. Substituto: ${subResult[0].substituto_nome} (${subResult[0].funcao}).`,
      };
    }
  } catch (e) {
    // Se a substituição falhar, a ausência já foi registrada
    console.warn("marcarAusencia: substituição automática falhou", e);
  }

  revalidatePath("/voluntarios/escala");
  revalidatePath(`/voluntarios/escala/${escalaId}`);
  return {
    ok: true,
    message: "Ausência registrada. Nenhum substituto encontrado automaticamente.",
  };
}

/** Remover ausência (restaurar voluntário) */
export async function removerAusencia(
  escalaId: number,
  voluntarioId: number
): Promise<EscalaActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase
    .from("escala_ausencia")
    .delete()
    .eq("escala_id", escalaId)
    .eq("voluntario_id", voluntarioId);

  if (error) {
    return { ok: false, message: "Erro ao remover ausência." };
  }

  revalidatePath("/voluntarios/escala");
  revalidatePath(`/voluntarios/escala/${escalaId}`);
  return { ok: true, message: "Ausência removida." };
}

/** Atualizar status da escala */
export async function atualizarStatusEscala(
  escalaId: number,
  status: "rascunho" | "publicada" | "cancelada"
): Promise<EscalaActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coordenador_geral" && profile?.role !== "voluntariado") {
    return { ok: false, message: "Sem permissão." };
  }

  const { error } = await supabase
    .from("escala_semanal")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", escalaId);

  if (error) {
    return { ok: false, message: "Erro ao atualizar status." };
  }

  revalidatePath("/voluntarios/escala");
  revalidatePath(`/voluntarios/escala/${escalaId}`);
  return { ok: true, message: `Escala ${status === "publicada" ? "publicada" : status === "cancelada" ? "cancelada" : "atualizada"}.` };
}

/** Excluir escala */
export async function excluirEscala(
  escalaId: number
): Promise<EscalaActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "coordenador_geral") {
    return { ok: false, message: "Somente o coordenador geral pode excluir escalas." };
  }

  const { error } = await supabase
    .from("escala_semanal")
    .delete()
    .eq("id", escalaId);

  if (error) {
    return { ok: false, message: "Erro ao excluir escala." };
  }

  revalidatePath("/voluntarios/escala");
  return { ok: true, message: "Escala excluída." };
}

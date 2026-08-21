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
  localidade: z.string().min(1, "Selecione a localidade da dinâmica."),
});

// ── Helpers ──────────────────────────────────────────────────────────

/** Funções da escala — Epicon será cargo especial no futuro, por enquanto aberto */
const FUNCOES: {
  nome: string;
  vagas: number;
}[] = [
  { nome: "Epicon", vagas: 1 },
  { nome: "Observador Parapsíquico", vagas: 1 },
  { nome: "Cronometrista", vagas: 1 },
  { nome: "Energizador 1", vagas: 1 },
  { nome: "Energizador 2", vagas: 1 },
  { nome: "Energizador 3", vagas: 1 },
  { nome: "Monitoria", vagas: 2 },
  { nome: "Acoplador 1", vagas: 1 },
  { nome: "Acoplador 2", vagas: 1 },
];

/** Verifica se um voluntário é elegível para uma função */
function isElegivel(
  vol: { id: number },
  _funcao: { nome: string; vagas: number },
  alocados: Set<number>
): boolean {
  return !alocados.has(vol.id);
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
    .eq("localidade", parsed.data.localidade)
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

  // Buscar voluntários ativos
  const { data: voluntarios } = await supabase
    .from("voluntarios")
    .select("id, nome, epicom, unidade")
    .eq("ativo", true)
    .is("data_saida", null);

  if (!voluntarios || voluntarios.length === 0) {
    return { ok: false, message: "Nenhum voluntário ativo encontrado." };
  }

  // Por enquanto, todos os voluntários ativos são elegíveis.
  // Filtro por localidade será ativado quando o campo unidade estiver padronizado.
  const voluntariosFiltrados = voluntarios;

  // Buscar histórico de funções (round-robin ponderado)
  const { data: historico } = await supabase.rpc("historico_funcoes_voluntario", {
    p_localidade: escala.localidade || null,
  });

  // Histórico por função (normalizado: "Monitoria 1" → "Monitoria")
  const totalPorFuncaoVoluntario = new Map<string, number>();
  const ultimaDataPorFuncaoVoluntario = new Map<string, string | null>();
  // Última vez que o voluntário fez QUALQUER função (para rotação geral)
  const ultimaDataGeralPorVoluntario = new Map<number, string | null>();
  const totalGeralPorVoluntario = new Map<number, number>();

  for (const h of historico ?? []) {
    const baseFuncao = h.funcao.replace(/ \d+$/, "");
    const key = `${h.voluntario_id}:${baseFuncao}`;
    totalPorFuncaoVoluntario.set(key, h.total);
    ultimaDataPorFuncaoVoluntario.set(key, h.ultima_data);

    // Acumular total geral e última data de qualquer função
    const prevTotal = totalGeralPorVoluntario.get(h.voluntario_id) ?? 0;
    totalGeralPorVoluntario.set(h.voluntario_id, prevTotal + h.total);

    const prevData = ultimaDataGeralPorVoluntario.get(h.voluntario_id);
    if (!prevData || (h.ultima_data && h.ultima_data > prevData)) {
      ultimaDataGeralPorVoluntario.set(h.voluntario_id, h.ultima_data);
    }
  }

  // Buscar ausências
  const { data: ausencias } = await supabase
    .from("escala_ausencia")
    .select("voluntario_id")
    .eq("escala_id", escalaId);

  const ausentesSet = new Set((ausencias ?? []).map((a) => a.voluntario_id));

  // Buscar disponibilidade (voluntários que marcaram que NÃO podem ir)
  const { data: disponibilidades } = await supabase
    .from("escala_disponibilidade")
    .select("voluntario_id, disponivel")
    .eq("escala_id", escalaId);

  const indisponiveisSet = new Set(
    (disponibilidades ?? [])
      .filter((d) => !d.disponivel)
      .map((d) => d.voluntario_id)
  );

  // Montar voluntários elegíveis (excluir ausentes E indisponíveis)
  const volElegiveis = voluntariosFiltrados
    .filter((v) => !ausentesSet.has(v.id) && !indisponiveisSet.has(v.id))
    .map((v) => ({
      id: v.id,
      nome: v.nome,
    }));

  // Alocação round-robin: para cada função, ordenar por menos participações
  const alocados = new Set<number>();
  const alocacoes: { funcao: string; voluntario_id: number }[] = [];

  for (const funcao of FUNCOES) {
    for (let vaga = 0; vaga < funcao.vagas; vaga++) {
      const elegiveis = volElegiveis.filter((v) =>
        isElegivel(v, funcao, alocados)
      );

      if (elegiveis.length === 0) continue;

      // Ordenar por:
      // 1. Menos vezes exercendo ESTA função (normalizada)
      // 2. Mais tempo sem exercer ESTA função
      // 3. Menos vezes no total (carga geral menor)
      // 4. Mais tempo desde QUALQUER função (rotação entre funções)
      // 5. Nome
      elegiveis.sort((a, b) => {
        const keyA = `${a.id}:${funcao.nome}`;
        const keyB = `${b.id}:${funcao.nome}`;
        const totalFuncaoA = totalPorFuncaoVoluntario.get(keyA) ?? 0;
        const totalFuncaoB = totalPorFuncaoVoluntario.get(keyB) ?? 0;
        if (totalFuncaoA !== totalFuncaoB) return totalFuncaoA - totalFuncaoB;

        const dataFuncaoA = ultimaDataPorFuncaoVoluntario.get(keyA) ?? null;
        const dataFuncaoB = ultimaDataPorFuncaoVoluntario.get(keyB) ?? null;
        if (dataFuncaoA && dataFuncaoB) return dataFuncaoA < dataFuncaoB ? -1 : dataFuncaoA > dataFuncaoB ? 1 : 0;
        if (dataFuncaoA) return 1;
        if (dataFuncaoB) return -1;

        const totalGeralA = totalGeralPorVoluntario.get(a.id) ?? 0;
        const totalGeralB = totalGeralPorVoluntario.get(b.id) ?? 0;
        if (totalGeralA !== totalGeralB) return totalGeralA - totalGeralB;

        const dataGeralA = ultimaDataGeralPorVoluntario.get(a.id) ?? null;
        const dataGeralB = ultimaDataGeralPorVoluntario.get(b.id) ?? null;
        if (dataGeralA && dataGeralB) return dataGeralA < dataGeralB ? -1 : dataGeralA > dataGeralB ? 1 : 0;
        if (dataGeralA) return 1;
        if (dataGeralB) return -1;

        return a.nome.localeCompare(b.nome);
      });

      const escolhido = elegiveis[0];
      alocados.add(escolhido.id);
      const nomeFuncao =
        funcao.vagas > 1 ? `${funcao.nome} ${vaga + 1}` : funcao.nome;
      alocacoes.push({ funcao: nomeFuncao, voluntario_id: escolhido.id });
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

// ── Disponibilidade ──────────────────────────────────────────────────

/** Marcar disponibilidade do voluntário para uma escala */
export async function marcarDisponibilidade(
  escalaId: number,
  voluntarioId: number,
  disponivel: boolean,
  motivo?: string
): Promise<EscalaActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase
    .from("escala_disponibilidade")
    .upsert(
      {
        escala_id: escalaId,
        voluntario_id: voluntarioId,
        disponivel,
        motivo: motivo || null,
      },
      { onConflict: "escala_id,voluntario_id" }
    );

  if (error) {
    console.error("marcarDisponibilidade: failed", error);
    return { ok: false, message: "Erro ao marcar disponibilidade." };
  }

  revalidatePath("/voluntarios/escala");
  revalidatePath(`/voluntarios/escala/${escalaId}`);
  return {
    ok: true,
    message: disponivel
      ? "Marcado como disponível."
      : "Marcado como indisponível.",
  };
}

/** Marcar disponibilidade para todos os voluntários de uma escala (coordenador) */
export async function marcarDisponibilidadeTodos(
  escalaId: number,
  disponivel: boolean
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

  // Buscar todos os voluntários ativos
  const { data: voluntarios } = await supabase
    .from("voluntarios")
    .select("id")
    .eq("ativo", true)
    .is("data_saida", null);

  if (!voluntarios || voluntarios.length === 0) {
    return { ok: false, message: "Nenhum voluntário ativo encontrado." };
  }

  // Inserir/Atualizar disponibilidade para todos
  const registros = voluntarios.map((v) => ({
    escala_id: escalaId,
    voluntario_id: v.id,
    disponivel,
    motivo: null,
  }));

  const { error } = await supabase
    .from("escala_disponibilidade")
    .upsert(registros, { onConflict: "escala_id,voluntario_id" });

  if (error) {
    console.error("marcarDisponibilidadeTodos: failed", error);
    return { ok: false, message: "Erro ao marcar disponibilidade em massa." };
  }

  revalidatePath("/voluntarios/escala");
  revalidatePath(`/voluntarios/escala/${escalaId}`);
  return {
    ok: true,
    message: `${voluntarios.length} voluntários marcados como ${disponivel ? "disponíveis" : "indisponíveis"}.`,
  };
}

/** Buscar disponibilidade de uma escala (para exibir na tela) */
export async function buscarDisponibilidade(escalaId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("escala_disponibilidade")
    .select("voluntario_id, disponivel, motivo, voluntarios(id, nome)")
    .eq("escala_id", escalaId);

  return data ?? [];
}

/** Buscar escalas do mês (para视图 mensal) */
export async function buscarEscalasMes(ano: number, mes: number) {
  const supabase = await createClient();

  // Primeiro e último dia do mês
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fimMes = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${fimMes}`;

  const { data: escalas } = await supabase
    .from("escala_semanal")
    .select("id, data_semana, localidade, status")
    .gte("data_semana", inicio)
    .lte("data_semana", fim)
    .order("data_semana");

  if (!escalas || escalas.length === 0) return [];

  // Buscar alocações de todas as escalas do mês
  const escalaIds = escalas.map((e) => e.id);
  const { data: alocacoes } = await supabase
    .from("escala_alocacao")
    .select("escala_id, funcao, voluntario_id, voluntarios(id, nome, unidade)")
    .in("escala_id", escalaIds);

  // Agrupar por escala
  const porEscala = new Map<number, typeof alocacoes>();
  for (const escala of escalas) {
    porEscala.set(escala.id, []);
  }
  for (const a of alocacoes ?? []) {
    porEscala.get(a.escala_id)?.push(a);
  }

  return escalas.map((escala) => ({
    ...escala,
    alocacoes: (porEscala.get(escala.id) ?? []).map((a) => {
      const vol = Array.isArray(a.voluntarios) ? a.voluntarios[0] : a.voluntarios;
      return {
        funcao: a.funcao,
        voluntario_nome: vol?.nome ?? "?",
        voluntario_unidade: vol?.unidade ?? null,
      };
    }),
  }));
}

// src/app/(dashboard)/utilidades/contratos/formularios-actions.ts
// Server actions do coordenador para os formulários públicos de contrato:
// criar/configurar o link, aprovar e enviar respostas, cancelar (libera o
// CPF para preencher de novo) e reenviar o e-mail de assinatura.

"use server";

import { revalidatePath } from "next/cache";
import { requireCoordenador, type ContratoActionState } from "./actions";
import {
  enviarResposta,
  gerarTokenFormulario,
  reenviarEmailResposta,
} from "@/lib/contratos/formulario";
import { arquivarContratoNoDrive } from "@/lib/contratos/geracao";

const ID = /^\d+$/;

function revalidar(id?: number) {
  revalidatePath("/utilidades/contratos/formularios");
  if (id) revalidatePath(`/utilidades/contratos/formularios/${id}`);
  revalidatePath("/utilidades/contratos");
}

function lerConfig(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const instrucoes = String(formData.get("instrucoes") ?? "").trim();
  const expira = String(formData.get("expiraEm") ?? "").trim();
  const limite = Number.parseInt(String(formData.get("limite") ?? "100"), 10);
  const prazo = Number.parseInt(String(formData.get("prazo") ?? "15"), 10);
  return {
    titulo,
    instrucoes: instrucoes || null,
    expira_em: /^\d{4}-\d{2}-\d{2}$/.test(expira) ? expira : null,
    limite_respostas: Number.isFinite(limite) ? Math.min(1000, Math.max(1, limite)) : 100,
    prazo_assinatura_dias: Number.isFinite(prazo) ? Math.min(90, Math.max(1, prazo)) : 15,
    envio_automatico: formData.get("envioAutomatico") === "on",
  };
}

export async function criarFormulario(
  _prev: ContratoActionState,
  formData: FormData
): Promise<ContratoActionState & { id?: number }> {
  try {
    const { supabase } = await requireCoordenador();
    const modeloId = String(formData.get("modeloId") ?? "");
    const eventoId = String(formData.get("eventoId") ?? "");
    if (!ID.test(modeloId)) return { ok: false, message: "Escolha o modelo do contrato." };
    const config = lerConfig(formData);
    if (config.titulo.length < 3) return { ok: false, message: "Dê um título para o formulário." };

    // Um link ativo por modelo/evento evita dois formulários concorrentes
    // gerando contratos para as mesmas pessoas.
    let q = supabase
      .from("contrato_formularios")
      .select("id")
      .eq("modelo_id", Number(modeloId))
      .eq("ativo", true);
    q = ID.test(eventoId) ? q.eq("evento_id", Number(eventoId)) : q.is("evento_id", null);
    const { data: existente } = await q.limit(1).maybeSingle();
    if (existente) {
      return {
        ok: false,
        message: "Já existe um formulário ativo para este modelo e evento. Use o link dele ou encerre-o antes.",
        id: existente.id,
      };
    }

    const { data, error } = await supabase
      .from("contrato_formularios")
      .insert({
        ...config,
        token: gerarTokenFormulario(),
        modelo_id: Number(modeloId),
        evento_id: ID.test(eventoId) ? Number(eventoId) : null,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: "Não foi possível criar o formulário." };
    revalidar();
    return { ok: true, message: "Formulário criado. Copie o link e envie aos alunos.", id: data.id };
  } catch (error) {
    console.error("[formularios] criar failed", error);
    return { ok: false, message: "Erro ao criar o formulário." };
  }
}

export async function atualizarFormulario(
  id: number,
  _prev: ContratoActionState,
  formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    const config = lerConfig(formData);
    if (config.titulo.length < 3) return { ok: false, message: "Dê um título para o formulário." };
    const { error } = await supabase
      .from("contrato_formularios")
      .update({ ...config, ativo: formData.get("ativo") === "on", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, message: "Não foi possível salvar." };
    revalidar(id);
    return { ok: true, message: "Configurações salvas." };
  } catch {
    return { ok: false, message: "Erro ao salvar o formulário." };
  }
}

type RespostaAcao = { ok: boolean; message: string };

async function carregarResposta(respostaId: number) {
  const { supabase } = await requireCoordenador();
  const { data } = await supabase
    .from("contrato_formulario_respostas")
    .select("id, formulario_id, status, contrato_id, aluno_email, aluno_cpf, formulario:contrato_formularios(evento_id)")
    .eq("id", respostaId)
    .single();
  return { supabase, resposta: data };
}

export async function aprovarResposta(respostaId: number): Promise<RespostaAcao> {
  try {
    const { supabase, resposta } = await carregarResposta(respostaId);
    if (!resposta?.contrato_id) return { ok: false, message: "Resposta sem contrato." };
    if (!["aguardando_aprovacao", "erro_envio", "recebido"].includes(resposta.status)) {
      return { ok: false, message: "Esta resposta já foi enviada ou cancelada." };
    }
    const r = await enviarResposta(supabase, resposta.id, resposta.contrato_id, undefined, resposta.aluno_email);
    const formulario = resposta.formulario as unknown as { evento_id: number | null } | null;
    try {
      await arquivarContratoNoDrive(supabase, resposta.contrato_id, formulario?.evento_id ?? null);
    } catch (error) {
      console.error("[formularios] drive failed", error);
    }
    revalidar(resposta.formulario_id);
    if (r.tipo === "enviado") return { ok: true, message: `Enviado para ${r.emailMascarado}.` };
    return { ok: false, message: "Não foi enviado (cota esgotada ou falha na Assinafy). Veja o motivo na lista." };
  } catch (error) {
    console.error("[formularios] aprovar failed", error);
    return { ok: false, message: "Erro ao enviar." };
  }
}

/** Cancela a resposta: libera o CPF/e-mail para preencher de novo. Se o
 *  contrato ainda não foi enviado, ele é cancelado junto. */
export async function cancelarResposta(respostaId: number): Promise<RespostaAcao> {
  try {
    const { supabase, resposta } = await carregarResposta(respostaId);
    if (!resposta) return { ok: false, message: "Resposta não encontrada." };
    await supabase
      .from("contrato_formulario_respostas")
      .update({ status: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", respostaId);
    if (resposta.contrato_id && resposta.status !== "enviado") {
      await supabase
        .from("contratos")
        .update({ status: "cancelado" })
        .eq("id", resposta.contrato_id)
        .eq("status", "gerado");
    }
    revalidar(resposta.formulario_id);
    return {
      ok: true,
      message:
        resposta.status === "enviado"
          ? "Resposta cancelada. O contrato já enviado continua na Assinafy — cancele-o na lista de contratos se preciso."
          : "Resposta cancelada. A pessoa pode preencher de novo.",
    };
  } catch {
    return { ok: false, message: "Erro ao cancelar." };
  }
}

export async function reenviarEmailAdmin(respostaId: number): Promise<RespostaAcao> {
  try {
    const { supabase, resposta } = await carregarResposta(respostaId);
    if (!resposta) return { ok: false, message: "Resposta não encontrada." };
    const r = await reenviarEmailResposta(supabase, resposta.formulario_id, {
      cpf: resposta.aluno_cpf,
      email: resposta.aluno_email,
    });
    revalidar(resposta.formulario_id);
    return r;
  } catch {
    return { ok: false, message: "Erro ao reenviar." };
  }
}

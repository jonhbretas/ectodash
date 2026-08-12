// src/app/(dashboard)/contratos/actions.ts
// Server actions do módulo de contratos: criação (com pastas no Drive e PDF),
// envio para assinatura (Assinafy), retorno de assinado, modelos e webhook.
// O núcleo de geração/assinatura vive em lib/contratos/{geracao,assinatura}.ts
// e é compartilhado com o fluxo em lote por evento (evento-actions.ts).
// Padrões do projeto: validação via schema zod compartilhado, revalidatePath,
// gate por role, RLS como fronteira real (auth.uid()).

"use server";

import { revalidatePath } from "next/cache";
import { uploadDriveFile } from "@/lib/google/drive";
import { requireUsuario } from "@/lib/role-gates";
import { arquivarContratoNoDrive } from "@/lib/contratos/geracao";
import { enviarContratoParaAssinatura } from "@/lib/contratos/assinatura";
import {
  assinafyBaixarDocumento,
  assinafyGarantirWebhook,
} from "@/lib/assinafy";
import { contratoSchema, contratoModeloSchema } from "./contrato-schema";

export type ContratoActionState = {
  ok: boolean;
  message: string;
  assinaturaUrl?: string;
};

const initialState: ContratoActionState = { ok: true, message: "" };

/** Gate de role compartilhado com evento-actions.ts (coordenador_geral). */
export async function requireCoordenador() {
  const ctx = await requireUsuario();
  if (ctx.role !== "coordenador_geral") {
    throw new Error("Você não tem acesso aos contratos.");
  }
  return { supabase: ctx.supabase, user: ctx.user };
}

const PRAZO_PADRAO_DIAS = 15;

function prazoPadrao(): string {
  return new Date(Date.now() + PRAZO_PADRAO_DIAS * 86400000).toISOString().slice(0, 10);
}

// ── Contratos ──────────────────────────────────────────────────────────

export async function criarContrato(
  _prev: ContratoActionState,
  formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();

    const parsed = contratoSchema.safeParse({
      modeloId: formData.get("modeloId") ?? "",
      eventoId: formData.get("eventoId") ?? "",
      alunoNome: formData.get("alunoNome") ?? "",
      alunoEmail: formData.get("alunoEmail") ?? "",
      alunoDocumento: formData.get("alunoDocumento") ?? "",
      alunoTelefone: formData.get("alunoTelefone") ?? "",
      valor: formData.get("valor") ?? "",
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Dados inválidos.";
      return { ok: false, message: first };
    }

    const data = parsed.data;
    const valor =
      data.valor && data.valor.trim()
        ? parseFloat(data.valor.replace(/\s/g, "").replace(/\./g, "").replace(",", "."))
        : null;
    if (valor !== null && !Number.isFinite(valor)) {
      return { ok: false, message: "Informe o valor em formato numérico (ex.: 120,00)." };
    }

    const { data: insert, error: insertError } = await supabase
      .from("contratos")
      .insert({
        modelo_id: Number(data.modeloId),
        evento_id: data.eventoId ? Number(data.eventoId) : null,
        aluno_nome: data.alunoNome,
        aluno_email: data.alunoEmail || null,
        aluno_documento: data.alunoDocumento || null,
        aluno_telefone: data.alunoTelefone || null,
        valor,
        status: "gerado",
        expira_em: prazoPadrao(),
      })
      .select("id")
      .single();
    if (insertError || !insert) {
      return { ok: false, message: "Não foi possível criar o contrato." };
    }
    const contratoId = insert.id as number;

    // Pastas + PDF no Drive (best effort: se o Google falhar, o contrato fica
    // criado e o PDF continua disponível para download/assinatura).
    let driveWarning = "";
    try {
      await arquivarContratoNoDrive(supabase, contratoId, data.eventoId ? Number(data.eventoId) : null);
    } catch (error) {
      console.error("[contratos] drive archival failed", error);
      driveWarning = ` O PDF não foi salvo no Google Drive (erro interno).`;
    }

    revalidatePath("/contratos");
    return {
      ok: true,
      message: "Contrato criado e salvo no Drive." + driveWarning,
    };
  } catch (error) {
    console.error("[contratos] criarContrato failed", error);
    return {
      ok: false,
      message: "Erro ao criar o contrato.",
    };
  }
}

export async function enviarParaAssinatura(
  id: number,
  _prev: ContratoActionState,
  _formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    const resultado = await enviarContratoParaAssinatura(supabase, id);
    revalidatePath("/contratos");
    if (!resultado.ok) return { ok: false, message: resultado.message };
    return {
      ok: true,
      message: "Documento enviado para assinatura. Compartilhe o link com o aluno.",
      assinaturaUrl: resultado.url,
    };
  } catch (error) {
    console.error("[contratos] enviarParaAssinatura failed", error);
    return {
      ok: false,
      message: "Não foi possível enviar para assinatura.",
    };
  }
}

export async function uploadAssinado(
  id: number,
  _prev: ContratoActionState,
  formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();

    const arquivo = formData.get("arquivo");
    if (!(arquivo instanceof File)) {
      return { ok: false, message: "Selecione o arquivo PDF assinado." };
    }
    if (!arquivo.name.toLowerCase().endsWith(".pdf")) {
      return { ok: false, message: "O arquivo precisa ser PDF." };
    }
    if (arquivo.size > 10 * 1024 * 1024) {
      return { ok: false, message: "O arquivo é grande demais (máx. 10 MB)." };
    }

    const { data: contrato, error } = await supabase
      .from("contratos")
      .select("id, drive_pasta_id")
      .eq("id", id)
      .single();
    if (error || !contrato?.drive_pasta_id) {
      return { ok: false, message: "Contrato sem pasta no Drive." };
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const up = await uploadDriveFile(contrato.drive_pasta_id, "contrato-assinado.pdf", buffer);

    await supabase
      .from("contratos")
      .update({
        status: "assinado",
        drive_assinado_id: up.id,
        drive_assinado_url: up.webViewLink || null,
      })
      .eq("id", id);

    revalidatePath("/contratos");
    return { ok: true, message: "PDF assinado salvo e contrato marcado como assinado." };
  } catch (error) {
    console.error("[contratos] uploadAssinado failed", error);
    return {
      ok: false,
      message: "Erro ao salvar o PDF assinado.",
    };
  }
}

export async function sincronizarAssinado(
  id: number,
  _prev: ContratoActionState,
  _formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();

    const { data: contrato, error } = await supabase
      .from("contratos")
      .select("id, drive_pasta_id, assinafy_document_id")
      .eq("id", id)
      .single();
    if (error || !contrato?.assinafy_document_id) {
      return { ok: false, message: "Contrato sem documento na Assinafy." };
    }

    const buffer = await assinafyBaixarDocumento(contrato.assinafy_document_id, "certificated");
    const update: Record<string, unknown> = { status: "assinado" };
    if (contrato.drive_pasta_id) {
      const up = await uploadDriveFile(
        contrato.drive_pasta_id,
        "contrato-assinado.pdf",
        buffer
      );
      update.drive_assinado_id = up.id;
      update.drive_assinado_url = up.webViewLink || null;
    }
    await supabase.from("contratos").update(update).eq("id", id);

    revalidatePath("/contratos");
    return { ok: true, message: "PDF certificado sincronizado do Assinafy." };
  } catch (error) {
    console.error("[contratos] sincronizarAssinado failed", error);
    return {
      ok: false,
      message: "Erro ao sincronizar o assinado.",
    };
  }
}

export async function marcarAssinadoManual(
  id: number,
  _prev: ContratoActionState,
  _formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    await supabase.from("contratos").update({ status: "assinado" }).eq("id", id);
    revalidatePath("/contratos");
    return { ok: true, message: "Contrato marcado como assinado." };
  } catch {
    return { ok: false, message: "Erro ao marcar como assinado." };
  }
}

export async function cancelarContrato(
  id: number,
  _prev: ContratoActionState,
  _formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    await supabase.from("contratos").update({ status: "cancelado" }).eq("id", id);
    revalidatePath("/contratos");
    return { ok: true, message: "Contrato cancelado." };
  } catch {
    return { ok: false, message: "Erro ao cancelar o contrato." };
  }
}

// ── Modelos ────────────────────────────────────────────────────────────

export async function criarModelo(
  _prev: ContratoActionState,
  formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();

    const parsed = contratoModeloSchema.safeParse({
      titulo: formData.get("titulo") ?? "",
      categoria: formData.get("categoria") ?? "",
      descricao: formData.get("descricao") ?? "",
      conteudo: formData.get("conteudo") ?? "",
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Dados inválidos.";
      return { ok: false, message: first };
    }

    const { error } = await supabase.from("contrato_modelos").insert({
      titulo: parsed.data.titulo,
      categoria: parsed.data.categoria,
      descricao: parsed.data.descricao || null,
      conteudo: parsed.data.conteudo,
      ativo: true,
    });
    if (error) return { ok: false, message: "Não foi possível criar o modelo." };

    revalidatePath("/contratos/modelos");
    return { ok: true, message: "Modelo criado." };
  } catch (error) {
    console.error("[contratos] criarModelo failed", error);
    return {
      ok: false,
      message: "Erro ao criar o modelo.",
    };
  }
}

export async function atualizarModelo(
  id: number,
  _prev: ContratoActionState,
  formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();

    const parsed = contratoModeloSchema.safeParse({
      titulo: formData.get("titulo") ?? "",
      categoria: formData.get("categoria") ?? "",
      descricao: formData.get("descricao") ?? "",
      conteudo: formData.get("conteudo") ?? "",
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Dados inválidos.";
      return { ok: false, message: first };
    }

    const { error } = await supabase
      .from("contrato_modelos")
      .update({
        titulo: parsed.data.titulo,
        categoria: parsed.data.categoria,
        descricao: parsed.data.descricao || null,
        conteudo: parsed.data.conteudo,
      })
      .eq("id", id);
    if (error) return { ok: false, message: "Não foi possível atualizar o modelo." };

    revalidatePath("/contratos/modelos");
    return { ok: true, message: "Modelo atualizado." };
  } catch (error) {
    console.error("[contratos] atualizarModelo failed", error);
    return {
      ok: false,
      message: "Erro ao atualizar o modelo.",
    };
  }
}

export async function toggleModeloAtivo(
  id: number,
  _prev: ContratoActionState,
  _formData: FormData
): Promise<ContratoActionState> {
  try {
    const { supabase } = await requireCoordenador();
    const { data: modelo } = await supabase
      .from("contrato_modelos")
      .select("ativo")
      .eq("id", id)
      .single();
    await supabase
      .from("contrato_modelos")
      .update({ ativo: !modelo?.ativo })
      .eq("id", id);
    revalidatePath("/contratos/modelos");
    return { ok: true, message: modelo?.ativo ? "Modelo desativado." : "Modelo ativado." };
  } catch {
    return { ok: false, message: "Erro ao alternar o modelo." };
  }
}

// ── Webhook Assinafy ───────────────────────────────────────────────────

export async function configurarAssinafy(
  _prev: ContratoActionState,
  _formData: FormData
): Promise<ContratoActionState> {
  try {
    await requireCoordenador();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { url } = await assinafyGarantirWebhook(siteUrl);
    return {
      ok: true,
      message: "Webhook configurado na Assinafy apontando para este sistema.",
      assinaturaUrl: url,
    };
  } catch (error) {
    console.error("[contratos] configurarWebhookAssinafy failed", error);
    return {
      ok: false,
      message: "Erro ao configurar o webhook da Assinafy.",
    };
  }
}

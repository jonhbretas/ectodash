// src/lib/contratos/assinatura.ts
// Núcleo do envio de um contrato para assinatura na Assinafy: regenera o PDF
// (mesmo texto snapshot), faz upload do documento, cria o signatário e a
// rodada de assinaturas (method "virtual"). Compartilhado entre o envio
// individual (card) e o envio em lote por evento.

import type { SupabaseClient } from "@supabase/supabase-js";
import { carregarContrato, renderizarContratoPdf } from "./render";
import {
  assinafyUploadDocumento,
  assinafyCriarSignatario,
  assinafyCriarAssignment,
} from "@/lib/assinafy";

export type EnvioAssinaturaResult = {
  ok: boolean;
  message: string;
  url?: string;
};

export async function enviarContratoParaAssinatura(
  supabase: SupabaseClient,
  contratoId: number
): Promise<EnvioAssinaturaResult> {
  try {
    const completo = await carregarContrato(supabase, contratoId);
    const { buffer, filename } = await renderizarContratoPdf(completo);

    const documento = await assinafyUploadDocumento(buffer, filename);
    const signer = await assinafyCriarSignatario(
      completo.contrato.aluno_nome,
      completo.contrato.aluno_email,
      completo.contrato.aluno_telefone
    );
    const assignment = await assinafyCriarAssignment(
      documento.id,
      [signer.id],
      `Assine o contrato "${completo.modelo.titulo}" referente ao ${
        completo.evento?.titulo ?? "evento/curso"
      } da Ectolab.`
    );

    const { error } = await supabase
      .from("contratos")
      .update({
        status: "assinando",
        assinafy_document_id: documento.id,
        assinafy_assignment_id: assignment.id,
      })
      .eq("id", contratoId);
    if (error) throw new Error("Não foi possível atualizar o contrato.");

    return {
      ok: true,
      message: "Documento enviado para assinatura.",
      url: assignment.signing_urls?.[0]?.url,
    };
  } catch (error) {
    console.error("[assinatura] enviarParaAssinatura failed", error);
    return {
      ok: false,
      message: "Não foi possível enviar para assinatura.",
    };
  }
}

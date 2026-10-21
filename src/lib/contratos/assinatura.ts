// src/lib/contratos/assinatura.ts
// Núcleo do envio de um contrato para assinatura na Assinafy: regenera o PDF
// (mesmo texto snapshot), faz upload do documento, cria o signatário e a
// rodada de assinaturas (method "virtual"). Compartilhado entre o envio
// individual (card), o envio em lote por evento e o lote em massa.
// Todo envio respeita a cota mensal (lib/contratos/cota.ts) e é registrado.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  carregarContrato,
  gerarPdfContrato,
  renderizarContratoPdf,
  type DadosPdfContrato,
} from "./render";
import { registrarEnvio, saldoCota } from "./cota";
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

async function semCota(supabase: SupabaseClient): Promise<EnvioAssinaturaResult | null> {
  const saldo = await saldoCota(supabase);
  if (saldo.restantes > 0) return null;
  return {
    ok: false,
    message: `Cota mensal da Assinafy esgotada (${saldo.usados}/${saldo.limite}). Aguarde o próximo mês.`,
  };
}

export async function enviarContratoParaAssinatura(
  supabase: SupabaseClient,
  contratoId: number
): Promise<EnvioAssinaturaResult> {
  try {
    const bloqueio = await semCota(supabase);
    if (bloqueio) return bloqueio;

    const completo = await carregarContrato(supabase, contratoId);
    const { buffer, filename } = await renderizarContratoPdf(completo);

    const documento = await assinafyUploadDocumento(buffer, filename);
    await registrarEnvio(supabase, { contratoId, documentId: documento.id, teste: false });
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

/** Envio de teste: gera o PDF (marcado como TESTE) com os dados reais do
 *  aluno, mas o signatário é quem está testando. Não cria contrato no banco;
 *  conta na cota. */
export async function enviarTesteParaAssinatura(
  supabase: SupabaseClient,
  dados: DadosPdfContrato,
  destinatario: { nome: string; email: string }
): Promise<EnvioAssinaturaResult> {
  try {
    const bloqueio = await semCota(supabase);
    if (bloqueio) return bloqueio;

    const { buffer, filename } = await gerarPdfContrato({ ...dados, teste: true });
    const documento = await assinafyUploadDocumento(buffer, filename);
    await registrarEnvio(supabase, { contratoId: null, documentId: documento.id, teste: true });
    const signer = await assinafyCriarSignatario(destinatario.nome, destinatario.email);
    const assignment = await assinafyCriarAssignment(
      documento.id,
      [signer.id],
      `TESTE — confira o contrato "${dados.modelo.titulo}" antes do envio em massa.`
    );
    return {
      ok: true,
      message: `Teste enviado para ${destinatario.email}. Confira o e-mail da Assinafy.`,
      url: assignment.signing_urls?.[0]?.url,
    };
  } catch (error) {
    console.error("[assinatura] enviarTeste failed", error);
    return { ok: false, message: "Não foi possível enviar o teste." };
  }
}

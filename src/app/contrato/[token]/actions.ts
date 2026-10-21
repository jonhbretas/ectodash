"use server";

// Actions do formulário público de contrato (/contrato/<token>). Sem sessão:
// usam o client service-role e TODA a validação/trava fica em
// lib/contratos/formulario.ts. Nada aqui confia em dados do navegador além
// do que é revalidado no servidor.

import { after } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALUNO_VAZIO, chaveDocumento, type AlunoContrato } from "@/lib/contratos/aluno";
import {
  carregarFormularioPublico,
  registrarResposta,
  reenviarEmailResposta,
  validarRespostaAluno,
  type ResultadoResposta,
} from "@/lib/contratos/formulario";
import { gerarPdfContrato } from "@/lib/contratos/render";
import { arquivarContratoNoDrive } from "@/lib/contratos/geracao";

function limparAluno(aluno: Partial<AlunoContrato>): AlunoContrato {
  const limpo = { ...ALUNO_VAZIO };
  for (const campo of Object.keys(ALUNO_VAZIO) as Array<keyof AlunoContrato>) {
    const v = aluno?.[campo];
    limpo[campo] = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  }
  return limpo;
}

async function origemDaRequisicao() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
  return { ip, userAgent: h.get("user-agent") ?? "" };
}

export type PreviaResult = { ok: true; base64: string; filename: string } | { ok: false; message: string };

/** Prévia do contrato com os dados digitados — só leitura, não grava nada. */
export async function previaContratoPublico(
  token: string,
  alunoBruto: Partial<AlunoContrato>
): Promise<PreviaResult> {
  try {
    const admin = createAdminClient();
    const carga = await carregarFormularioPublico(admin, token);
    if (!carga.ok) return { ok: false, message: carga.motivo };
    const f = carga.formulario;
    const aluno = limparAluno(alunoBruto);
    const erros = validarRespostaAluno(aluno, f.campos);
    if (erros.length > 0) return { ok: false, message: erros.join(". ") + "." };

    const { buffer, filename } = await gerarPdfContrato({
      numero: "—",
      modelo: f.modelo,
      conteudo: f.conteudo,
      evento: f.evento,
      aluno,
      valor: null,
      emissaoIso: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10),
      aviso:
        "PRÉVIA PARA CONFERÊNCIA — o contrato para assinatura chega no seu e-mail depois que você confirmar.",
    });
    return { ok: true, base64: buffer.toString("base64"), filename };
  } catch (error) {
    console.error("[contrato publico] previa failed", error);
    return { ok: false, message: "Não foi possível gerar a prévia agora. Tente de novo." };
  }
}

export async function enviarFormularioContrato(
  token: string,
  alunoBruto: Partial<AlunoContrato>,
  extras: { emailConfirmacao: string; consentimento: boolean; site: string }
): Promise<ResultadoResposta> {
  try {
    // Honeypot: campo invisível que só robôs preenchem — resposta "ok" falsa.
    if (extras.site) return { tipo: "aguardando", emailMascarado: "" };

    const aluno = limparAluno(alunoBruto);
    if (!extras.consentimento) {
      return { tipo: "erro", message: "Marque a autorização de uso dos dados para continuar." };
    }
    if (extras.emailConfirmacao.trim().toLowerCase() !== aluno.email.trim().toLowerCase()) {
      return { tipo: "erro", message: "Os dois e-mails digitados não são iguais. Confira." };
    }

    const admin = createAdminClient();
    const carga = await carregarFormularioPublico(admin, token);
    if (!carga.ok) return { tipo: "erro", message: carga.motivo };

    const resultado = await registrarResposta(admin, carga.formulario, aluno, await origemDaRequisicao());

    // Cópia do PDF no Drive depois de responder (não atrasa a pessoa).
    if (resultado.tipo === "enviado" || resultado.tipo === "aguardando") {
      const formulario = carga.formulario;
      after(async () => {
        try {
          const { data } = await admin
            .from("contrato_formulario_respostas")
            .select("contrato_id")
            .eq("formulario_id", formulario.id)
            .eq("aluno_cpf", chaveDocumento(aluno.documento))
            .neq("status", "cancelado")
            .maybeSingle();
          if (data?.contrato_id) {
            await arquivarContratoNoDrive(admin, data.contrato_id, formulario.evento?.id ?? null);
          }
        } catch (error) {
          console.error("[contrato publico] drive failed", error);
        }
      });
    }
    return resultado;
  } catch (error) {
    console.error("[contrato publico] envio failed", error);
    return { tipo: "erro", message: "Não foi possível concluir agora. Tente de novo em instantes." };
  }
}

export async function reenviarEmailContrato(
  token: string,
  identificacao: { cpf: string; email: string }
): Promise<{ ok: boolean; message: string }> {
  try {
    const admin = createAdminClient();
    const carga = await carregarFormularioPublico(admin, token);
    if (!carga.ok) return { ok: false, message: carga.motivo };
    return reenviarEmailResposta(admin, carga.formulario.id, identificacao);
  } catch (error) {
    console.error("[contrato publico] reenvio failed", error);
    return { ok: false, message: "Não foi possível reenviar agora." };
  }
}

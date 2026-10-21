// src/app/(dashboard)/utilidades/contratos/lote-actions.ts
// Server actions dos contratos EM MASSA (alunos colados de planilha/CSV ou
// digitados) e da pré-visualização de modelos.
//
// Fluxo do lote (tela /utilidades/contratos/lote):
//   1) verificarDuplicadosLote — acha contratos já existentes do mesmo
//      modelo/evento para o mesmo CPF/e-mail (regra do projeto: atualizar em
//      vez de duplicar → o coordenador escolhe pular, atualizar ou criar novo);
//   2) previsualizarContratoLote — PDF de um aluno, sem enviar nada;
//   3) enviarTesteLote — PDF real marcado TESTE assinado por quem testa;
//   4) criarContratosLote — grava/atualiza todos (checa a cota antes);
//   5) processarContratoLote — 1 chamada por contrato (Drive + Assinafy),
//      feita em sequência pelo cliente para mostrar progresso e não estourar
//      o tempo máximo de função da Vercel.

"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireCoordenador } from "./actions";
import { arquivarContratoNoDrive } from "@/lib/contratos/geracao";
import {
  enviarContratoParaAssinatura,
  enviarTesteParaAssinatura,
} from "@/lib/contratos/assinatura";
import { gerarPdfContrato, type EventoContratoRow } from "@/lib/contratos/render";
import { saldoCota, type SaldoCota } from "@/lib/contratos/cota";
import {
  ALUNO_VAZIO,
  dataParaIso,
  emailValido,
  formatarCpf,
  somenteDigitos,
  validarAluno,
  type AlunoContrato,
} from "@/lib/contratos/aluno";

const MAX_LOTE = 100;

type Base = { modeloId: number; eventoId: number | null };

function hojeIso(): string {
  return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
}

function prazoCom(dias: number): string {
  const d = Number.isFinite(dias) && dias >= 1 && dias <= 90 ? dias : 15;
  return new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
}

/** Saneia o que vem do cliente: só campos conhecidos, strings aparadas. */
function limparAluno(aluno: Partial<AlunoContrato>): AlunoContrato {
  const limpo = { ...ALUNO_VAZIO };
  for (const campo of Object.keys(ALUNO_VAZIO) as Array<keyof AlunoContrato>) {
    const v = aluno?.[campo];
    limpo[campo] = typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 300) : "";
  }
  return limpo;
}

async function carregarBase(supabase: SupabaseClient, base: Base) {
  const { data: modelo } = await supabase
    .from("contrato_modelos")
    .select("id, titulo, categoria, conteudo, ativo")
    .eq("id", base.modeloId)
    .single();
  if (!modelo) throw new Error("Modelo não encontrado.");

  let evento: EventoContratoRow | null = null;
  let conteudoPersonalizado: string | null = null;
  if (base.eventoId) {
    const { data } = await supabase
      .from("eventos")
      .select("titulo, descricao, data_evento, local")
      .eq("id", base.eventoId)
      .single();
    if (!data) throw new Error("Evento não encontrado.");
    evento = data as EventoContratoRow;
    const { data: vinculo } = await supabase
      .from("contrato_evento_modelos")
      .select("conteudo_personalizado")
      .eq("evento_id", base.eventoId)
      .eq("modelo_id", base.modeloId)
      .maybeSingle();
    conteudoPersonalizado = vinculo?.conteudo_personalizado?.trim() || null;
  }

  return {
    modelo: { titulo: modelo.titulo as string, categoria: modelo.categoria as string },
    conteudo: conteudoPersonalizado ?? (modelo.conteudo as string),
    conteudoPersonalizado,
    evento,
  };
}

// ── Saldo da cota ──────────────────────────────────────────────────────

export async function consultarCota(): Promise<SaldoCota> {
  const { supabase } = await requireCoordenador();
  return saldoCota(supabase);
}

// ── 1) Duplicados ──────────────────────────────────────────────────────

export type ContratoExistente = {
  id: number;
  status: string;
  aluno_nome: string;
  created_at: string;
};

/** Para cada aluno (mesmo índice), o contrato já existente do mesmo
 *  modelo/evento com o mesmo CPF ou e-mail — ou null. */
export async function verificarDuplicadosLote(
  base: Base,
  alunos: Array<Pick<AlunoContrato, "documento" | "email">>
): Promise<Array<ContratoExistente | null>> {
  const { supabase } = await requireCoordenador();
  let query = supabase
    .from("contratos")
    .select("id, status, aluno_nome, aluno_email, aluno_documento, created_at")
    .eq("modelo_id", base.modeloId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(2000);
  query = base.eventoId ? query.eq("evento_id", base.eventoId) : query.is("evento_id", null);
  const { data } = await query;
  const existentes = data ?? [];

  return alunos.slice(0, MAX_LOTE).map((aluno) => {
    const cpf = somenteDigitos(aluno.documento ?? "");
    const email = (aluno.email ?? "").trim().toLowerCase();
    const achado = existentes.find(
      (c) =>
        (cpf.length >= 11 && somenteDigitos(c.aluno_documento ?? "") === cpf) ||
        (email && (c.aluno_email ?? "").trim().toLowerCase() === email)
    );
    return achado
      ? {
          id: achado.id,
          status: achado.status,
          aluno_nome: achado.aluno_nome,
          created_at: achado.created_at,
        }
      : null;
  });
}

// ── 2) Pré-visualização ────────────────────────────────────────────────

export type PdfPreview = { ok: true; base64: string; filename: string } | { ok: false; message: string };

export async function previsualizarContratoLote(
  base: Base,
  aluno: Partial<AlunoContrato>
): Promise<PdfPreview> {
  try {
    const { supabase } = await requireCoordenador();
    const dados = await carregarBase(supabase, base);
    const { buffer, filename } = await gerarPdfContrato({
      numero: "PRÉVIA",
      ...dados,
      aluno: limparAluno(aluno),
      valor: null,
      emissaoIso: hojeIso(),
      teste: true,
    });
    return { ok: true, base64: buffer.toString("base64"), filename };
  } catch (error) {
    console.error("[contratos/lote] preview failed", error);
    return { ok: false, message: "Não foi possível gerar a pré-visualização." };
  }
}

const ALUNO_EXEMPLO: AlunoContrato = {
  nome: "Maria Aparecida da Silva",
  email: "maria.silva@exemplo.com",
  documento: "52998224725",
  telefone: "45999990000",
  rg: "12.345.678-9",
  nascimento: "15/04/1962",
  endereco: "Rua das Flores, 123, apto 4 — Centro, Foz do Iguaçu/PR, CEP 85851-000",
  nacionalidade: "brasileira",
  estadoCivil: "casada",
  profissao: "professora",
};

/** Pré-visualização do modelo que está sendo editado (texto ainda não salvo),
 *  preenchido com um aluno e um evento de exemplo. */
export async function previsualizarModelo(modelo: {
  titulo: string;
  categoria: string;
  conteudo: string;
}): Promise<PdfPreview> {
  try {
    await requireCoordenador();
    const titulo = modelo.titulo.trim() || "Modelo sem título";
    const conteudo = modelo.conteudo.trim();
    if (conteudo.length < 5) {
      return { ok: false, message: "Escreva o texto do modelo para pré-visualizar." };
    }
    const hoje = hojeIso();
    const { buffer, filename } = await gerarPdfContrato({
      numero: "PRÉVIA",
      modelo: { titulo, categoria: modelo.categoria || "outro" },
      conteudo: conteudo.slice(0, 50000),
      evento: {
        titulo: "Evento de exemplo",
        descricao: "Descrição do evento de exemplo.",
        data_evento: hoje,
        local: "Ectolab — Foz do Iguaçu/PR",
      },
      aluno: ALUNO_EXEMPLO,
      valor: 120,
      emissaoIso: hoje,
      teste: true,
    });
    return { ok: true, base64: buffer.toString("base64"), filename };
  } catch (error) {
    console.error("[contratos/modelos] preview failed", error);
    return { ok: false, message: "Não foi possível gerar a pré-visualização." };
  }
}

// ── 3) Envio de teste ──────────────────────────────────────────────────

export type LoteActionResult = { ok: boolean; message: string; url?: string };

export async function enviarTesteLote(
  base: Base,
  aluno: Partial<AlunoContrato>,
  emailTeste: string
): Promise<LoteActionResult> {
  try {
    const { supabase, user } = await requireCoordenador();
    const email = emailTeste.trim() || user.email || "";
    if (!emailValido(email)) return { ok: false, message: "Informe um e-mail válido para o teste." };
    const dados = await carregarBase(supabase, base);
    const nome =
      (user.user_metadata?.full_name as string | undefined)?.trim() || "Teste Ectolab";
    const resultado = await enviarTesteParaAssinatura(
      supabase,
      {
        numero: "TESTE",
        ...dados,
        aluno: limparAluno(aluno),
        valor: null,
        emissaoIso: hojeIso(),
      },
      { nome, email }
    );
    revalidatePath("/utilidades/contratos/lote");
    return resultado;
  } catch (error) {
    console.error("[contratos/lote] teste failed", error);
    return { ok: false, message: "Não foi possível enviar o teste." };
  }
}

// ── 4) Criação do lote ─────────────────────────────────────────────────

export type ItemLote = {
  aluno: Partial<AlunoContrato>;
  /** Contrato existente a atualizar (mesclagem) em vez de criar novo. */
  atualizarId?: number | null;
};

export type CriarLoteResult =
  | { ok: true; contratoIds: number[]; message: string }
  | { ok: false; message: string };

function colunasAluno(aluno: AlunoContrato) {
  return {
    aluno_nome: aluno.nome,
    aluno_email: aluno.email.toLowerCase() || null,
    aluno_documento: aluno.documento ? formatarCpf(aluno.documento) : null,
    aluno_telefone: aluno.telefone || null,
    aluno_rg: aluno.rg || null,
    aluno_nascimento: dataParaIso(aluno.nascimento),
    aluno_endereco: aluno.endereco || null,
    aluno_nacionalidade: aluno.nacionalidade || null,
    aluno_estado_civil: aluno.estadoCivil || null,
    aluno_profissao: aluno.profissao || null,
  };
}

export async function criarContratosLote(
  base: Base,
  prazoDias: number,
  itens: ItemLote[]
): Promise<CriarLoteResult> {
  try {
    const { supabase } = await requireCoordenador();
    if (itens.length === 0) return { ok: false, message: "Nenhum aluno no lote." };
    if (itens.length > MAX_LOTE) {
      return { ok: false, message: `No máximo ${MAX_LOTE} contratos por lote.` };
    }

    const alunos = itens.map((i) => limparAluno(i.aluno));
    const invalidos = alunos
      .map((a, i) => ({ i, erros: validarAluno(a).erros }))
      .filter((r) => r.erros.length > 0);
    if (invalidos.length > 0) {
      return {
        ok: false,
        message: `Corrija as linhas com erro antes de enviar (linha ${invalidos
          .slice(0, 5)
          .map((r) => r.i + 1)
          .join(", ")}${invalidos.length > 5 ? "…" : ""}).`,
      };
    }

    const saldo = await saldoCota(supabase);
    if (itens.length > saldo.restantes) {
      return {
        ok: false,
        message: `O lote tem ${itens.length} contratos, mas restam ${saldo.restantes} envios na cota deste mês (${saldo.usados}/${saldo.limite}).`,
      };
    }

    const dados = await carregarBase(supabase, base);
    const expiraEm = prazoCom(prazoDias);
    const contratoIds: number[] = [];

    for (let i = 0; i < itens.length; i++) {
      const colunas = colunasAluno(alunos[i]);
      const atualizarId = itens[i].atualizarId;
      if (atualizarId) {
        // Mesclagem: mesmo contrato, dados mais recentes, volta a "gerado"
        // para ser reenviado. Só contratos ainda não assinados.
        const { data, error } = await supabase
          .from("contratos")
          .update({ ...colunas, status: "gerado", expira_em: expiraEm })
          .eq("id", atualizarId)
          .eq("modelo_id", base.modeloId)
          .in("status", ["gerado", "assinando", "recusado"])
          .select("id")
          .maybeSingle();
        if (error || !data) {
          return {
            ok: false,
            message: `Não foi possível atualizar o contrato nº ${atualizarId} (linha ${i + 1}). Nada foi enviado ainda.`,
          };
        }
        contratoIds.push(data.id as number);
      } else {
        const { data, error } = await supabase
          .from("contratos")
          .insert({
            ...colunas,
            modelo_id: base.modeloId,
            evento_id: base.eventoId,
            conteudo_utilizado: dados.conteudoPersonalizado,
            status: "gerado",
            expira_em: expiraEm,
          })
          .select("id")
          .single();
        if (error || !data) {
          return {
            ok: false,
            message: `Não foi possível criar o contrato da linha ${i + 1}. ${contratoIds.length} já foram criados e aparecem na lista como "Gerado".`,
          };
        }
        contratoIds.push(data.id as number);
      }
    }

    revalidatePath("/utilidades/contratos");
    return { ok: true, contratoIds, message: `${contratoIds.length} contratos prontos para envio.` };
  } catch (error) {
    console.error("[contratos/lote] criar failed", error);
    return { ok: false, message: "Erro ao criar os contratos do lote." };
  }
}

// ── 5) Processamento de cada contrato ──────────────────────────────────

export async function processarContratoLote(
  contratoId: number,
  eventoId: number | null
): Promise<LoteActionResult> {
  try {
    const { supabase } = await requireCoordenador();
    let aviso = "";
    try {
      await arquivarContratoNoDrive(supabase, contratoId, eventoId);
    } catch (error) {
      console.error("[contratos/lote] drive failed", error);
      aviso = " (PDF não foi salvo no Drive)";
    }
    const envio = await enviarContratoParaAssinatura(supabase, contratoId);
    return { ok: envio.ok, message: envio.message + aviso, url: envio.url };
  } catch (error) {
    console.error("[contratos/lote] processar failed", error);
    return { ok: false, message: "Erro ao enviar este contrato." };
  }
}

export async function finalizarLote(): Promise<void> {
  await requireCoordenador();
  revalidatePath("/utilidades/contratos");
}

// src/lib/contratos/render.ts
// Carregamento e renderização de um contrato: busca os dados (contrato +
// modelo + evento), monta as variáveis do modelo e gera o buffer do PDF.
// Compartilhado entre a rota de download (/api/contratos/[id]/pdf) e a
// action de envio para assinatura (que regenera o mesmo PDF para a Assinafy).

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aplicarVariaveis, categoriaLabel } from "./variables";
import { buildContratoPdf } from "./pdf";
import { sanitizarNome } from "./drive-folders";

export { categoriaLabel } from "./variables";

export type ContratoStatus =
  | "gerado"
  | "assinando"
  | "assinado"
  | "recusado"
  | "cancelado";

export type ContratoRow = {
  id: number;
  modelo_id: number;
  evento_id: number | null;
  aluno_nome: string;
  aluno_email: string | null;
  aluno_documento: string | null;
  aluno_telefone: string | null;
  valor: number | null;
  status: ContratoStatus;
  expira_em: string | null;
  conteudo_utilizado: string | null;
  drive_pasta_id: string | null;
  drive_pasta_url: string | null;
  drive_arquivo_id: string | null;
  drive_arquivo_url: string | null;
  drive_assinado_id: string | null;
  drive_assinado_url: string | null;
  assinafy_document_id: string | null;
  assinafy_assignment_id: string | null;
  criado_por: string;
  created_at: string;
};

export type ContratoModeloRow = {
  id: number;
  titulo: string;
  categoria: string;
  descricao: string | null;
  conteudo: string;
  ativo: boolean;
};

export type EventoContratoRow = {
  titulo: string;
  descricao: string | null;
  data_evento: string;
  local: string | null;
};

export type ContratoCompleto = {
  contrato: ContratoRow;
  modelo: ContratoModeloRow;
  evento: EventoContratoRow | null;
};

function formatarData(iso: string): string {
  return format(new Date(`${iso.slice(0, 10)}T00:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });
}

export function formatarValor(valor: number | null): string | null {
  if (valor === null || valor === undefined) return null;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

/** Vencido é derivado na leitura: ainda pendente de assinatura e prazo passou. */
export function contratoVencido(
  contrato: Pick<ContratoRow, "status" | "expira_em">,
  hoje: string
): boolean {
  return (
    (contrato.status === "gerado" || contrato.status === "assinando") &&
    Boolean(contrato.expira_em) &&
    contrato.expira_em! < hoje
  );
}

export async function carregarContrato(
  supabase: SupabaseClient,
  id: number
): Promise<ContratoCompleto> {
  const { data: contrato, error } = await supabase
    .from("contratos")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !contrato) throw new Error("Contrato não encontrado");
  if (contrato.status === "cancelado") throw new Error("Contrato cancelado");

  const { data: modelo, error: modeloError } = await supabase
    .from("contrato_modelos")
    .select("id, titulo, categoria, descricao, conteudo, ativo")
    .eq("id", contrato.modelo_id)
    .single();
  if (modeloError || !modelo) throw new Error("Modelo do contrato não encontrado");

  let evento: EventoContratoRow | null = null;
  if (contrato.evento_id) {
    const { data } = await supabase
      .from("eventos")
      .select("titulo, descricao, data_evento, local")
      .eq("id", contrato.evento_id)
      .single();
    evento = data ?? null;
  }

  return {
    contrato: contrato as unknown as ContratoRow,
    modelo: modelo as unknown as ContratoModeloRow,
    evento,
  };
}

/** Renderiza o PDF completo do contrato (variáveis trocadas). */
export async function renderizarContratoPdf(
  completo: ContratoCompleto
): Promise<{ buffer: Buffer; filename: string }> {
  const { contrato, modelo, evento } = completo;
  const emissao = formatarData(contrato.created_at);
  const valor = formatarValor(contrato.valor);

  const conteudo = aplicarVariaveis(
    contrato.conteudo_utilizado ?? modelo.conteudo,
    {
      "{{aluno_nome}}": contrato.aluno_nome,
      "{{aluno_email}}": contrato.aluno_email ?? "",
      "{{aluno_documento}}": contrato.aluno_documento ?? "",
      "{{aluno_telefone}}": contrato.aluno_telefone ?? "",
      "{{evento_titulo}}": evento?.titulo ?? "",
      "{{evento_data}}": evento?.data_evento ? formatarData(evento.data_evento) : "",
      "{{evento_local}}": evento?.local ?? "",
      "{{evento_descricao}}": evento?.descricao ?? "",
      "{{valor}}": valor ?? "",
      "{{data_emissao}}": emissao,
      "{{modelo_titulo}}": modelo.titulo,
    }
  );

  const buffer = await buildContratoPdf({
    numero: String(contrato.id),
    modeloTitulo: modelo.titulo,
    categoriaLabel: categoriaLabel(modelo.categoria),
    conteudo,
    alunoNome: contrato.aluno_nome,
    alunoDocumento: contrato.aluno_documento,
    alunoEmail: contrato.aluno_email,
    alunoTelefone: contrato.aluno_telefone,
    valor,
    evento: evento
      ? {
          titulo: evento.titulo,
          data: evento.data_evento ? formatarData(evento.data_evento) : null,
          local: evento.local,
        }
      : null,
    emissao,
  });

  const filename = `${sanitizarNome(modelo.titulo)} - ${sanitizarNome(contrato.aluno_nome)}.pdf`;
  return { buffer, filename };
}

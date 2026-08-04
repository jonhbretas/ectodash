"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chatCompletion } from "@/lib/ai/ai-client";
import { matchResponsavel } from "@/lib/ai/match-responsavel";
import { parseXlsx } from "@/lib/financeiro/parse-file";

const financeiroEntrySchema = z.object({
  tipo: z.enum(["entrada", "saida"]),
  descricao: z.string(),
  valor: z.number(),
  data: z.string(),
  categoria: z.string().optional(),
});

const eventoEntrySchema = z.object({
  titulo: z.string(),
  data: z.string(),
  local: z.string().optional(),
  descricao: z.string().optional(),
});

const demandaEntrySchema = z.object({
  titulo: z.string(),
  responsavel_texto: z.string().optional(),
  prazo_texto: z.string().optional(),
  prazo_sugerido: z.string().optional(),
});

const responseSchema = z.object({
  tipo: z.enum([
    "financeiro",
    "eventos",
    "transcricao_reuniao",
    "ata_reuniao",
    "outro",
  ]),
  titulo: z.string(),
  resumo: z.string(),
  financeiro: z.array(financeiroEntrySchema).optional(),
  eventos: z.array(eventoEntrySchema).optional(),
  demandas: z.array(demandaEntrySchema).optional(),
});

export type AnalisarState = {
  ok: boolean;
  message: string;
  tipo: string | null;
  titulo: string | null;
  resumo: string | null;
  financeiro: Array<{
    key: string;
    tipo: string;
    descricao: string;
    valor: number;
    data: string;
    categoria: string | null;
  }> | null;
  eventos: Array<{
    key: string;
    titulo: string;
    data: string;
    local: string | null;
    descricao: string | null;
  }> | null;
  demandas: Array<{
    key: string;
    titulo: string;
    responsavelId: string | null;
    responsavelTexto: string;
    prazoTexto: string;
    prazoSugerido: string | null;
  }> | null;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// MiMo-V2.5 (mimo-v2.5) no gateway Go tem contexto grande e ~150 mil
// requisições/mês inclusas na assinatura — o teto aqui só protege o tempo
// de resposta, não o custo.
const MAX_TEXT_CHARS = 120000;
const EMPTY_INPUT = "Cole um texto ou envie um arquivo antes de analisar.";

async function extrairTextoDoArquivo(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const { rows } = parseXlsx(buffer);
    if (rows.length === 0) throw new Error("Planilha vazia ou inválida.");
    return rows
      .map((row) => row.map((cell) => String(cell ?? "")).join("\t"))
      .join("\n");
  }

  if (
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".md")
  ) {
    return await file.text();
  }

  throw new Error(
    "Formato não suportado. Envie .txt, .csv, .xlsx, .xls ou .md."
  );
}

async function chamarIA(texto: string) {
  const hoje = new Date().toISOString().slice(0, 10);

  return chatCompletion(
    `Você analisa documentos em português e extrai dados estruturados.
Responda APENAS com JSON. O JSON deve ter este formato:
{
  "tipo": "financeiro" | "eventos" | "transcricao_reuniao" | "ata_reuniao" | "outro",
  "titulo": "título resumindo o conteúdo",
  "resumo": "resumo didático em português (máx. 5 frases curtas)",
  "financeiro": [{"tipo": "entrada"|"saida", "descricao": "texto", "valor": 123.45, "data": "AAAA-MM-DD", "categoria": "categoria opcional"}],
  "eventos": [{"titulo": "nome", "data": "AAAA-MM-DD", "local": "lugar", "descricao": "detalhes"}],
  "demandas": [{"titulo": "tarefa", "responsavel_texto": "nome da pessoa no texto", "prazo_texto": "prazo como mencionado", "prazo_sugerido": "data concreta AAAA-MM-DD"}]
}
Inclua SOMENTE os campos relevantes ao tipo detectado (ex: se for financeiro, inclua apenas "financeiro" e omita "eventos" e "demandas").
VALORES MONETÁRIOS: sempre como número (ex: 1234.56, nunca "1.234,56").
DATAS: sempre AAAA-MM-DD. Para prazos relativos ("sexta", "amanhã", "fim do mês"), calcule a data concreta a partir de hoje (${hoje}).
Se o conteúdo não se encaixar em nenhuma categoria, use tipo "outro" e forneça apenas titulo e resumo.`,
    `Hoje é ${hoje}. Analise o conteúdo abaixo e extraia os dados estruturados:\n\n"""\n${texto.slice(0, MAX_TEXT_CHARS)}\n"""`,
    { jsonMode: true }
  );
}

export async function analisarComIA(
  prevState: AnalisarState,
  formData: FormData
): Promise<AnalisarState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message: "Sessão expirada. Faça login novamente.",
      tipo: null,
      titulo: null,
      resumo: null,
      financeiro: null,
      eventos: null,
      demandas: null,
    };
  }

  const arquivo = formData.get("arquivo");
  const textoPaste = formData.get("texto");

  let texto: string;

  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > MAX_FILE_BYTES) {
      return {
        ok: false,
        message: "Arquivo grande demais (máx. 5MB).",
        tipo: null,
        titulo: null,
        resumo: null,
        financeiro: null,
        eventos: null,
        demandas: null,
      };
    }
    try {
      texto = await extrairTextoDoArquivo(arquivo);
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Não foi possível ler o arquivo.",
        tipo: null,
        titulo: null,
        resumo: null,
        financeiro: null,
        eventos: null,
        demandas: null,
      };
    }
  } else if (
    typeof textoPaste === "string" &&
    textoPaste.trim().length > 0
  ) {
    texto = textoPaste.trim();
  } else {
    return {
      ok: false,
      message: EMPTY_INPUT,
      tipo: null,
      titulo: null,
      resumo: null,
      financeiro: null,
      eventos: null,
      demandas: null,
    };
  }

  if (texto.length === 0) {
    return {
      ok: false,
      message: EMPTY_INPUT,
      tipo: null,
      titulo: null,
      resumo: null,
      financeiro: null,
      eventos: null,
      demandas: null,
    };
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name");

  try {
    const raw = JSON.parse(await chamarIA(texto));
    const parsed = responseSchema.safeParse(raw);

    if (!parsed.success) {
      return {
        ok: false,
        message:
          "A IA retornou um formato inesperado. Tente novamente com um texto mais claro.",
        tipo: null,
        titulo: null,
        resumo: null,
        financeiro: null,
        eventos: null,
        demandas: null,
      };
    }

    const data = parsed.data;

    return {
      ok: true,
      message: "",
      tipo: data.tipo,
      titulo: data.titulo,
      resumo: data.resumo,
      financeiro: data.financeiro
        ? data.financeiro.map((e) => ({
            key: crypto.randomUUID(),
            tipo: e.tipo,
            descricao: e.descricao,
            valor: e.valor,
            data: e.data,
            categoria: e.categoria ?? null,
          }))
        : null,
      eventos: data.eventos
        ? data.eventos.map((e) => ({
            key: crypto.randomUUID(),
            titulo: e.titulo,
            data: e.data,
            local: e.local ?? null,
            descricao: e.descricao ?? null,
          }))
        : null,
      demandas: data.demandas
        ? data.demandas.map((d) => ({
            key: crypto.randomUUID(),
            titulo: d.titulo,
            responsavelId: matchResponsavel(
              d.responsavel_texto ?? "",
              profiles ?? []
            ),
            responsavelTexto: d.responsavel_texto ?? "",
            prazoTexto: d.prazo_texto ?? "",
            prazoSugerido: d.prazo_sugerido?.length
              ? d.prazo_sugerido
              : null,
          }))
        : null,
    };
  } catch (err) {
    console.error("analisarComIA: erro", err);
    return {
      ok: false,
      message:
        "Algo deu errado ao processar com a IA. Verifique sua internet e tente novamente.",
      tipo: null,
      titulo: null,
      resumo: null,
      financeiro: null,
      eventos: null,
      demandas: null,
    };
  }
}

// ── Save actions ──

export type SaveState = { ok: boolean; message: string };

const saveError: SaveState = {
  ok: false,
  message: "Não foi possível salvar. Tente novamente.",
};

export async function salvarFinanceiroDaAnalise(
  entries: Array<{
    tipo: string;
    descricao: string;
    valor: number;
    data: string;
    categoria: string | null;
  }>
): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const { error } = await supabase.from("financial_entries").insert(
    entries.map((e) => ({
      tipo: e.tipo,
      descricao: e.descricao,
      valor: e.valor,
      data: e.data,
      categoria: e.categoria ?? null,
    }))
  );

  if (error) {
    console.error("salvarFinanceiroDaAnalise:", error);
    return saveError;
  }

  revalidatePath("/financeiro");
  revalidatePath("/analisar");
  return { ok: true, message: `${entries.length} lançamentos salvos no financeiro.` };
}

export async function salvarEventosDaAnalise(
  events: Array<{
    titulo: string;
    data: string;
    local: string | null;
    descricao: string | null;
  }>
): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const { error } = await supabase.from("eventos").insert(
    events.map((e) => ({
      titulo: e.titulo,
      data_evento: e.data,
      local: e.local ?? null,
      descricao: e.descricao ?? null,
    }))
  );

  if (error) {
    console.error("salvarEventosDaAnalise:", error);
    return saveError;
  }

  revalidatePath("/eventos");
  revalidatePath("/analisar");
  return {
    ok: true,
    message: `${events.length} eventos salvos.`,
  };
}

export async function salvarDemandasDaAnalise(
  demands: Array<{
    titulo: string;
    responsavelId: string | null;
    prazoSugerido: string | null;
  }>
): Promise<SaveState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  let criadas = 0;
  const erros: string[] = [];

  for (const d of demands) {
    const { data: demanda, error: demandaError } = await supabase
      .from("demandas")
      .insert({
        titulo: d.titulo,
        prazo: d.prazoSugerido ?? null,
        status: "pendente",
      })
      .select("id")
      .single();

    if (demandaError || !demanda) {
      console.error("salvarDemandasDaAnalise: insert failed", demandaError);
      erros.push(d.titulo);
      continue;
    }

    if (d.responsavelId) {
      const { error: linkError } = await supabase
        .from("demanda_responsaveis")
        .insert({ demanda_id: demanda.id, profile_id: d.responsavelId });

      if (linkError) {
        console.error("salvarDemandasDaAnalise: responsavel link failed", linkError);
      }
    }

    criadas++;
  }

  revalidatePath("/");
  revalidatePath("/analisar");

  if (erros.length > 0) {
    return {
      ok: true,
      message: `${criadas} demandas salvas. ${erros.length} falharam: ${erros.join(", ")}`,
    };
  }

  return { ok: true, message: `${criadas} demandas salvas com sucesso.` };
}

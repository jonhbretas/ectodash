"use server";

// Reuniões AI analysis flow — two server actions around the same untrusted
// input discipline as demandas/extrair/actions.ts:
//
// 1. analisarTranscricao — takes a file (.pdf/.md/.txt), pasted text or a
//    Tactiq meeting id; parses/limits it; one AI call extracts the whole
//    envelope (ata resumo estruturado + demandas novas + atualizações de
//    demandas existentes + DIPs). Returns the validated analysis for the
//    human review gate.
// 2. salvarAtaAnalise — persists the human-approved analysis: the ata row,
//    new demandas (with responsáveis), update comments on existing
//    demandas, and DIP records. Every write goes through the same RLS that
//    gates the rest of the app (reunioes/demandas/demanda_comentarios/dips
//    — each table's own policy is the real boundary).
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chatCompletion } from "@/lib/ai/ai-client";
import { obterTranscricao } from "@/lib/meetings";
import { parseArquivoFonte, ArquivoNaoSuportadoError, ArquivoVazioError } from "@/lib/atas/parse-file";
import {
  ataAnaliseEnvelopeSchema,
  type AtaAnalise,
  type AtaSalvarDemanda,
  type AtaSalvarEvento,
  type AtaSalvarAtualizacao,
  type AtaSalvarDip,
} from "./analise-schema";

export type AnalisarTranscricaoState = {
  ok: boolean;
  message: string;
  analise: AtaAnalise | null;
  arquivoNome: string | null;
  texto: string | null;
};

export type SalvarAtaState = {
  ok: boolean;
  message: string;
  ataId: number | null;
};

const initialState: AnalisarTranscricaoState = {
  ok: false,
  message: "",
  analise: null,
  arquivoNome: null,
  texto: null,
};

// Tactiq transcripts can be far longer than a paste — the cap bounds cost
// only (same tradeoff as demandas/extrair/actions.ts).
const MEETING_TEXT_MAX = 60000;

const pasteSchema = z.object({
  texto: z
    .string()
    .trim()
    .min(1, "Cole a transcrição ou envie um arquivo antes de continuar.")
    .max(20000),
});

const AI_SYSTEM_PROMPT =
  "Você analisa transcrições de reunião e responde APENAS com JSON. " +
  'Formato obrigatório: {"analise": {"ata": {"titulo": string, "data": string (yyyy-MM-dd, "" se não mencionada), "horario": string (HH:mm, "" se não mencionado), "participantes": string[], "pontos_principais": string[], "deliberacoes": string[], "resumo": string}, "demandas": [{"titulo": string, "responsavel_texto": string, "prazo_texto": string, "prazo_sugerido": string}], "eventos": [{"titulo": string, "data": string (yyyy-MM-dd, "" se não mencionada), "local": string ("" se não mencionado), "descricao": string ("" se não mencionado)}], "atualizacoes": [{"titulo": string, "comentario": string}], "dips": [{"localidade": string, "pais": string, "data": string (yyyy-MM-dd, "" se não mencionada), "participantes": number, "" quando não mencionado, "observacoes": string}]}}. ' +
  "Regras: demandas = deliberações NOVAS com responsável e prazo claros. " +
  "eventos = eventos institucionais mencionados (ex.: qualificações, encontros, DIPs comemorativas, cursos, workshops, lives). Extraia titulo, data, local e descricao quando disponíveis. " +
  "atualizacoes = menções a demandas JÁ EXISTENTES (ex.: 'atualizar demanda X', 'a demanda Y avançou'); titulo deve ser o título da demanda existente; comentario descreve o que mudou. " +
  "dips = menções à Dinâmica DIP (localidades, países, datas, quantos participantes). " +
  "Se uma seção não tiver itens, use o array vazio. Não escreva nada fora do JSON.";

async function extractWithAi(texto: string): Promise<AtaAnalise> {
  const rawJson = JSON.parse(
    await chatCompletion(
      AI_SYSTEM_PROMPT,
      `Hoje é ${new Date().toISOString().slice(0, 10)}. Analise a transcrição a seguir:\n\n"""\n${texto}\n"""`,
      { jsonMode: true }
    )
  );
  const validated = ataAnaliseEnvelopeSchema.safeParse(rawJson);
  if (!validated.success) {
    throw new Error("análise em formato inesperado");
  }
  return validated.data.analise;
}

export async function analisarTranscricao(
  prevState: AnalisarTranscricaoState,
  formData: FormData
): Promise<AnalisarTranscricaoState> {
  // Every known failure returns a friendly state; this blanket guard keeps
  // anything unexpected (network hiccup on auth, provider timeout escaping
  // a nested call) from reaching the global error boundary — the screen
  // shows an inline message instead of the "Não foi possível carregar esta
  // página" page (user report 2026-08-04, digest 157915985).
  try {
    return await analisarTranscricaoImpl(prevState, formData);
  } catch (err) {
    console.error("analisarTranscricao: unexpected error", err);
    return {
      ...initialState,
      message:
        "Algo deu errado ao processar a transcrição. Tente novamente em instantes.",
    };
  }
}

async function analisarTranscricaoImpl(
  prevState: AnalisarTranscricaoState,
  formData: FormData
): Promise<AnalisarTranscricaoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...initialState, message: "Sessão expirada. Faça login novamente." };
  }

  // Source resolution, in priority order: uploaded file > Tactiq meeting >
  // pasted text.
  let texto: string;
  let arquivoNome: string | null = null;

  const arquivo = formData.get("arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    try {
      const fonte = await parseArquivoFonte(arquivo);
      texto = fonte.texto;
      arquivoNome = fonte.nome;
    } catch (err) {
      if (err instanceof ArquivoNaoSuportadoError || err instanceof ArquivoVazioError) {
        return { ...initialState, message: err.message };
      }
      console.error("analisarTranscricao: file parse failed", err);
      return {
        ...initialState,
        message: "Não foi possível ler o arquivo. Envie um PDF, .md ou .txt válido.",
      };
    }
  } else {
    const reuniaoId = formData.get("reuniaoId");
    if (typeof reuniaoId === "string" && reuniaoId.trim().length > 0) {
      try {
        const transcricao = await obterTranscricao(reuniaoId);
        texto = transcricao.texto.slice(0, MEETING_TEXT_MAX);
        arquivoNome = null;
      } catch (err) {
        console.error("analisarTranscricao: Tactiq transcript fetch failed", err);
        return {
          ...initialState,
          message: "Não foi possível buscar a transcrição dessa reunião no Tactiq. Tente novamente.",
        };
      }
    } else {
      const parsed = pasteSchema.safeParse({ texto: formData.get("texto") });
      if (!parsed.success) {
        return { ...initialState, message: "Cole a transcrição ou envie um arquivo antes de continuar." };
      }
      texto = parsed.data.texto;
    }
  }

  // Same session-bound client only — never the service-role factory.
  try {
    const analise = await extractWithAi(texto);
    if (!analise.ata.resumo && analise.ata.titulo.trim().length === 0) {
      return {
        ...initialState,
        message: "A IA não conseguiu extrair a ata dessa transcrição. Tente novamente.",
      };
    }
    return {
      ok: true,
      message: "",
      analise,
      arquivoNome,
      texto: texto.slice(0, MEETING_TEXT_MAX + 60000),
    };
  } catch (err) {
    console.error("analisarTranscricao: AI call failed", err);
    return {
      ...initialState,
      message:
        "Algo deu errado ao processar a transcrição com a IA. Verifique sua internet e tente novamente.",
    };
  }
}

// ---------------------------------------------------------------------------
// Salvar (persist)

const dataRegex = /^\d{4}-\d{2}-\d{2}$/;

const salvarAtaSchema = z.object({
  titulo: z.string().trim().min(1, "Dê um título à ata.").max(200),
  data_reuniao: z.string().regex(dataRegex, "Escolha uma data válida."),
  horario: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.")
    .optional()
    .or(z.literal("")),
  resumo: z.string().trim().max(10000).optional().or(z.literal("")),
  participantes: z.string().trim().max(20000).optional().or(z.literal("")),
  pontos_principais: z.string().trim().max(20000).optional().or(z.literal("")),
  deliberacoes: z.string().trim().max(30000).optional().or(z.literal("")),
  texto: z.string().trim().max(200000).optional().or(z.literal("")),
  arquivo_nome: z.string().trim().max(300).optional().or(z.literal("")),
});

const salvarDemandasSchema = z
  .array(
    z.object({
      titulo: z.string().trim().min(1).max(200),
      responsavelId: z.string().uuid().nullable(),
      prazo: z.string().regex(dataRegex).nullable(),
    })
  )
  .max(50);

const salvarAtualizacoesSchema = z
  .array(
    z.object({
      titulo: z.string().trim().min(1).max(300),
      comentario: z.string().trim().min(1).max(3000),
    })
  )
  .max(50);

const salvarDipsSchema = z
  .array(
    z.object({
      localidade: z.string().trim().min(1).max(200),
      pais: z.string().trim().min(1).max(100),
      data: z.string().regex(dataRegex).nullable(),
      participantes: z.union([z.number().int().nonnegative(), z.null()]),
      observacoes: z.string().trim().max(3000),
    })
  )
  .max(100);

const salvarEventosSchema = z
  .array(
    z.object({
      titulo: z.string().trim().min(1).max(200),
      data: z.string().regex(dataRegex).nullable(),
      local: z.string().trim().max(300).nullable(),
      descricao: z.string().trim().max(3000).nullable(),
    })
  )
  .max(50);

function parseJsonField(formData: FormData, key: string): unknown {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim().length === 0) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function salvarAtaAnalise(
  prevState: SalvarAtaState,
  formData: FormData
): Promise<SalvarAtaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente.", ataId: null };
  }

  const ata = salvarAtaSchema.safeParse({
    titulo: formData.get("titulo"),
    data_reuniao: formData.get("data_reuniao"),
    horario: formData.get("horario"),
    resumo: formData.get("resumo"),
    participantes: formData.get("participantes"),
    pontos_principais: formData.get("pontos_principais"),
    deliberacoes: formData.get("deliberacoes"),
    texto: formData.get("texto"),
    arquivo_nome: formData.get("arquivo_nome"),
  });

  const demandas = salvarDemandasSchema.safeParse(parseJsonField(formData, "demandas"));
  const atualizacoes = salvarAtualizacoesSchema.safeParse(
    parseJsonField(formData, "atualizacoes")
  );
  const dips = salvarDipsSchema.safeParse(parseJsonField(formData, "dips"));
  const eventos = salvarEventosSchema.safeParse(parseJsonField(formData, "eventos"));

  if (
    !ata.success ||
    !demandas.success ||
    !atualizacoes.success ||
    !dips.success ||
    !eventos.success
  ) {
    return {
      ok: false,
      message: "Os dados da análise não são válidos. Refaça a análise e tente novamente.",
      ataId: null,
    };
  }

  const { data: novaAta, error: ataError } = await supabase
    .from("reunioes")
    .insert({
      titulo: ata.data.titulo,
      data_reuniao: ata.data.data_reuniao,
      horario: ata.data.horario || null,
      resumo: ata.data.resumo || null,
      participantes: ata.data.participantes || null,
      pontos_principais: ata.data.pontos_principais || null,
      deliberacoes: ata.data.deliberacoes || null,
      texto: ata.data.texto || null,
      arquivo_nome: ata.data.arquivo_nome || null,
    })
    .select("id")
    .single();

  if (ataError || !novaAta) {
    console.error("salvarAtaAnalise: reunioes insert failed", ataError);
    return {
      ok: false,
      message: "Não foi possível salvar a ata agora. Tente novamente.",
      ataId: null,
    };
  }

  const ataId = novaAta.id;
  const tituloReferencia = `${ata.data.titulo} (${ata.data.data_reuniao})`;

  // New demandas from deliberations — same batched-insert shape as
  // createDemanda, without the form layer.
  for (const demanda of demandas.data as AtaSalvarDemanda[]) {
    const { data: criada, error: demandaError } = await supabase
      .from("demandas")
      .insert({
        titulo: demanda.titulo,
        prazo: demanda.prazo,
        status: "pendente",
        area: null,
        projeto: null,
      })
      .select("id")
      .single();
    if (demandaError || !criada) {
      console.error("salvarAtaAnalise: demanda insert failed", demandaError);
      continue;
    }
    if (demanda.responsavelId) {
      const { error: respError } = await supabase
        .from("demanda_responsaveis")
        .insert({ demanda_id: criada.id, profile_id: demanda.responsavelId });
      if (respError) {
        console.error("salvarAtaAnalise: demanda_responsaveis insert failed", respError);
      }
    }
  }

  // Updates land as comments on the matching EXISTING demanda (user
  // decision 2026-08-04). Matching is by title (ilike) preferring
  // in-progress demandas over concluded ones; unmatched mentions are
  // skipped (logged), never silently attached to a wrong demand.
  for (const atualizacao of atualizacoes.data as AtaSalvarAtualizacao[]) {
    const { data: candidatas } = await supabase
      .from("demandas")
      .select("id, status")
      .ilike("titulo", `%${atualizacao.titulo}%`)
      .order("status", { ascending: false })
      .limit(10);

    const alvo =
      candidatas?.find((d) => d.status !== "concluida") ?? candidatas?.[0] ?? null;
    if (!alvo) {
      console.warn("salvarAtaAnalise: no matching demanda for update", atualizacao.titulo);
      continue;
    }
    const { error: comentarioError } = await supabase
      .from("demanda_comentarios")
      .insert({
        demanda_id: alvo.id,
        conteudo: `Atualização da reunião "${tituloReferencia}": ${atualizacao.comentario}`,
      });
    if (comentarioError) {
      console.error("salvarAtaAnalise: comentario insert failed", comentarioError);
    }
  }

  // Event records — one row per event mentioned in the meeting.
  const eventoRows = (eventos.data as AtaSalvarEvento[])
    .filter((evento) => evento.titulo.trim() && evento.data)
    .map((evento) => ({
      titulo: evento.titulo,
      data_evento: evento.data,
      local: evento.local || null,
      descricao: evento.descricao || null,
    }));

  if (eventoRows.length > 0) {
    const { error: eventosError } = await supabase.from("eventos").insert(eventoRows);
    if (eventosError) {
      console.error("salvarAtaAnalise: eventos insert failed", eventosError);
    }
  }

  // DIP records — one row per mention (user decision 2026-08-04).
  const dipRows = (dips.data as AtaSalvarDip[])
    .filter((dip) => dip.localidade.trim() && dip.pais.trim())
    .map((dip) => ({
      ata_id: ataId,
      localidade: dip.localidade,
      pais: dip.pais,
      data_dip: dip.data,
      participantes: dip.participantes,
      observacoes: dip.observacoes || null,
    }));

  if (dipRows.length > 0) {
    const { error: dipsError } = await supabase.from("dips").insert(dipRows);
    if (dipsError) {
      console.error("salvarAtaAnalise: dips insert failed", dipsError);
    }
  }

  revalidatePath("/reunioes");
  revalidatePath("/eventos");
  revalidatePath("/dips");
  revalidatePath("/");

  return {
    ok: true,
    message: "Ata salva com sucesso.",
    ataId,
  };
}

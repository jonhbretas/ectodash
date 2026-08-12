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
import { chatCompletion, wrapUserContent } from "@/lib/ai/ai-client";
import { resolverDestinosVoluntario } from "@/lib/destinos-voluntario";
import { matchResponsavelRoster } from "@/lib/ai/match-responsavel";
import { obterTranscricao } from "@/lib/meetings";
import { parseArquivoFonte, ArquivoNaoSuportadoError, ArquivoVazioError } from "@/lib/atas/parse-file";
import { sanitizeSearch } from "@/lib/utils";
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
  'Formato obrigatório: {"analise": {"ata": {"titulo": string, "data": string (yyyy-MM-dd, "" se não mencionada), "horario": string (HH:mm, "" se não mencionado), "participantes": string[], "pontos_principais": string[], "deliberacoes": string[], "resumo": string}, "demandas": [{"titulo": string, "responsavel_texto": string, "prazo_texto": string, "prazo_sugerido": string, "area_texto": string, "projeto_texto": string, "evento_texto": string, "etiqueta_texto": string}], "eventos": [{"titulo": string, "data": string (yyyy-MM-dd, "" se não mencionada), "local": string ("" se não mencionado), "descricao": string ("" se não mencionado)}], "atualizacoes": [{"titulo": string, "comentario": string}], "dips": [{"localidade": string, "pais": string, "data": string (yyyy-MM-dd, "" se não mencionada), "participantes": number, "" quando não mencionado, "observacoes": string}]}}. ' +
  "Regras: demandas = deliberações NOVAS com responsável e prazo claros. " +
  "Para CADA demanda, identifique SEMPRE também: area_texto = a área institucional relacionada à demanda (ex.: Paratecnológico, Comunicação, Financeiro), projeto_texto = o projeto relacionado quando mencionado, evento_texto = o evento relacionado quando mencionado (use o MESMO título do evento da seção eventos quando aplicável), etiqueta_texto = a etiqueta relacionada quando mencionada. Use \"\" quando não houver menção. " +
  "eventos = eventos institucionais mencionados (ex.: qualificações, encontros, DIPs comemorativas, cursos, workshops, lives). Extraia titulo, data, local e descricao quando disponíveis. " +
  "atualizacoes = menções a demandas JÁ EXISTENTES (ex.: 'atualizar demanda X', 'a demanda Y avançou'); titulo deve ser o título da demanda existente; comentario descreve o que mudou. " +
  "dips = menções à Dinâmica DIP (localidades, países, datas, quantos participantes). " +
  "Se uma seção não tiver itens, use o array vazio. Não escreva nada fora do JSON.";

async function extractWithAi(texto: string): Promise<AtaAnalise> {
  const rawJson = JSON.parse(
    await chatCompletion(
      AI_SYSTEM_PROMPT,
      `Hoje é ${new Date().toISOString().slice(0, 10)}. Analise a transcrição a seguir:\n\n${wrapUserContent(texto)}`,
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
      // Roster volunteer id (voluntarios.id) as a string — the review
      // selects list the full roster, account or not; resolution to
      // profile_id/voluntario_id happens at save time.
      responsavelId: z
        .string()
        .regex(/^\d+$/, "responsável inválido")
        .nullable(),
      prazo: z.string().regex(dataRegex).nullable(),
      area: z.string().trim().max(200).nullable(),
      projeto: z.string().trim().max(200).nullable(),
      // "" | "novo:<index>" | "existente:<id>"
      eventoRef: z.string().trim().max(50).nullable(),
      etiquetaId: z.number().int().positive().nullable(),
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

  // Auto-vínculo de participantes ao roster: cada nome em texto livre da
  // ata é casado deterministicamente com voluntarios.nome (matchResponsavel
  // roster matcher, same rule as the demandas review). Nomes sem match
  // confiável ficam só no texto livre — o criador pode vincular depois na
  // tela da ata. RLS 0023 valida: quem salva a análise é o criador da ata.
  const participantesTexto = (ata.data.participantes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (participantesTexto.length > 0) {
    const [rosterRows, profileRows] = await Promise.all([
      supabase.from("voluntarios").select("id, nome").eq("ativo", true),
      supabase
        .from("profiles")
        .select("id, email, full_name, voluntario_id")
        .not("voluntario_id", "is", null),
    ]);
    const profiles = (profileRows.data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
    }));
    const roster = (rosterRows.data ?? []).map((v) => ({
      id: v.id,
      nome: v.nome,
      profileId:
        (profileRows.data ?? []).find((p) => p.voluntario_id === v.id)?.id ??
        null,
    }));

    const vinculos = [
      ...new Map(
        participantesTexto
          .map((nome) => matchResponsavelRoster(nome, profiles, roster))
          .filter(
            (match): match is { profileId: string | null; rosterId: number } =>
              match.rosterId !== null
          )
          .map((match) => [match.rosterId, { ata_id: ataId, voluntario_id: match.rosterId }])
      ).values(),
    ];

    if (vinculos.length > 0) {
      const { error: vinculoError } = await supabase
        .from("ata_participantes")
        .insert(vinculos);
      if (vinculoError) {
        console.error(
          "salvarAtaAnalise: ata_participantes auto-link failed",
          vinculoError
        );
      }
    }
  }

  // Event records — created FIRST so the new demandas can link their
  // evento_id to an event from this same analysis ("novo:<index>" refs).
  // Same filter the review applies: only included events with titulo+data.
  const eventosRevisados = (eventos.data as AtaSalvarEvento[]).filter(
    (evento) => evento.titulo.trim() && evento.data
  );
  const novoEventoIdPorIndice = new Map<number, number>();
  for (const [indice, evento] of eventosRevisados.entries()) {
    const { data: criado, error: eventoError } = await supabase
      .from("eventos")
      .insert({
        titulo: evento.titulo,
        data_evento: evento.data,
        local: evento.local || null,
        descricao: evento.descricao || null,
      })
      .select("id")
      .single();
    if (eventoError || !criado) {
      console.error("salvarAtaAnalise: evento insert failed", eventoError);
      continue;
    }
    novoEventoIdPorIndice.set(indice, criado.id);
  }

  function resolverEventoId(eventoRef: string | null): number | null {
    if (!eventoRef) return null;
    if (eventoRef.startsWith("novo:")) {
      const indice = Number(eventoRef.slice(5));
      return Number.isInteger(indice) ? (novoEventoIdPorIndice.get(indice) ?? null) : null;
    }
    if (eventoRef.startsWith("existente:")) {
      const id = Number(eventoRef.slice(10));
      return Number.isInteger(id) ? id : null;
    }
    return null;
  }

  // New demandas from deliberations — same batched-insert shape as
  // createDemanda, without the form layer. area/projeto persist the
  // review-approved free texts; evento_id resolves the selected event.
  for (const demanda of demandas.data as AtaSalvarDemanda[]) {
    const { data: criada, error: demandaError } = await supabase
      .from("demandas")
      .insert({
        titulo: demanda.titulo,
        prazo: demanda.prazo,
        status: "pendente",
        area: demanda.area || null,
        projeto: demanda.projeto || null,
        evento_id: resolverEventoId(demanda.eventoRef),
        etiqueta_id: demanda.etiquetaId || null,
      })
      .select("id")
      .single();
    if (demandaError || !criada) {
      console.error("salvarAtaAnalise: demanda insert failed", demandaError);
      continue;
    }
    if (demanda.responsavelId) {
      // Roster volunteer id → effective destination (profile_id when the
      // volunteer has a linked account, voluntario_id otherwise) — same
      // rule as createDemanda (migration 0020).
      const [destino] = await resolverDestinosVoluntario(
        supabase,
        [Number(demanda.responsavelId)]
      );
      if (destino) {
        const { error: respError } = await supabase
          .from("demanda_responsaveis")
          .insert({ demanda_id: criada.id, ...destino });
        if (respError) {
          console.error("salvarAtaAnalise: demanda_responsaveis insert failed", respError);
        }
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
      .ilike("titulo", `%${sanitizeSearch(atualizacao.titulo)}%`)
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

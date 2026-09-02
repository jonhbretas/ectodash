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
import { applyGlossary } from "@/lib/glossary";
import { listarTermosGlossario } from "@/lib/glossary-db";
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
  type AtaSalvarPauta,
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
  "Você analisa transcrições de reunião do Ectolab e responde APENAS com JSON. " +
  'Formato obrigatório: {"analise": {"ata": {"titulo": string, "data": string (yyyy-MM-dd, "" se não mencionada), "horario": string (HH:mm, "" se não mencionado), "participantes": string[], "pontos_principais": string[], "deliberacoes": string[], "resumo": string}, "demandas": [{"titulo": string, "responsavel_texto": string, "prazo_texto": string, "prazo_sugerido": string, "area_texto": string, "projeto_texto": string, "evento_texto": string, "etiqueta_texto": string}], "eventos": [{"titulo": string, "data": string (yyyy-MM-dd, "" se não mencionada), "local": string ("" se não mencionado), "descricao": string ("" se não mencionado)}], "atualizacoes": [{"titulo": string, "comentario": string}], "dips": [{"localidade": string, "pais": string, "data": string (yyyy-MM-dd, "" se não mencionada), "participantes": number | "", "observacoes": string}], "pautas": [{"titulo": string, "contexto": string}]}}. ' +
  "MODO DE TRABALHO — DUAS PASSADAS OBRIGATÓRIAS (interno): " +
  "PASSADA 1 — EXTRAÇÃO (sem resumir): varra a transcrição do início ao fim e extraia, com timestamp mental, TODO item que contenha: (a) data, (b) valor em reais, (c) número/quantidade, (d) nome próprio + associação, (e) verbo indicando compromisso futuro ('vou','vamos','preciso','tem que','fica com','até dia','semana que vem','me manda'), (f) pergunta sem resposta, (g) problema relatado mesmo que ninguém tenha assumido (ex.: evento duplicado no ICNET, PIX que não entra, parcelamento que não funciona), (h) aprovação/reprovação explícita ('aprovado','fechado','para mim tá ok'), (i) tarefa concluída na reunião ('já enviei','concluída'), (j) assunto cortado/adiado ('tratamos offline','fica para a próxima'). " +
  "PASSADA 2 — REDAÇÃO: organize por pauta na ordem em que ocorreu, com o nome do responsável no título da seção. CADA item da Passada 1 deve aparecer em algum lugar da ata. Se não couber em nenhuma seção, vai para pontos_principais ou deliberacoes como 'Outros registros' — NUNCA descartar. Só conversa social (clima, saudação, brincadeira) pode ser descartada. " +
  "REGRA DE OURO: Nada que tenha número, data, nome próprio, valor em reais ou verbo no futuro pode ser descartado — mesmo que dito em meia frase, no meio de outro assunto, por alguém que falou só uma vez. " +
  "CLASSIFICAÇÃO DAS FALAS (aplique antes de escrever): Decisão ('fechado','aprovado','vamos fazer','fica você') → deliberacoes + tabela de decisões; Demanda ('vou','preciso','tem que','me manda','fica de') → demandas; Informe (relato do já feito) → pontos_principais; Número/indicador → tabela dentro de pontos_principais ou observacoes; Alerta/ressalva ('cuidado','só lembrando','não esquece','ao virar o lote, mudar valor na loja','relação com CEAEC é delicada') → deliberacoes em bloco de alerta; Problema em aberto ('não funciona','não entrou','tem dois eventos') → demandas com responsável 'a definir' se ninguém assumiu; Assunto adiado ('tratamos offline','depois converso','tratar em particular') → pautas com contexto + registrar destino; Conversa social → descartar. " +
  "ARMADILHAS: (1) Fala cruzada — transcrição intercala assuntos; reconstrua o fio por assunto, não por ordem de linha. (2) Decisão vem depois de debate longo — em blocos de 20+ falas, a conclusão está nas 3 últimas; não resuma o debate e esqueça a conclusão. (3) Quem fala pouco fala coisa importante — Lídia Bolfe (4 falas) trouxe o combo; Marcos Ulaf (3 falas) achou o duplicado — não filtre por volume. (4) Contas ditas em voz alta saem confusas — se sequência não fecha, registre os valores ditos e acrescente '[conferir planilha]' na observacao. (5) Contas institucionais ('DIP Ectolab','Parapedagógico') não são pessoas — identifique a pessoa quando o contexto permitir (Parapedagógico = Paulo Battistela). (6) Cobrança de prazo é conteúdo de ata — 'essa tarefa venceu ontem/31/08' vira demanda com prazo vencido. (7) Decisões escondidas em conversa informal — 'Rinaldo e Eliane vão ao workshop' decidido em 6 falas curtas deve virar deliberacao. " +
  "REGRAS ESPECÍFICAS: demandas = deliberações NOVAS com responsável e prazo (inclua também demandas vencidas/críticas cobradas na reunião e problemas operacionais sem dono → responsável_texto='a definir', prazo_texto com data vencida quando citada). Para CADA demanda, identifique SEMPRE também: area_texto, projeto_texto, evento_texto (use o MESMO título do evento da seção eventos quando aplicável), etiqueta_texto. Use \"\" quando não houver menção. Não invente prazo/valor/responsável — se não houver, use \"\". Trecho ilegível: registre nome/valor como '[a confirmar]' em vez de omitir. " +
  "eventos = todos os eventos institucionais mencionados com titulo/data/local/descricao; inclua datas futuras ditas de passagem (ex.: 25/06/2027, 05/09 DIP RJ, 02/09 17h30, 03/09). " +
  "atualizacoes = menções a demandas JÁ EXISTENTES; titulo = título da demanda existente; comentario descreve o que mudou. " +
  "dips = menções à Dinâmica DIP (localidade, país, data, participantes, observacoes) — preserve números exatos (ex.: 25 Foz 21/08, 21 Curitiba, 22 Florianópolis, 406 registros presenciais, 60 à distância, 176 usuários, 512 pedidos, 37 relatórios). " +
  "pautas = assuntos que ficaram PARA A PRÓXIMA reunião; não inclua já deliberados; registre também assuntos cortados com destino offline. " +
  "participantes = TODOS que falaram ou foram citados como presentes, incluindo saídas antecipadas com horário/motivo entre parênteses (ex.: 'Margrit Stüpp (saída 1h14)'). Normalize nomes pelo glossário: Margrit/Rinaldo/Giuliano/Myriam/Miryan/Dalvan/Ara/Goretti/Marcos Ulaf/Celeste/Hernandes/Jonathan etc. ATENÇÃO: 'Miriam' pode ser Myriam Sanchez (coordenação/financeiro) ou Miryan Akemi Ishikawa (Virada/POLICONS) — desambigue pelo assunto. " +
  "pontos_principais/deliberacoes: preserve TODO número/valor/prazo em negrito implícito (ex.: R$ 7.743, R$ 138,20, 9 presenciais/2 online) e contexto que explica a decisão (por que gratuita, por que privado no Sympla, por que hotel caro). Alertas e ressalvas entram em deliberacoes. " +
  "Se uma seção não tiver itens, use array vazio. Não escreva nada fora do JSON. Nunca invente prazo, valor ou nome para preencher lacuna.";

function hojeBRTISO(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce(
      (acc, p) => {
        if (p.type === "year") acc.year = p.value;
        if (p.type === "month") acc.month = p.value;
        if (p.type === "day") acc.day = p.value;
        return acc;
      },
      { year: "", month: "", day: "" } as Record<string, string>
    );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function extractWithAi(
  texto: string,
  contextoAtaAnterior?: string | null
): Promise<AtaAnalise> {
  const hoje = hojeBRTISO();
  const contextoBloco = contextoAtaAnterior
    ? `\n\nATA ANTERIOR (para continuidade de demandas em aberto e progresso):\n${wrapUserContent(contextoAtaAnterior.slice(0, 4000))}\nUse-a apenas para dar continuidade — registre o que foi concluído desde então e não duplique demandas já concluídas.\n`
    : "";
  const rawJson = JSON.parse(
    await chatCompletion(
      AI_SYSTEM_PROMPT,
      `Hoje é ${hoje} (America/Sao_Paulo).${contextoBloco}\nTranscrição a analisar (PASSADA 1 = extração bruta, PASSADA 2 = redação — cada item da Passada 1 deve aparecer):\n\n${wrapUserContent(texto)}\n\nREGRAS ADICIONAIS DE CONTEXTO:\n- Vocabulário fixo: Ectolab, DIP, Sympla, UNICIN, CEAEC, POLICONS, Epicon, paracirurgia, ectoplasmólogo, conscienciologia, verbete, tenepes — já normalizado via glossário mas confirme.\n- Números ditos em voz alta ("mil e quinhentos", "sete mil setecentos e quarenta e três") normalize para R$ 0.000,00; se sequência não fecha, marque [conferir planilha] na observacao.\n- REGRA DIP (CRÍTICA): DIPs sempre às sextas; reuniões às terças discutem a DIP da sexta imediatamente anterior. Sem data explícita → calcule como sexta anterior à data da reunião (ata.data). Sem data da reunião → sexta anterior a Hoje (${hoje}). Ex.: reunião 2026-09-01 (terça) → DIP 2026-08-28. Nunca use duas semanas atrás salvo "retrasada"/"há duas semanas".\n- Não invente prazo/valor/nome; prazo desconhecido = ""; trecho ilegível = "[a confirmar]" no campo texto correspondente.\n- Aplique checklist de validação antes de responder: toda data futura no calendário? todo valor? toda frase com vou/preciso tem demanda? todo problema operacional tem demanda? todo assunto cortado tem destino?`,
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
    // Dicionário (0079): traduz termos do jargão (ex.: SIAEC → CEAEC) antes
    // da análise. Falhas de leitura são toleradas — a análise segue com o
    // texto original se o dicionário não puder ser carregado.
    let termosGlossario: { term: string; replacement: string }[] = [];
    try {
      termosGlossario = await listarTermosGlossario(supabase);
    } catch (err) {
      console.error("analisarTranscricao: glossary load failed", err);
    }
    if (termosGlossario.length > 0) {
      texto = applyGlossary(texto, termosGlossario);
    }
    // Orientação §10.4: alimentar gerador com a ata anterior para continuidade
    let contextoAtaAnterior: string | null = null;
    try {
      const { data: ultimaAta } = await supabase
        .from("reunioes")
        .select("titulo, data_reuniao, resumo, pontos_principais, deliberacoes")
        .order("data_reuniao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ultimaAta) {
        contextoAtaAnterior = [
          `Título: ${ultimaAta.titulo}`,
          `Data: ${ultimaAta.data_reuniao}`,
          ultimaAta.resumo ? `Resumo: ${ultimaAta.resumo.slice(0, 800)}` : "",
          ultimaAta.pontos_principais ? `Pontos: ${ultimaAta.pontos_principais.slice(0, 1000)}` : "",
          ultimaAta.deliberacoes ? `Deliberações: ${ultimaAta.deliberacoes.slice(0, 1000)}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
    } catch {
      // continuidade é best-effort — falha não bloqueia a análise
    }
    const analise = await extractWithAi(texto, contextoAtaAnterior);
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

const salvarPautasSchema = z
  .array(
    z.object({
      titulo: z.string().trim().min(1).max(200),
      contexto: z.string().trim().max(3000).nullable(),
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
  const pautas = salvarPautasSchema.safeParse(parseJsonField(formData, "pautas"));

  if (
    !ata.success ||
    !demandas.success ||
    !atualizacoes.success ||
    !dips.success ||
    !eventos.success ||
    !pautas.success
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

  // Pautas adiadas para a próxima reunião — origem 'ata' ligada à ata que
  // as levantou. Alimentam a lista de pauta do hub de Reuniões.
  const pautaRows = (pautas.data as AtaSalvarPauta[])
    .filter((pauta) => pauta.titulo.trim().length > 0)
    .map((pauta) => ({
      titulo: pauta.titulo,
      contexto: pauta.contexto || null,
      origem: "ata",
      status: "pendente",
      ata_id: ataId,
    }));

  if (pautaRows.length > 0) {
    const { error: pautasError } = await supabase.from("pautas").insert(pautaRows);
    if (pautasError) {
      console.error("salvarAtaAnalise: pautas insert failed", pautasError);
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

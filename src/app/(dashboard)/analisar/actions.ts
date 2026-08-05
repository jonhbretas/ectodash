"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { chatCompletion } from "@/lib/ai/ai-client";
import { matchResponsavelRoster } from "@/lib/ai/match-responsavel";
import { parseXlsx } from "@/lib/financeiro/parse-file";
const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

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

// Structured ata envelope — the same shape the /reunioes AI analysis uses
// (analise-schema.ts), so meeting content can be saved as a full ata.
const ataEntrySchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  data: z
    .string()
    .regex(dataRegex, "data deve ser yyyy-MM-dd")
    .optional()
    .or(z.literal("")),
  horario: z
    .string()
    .regex(horaRegex, "horario deve ser HH:mm")
    .optional()
    .or(z.literal("")),
  participantes: z.array(z.string().trim().min(1).max(200)).max(200),
  pontos_principais: z.array(z.string().trim().min(1).max(2000)).max(50),
  deliberacoes: z.array(z.string().trim().min(1).max(2000)).max(100),
  resumo: z.string().trim().min(1).max(10000),
});

const dipEntrySchema = z.object({
  localidade: z.string().trim().min(1).max(200),
  pais: z.string().trim().min(1).max(100),
  data: z
    .string()
    .regex(dataRegex, "data_dip deve ser yyyy-MM-dd")
    .optional()
    .or(z.literal("")),
  participantes: z
    .union([z.number().int().nonnegative(), z.literal("")])
    .optional(),
  observacoes: z.string().trim().max(3000).optional().or(z.literal("")),
});

const atualizacaoEntrySchema = z.object({
  titulo: z.string().trim().min(1).max(300),
  comentario: z.string().trim().min(1).max(3000),
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
  ata: ataEntrySchema.optional(),
  dips: z.array(dipEntrySchema).max(100).optional(),
  atualizacoes: z.array(atualizacaoEntrySchema).max(50).optional(),
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
    // True when the name matched the institutional roster (voluntarios) or
    // a profile — the review shows a badge and pre-selects the account.
    responsavelEncontrado: boolean;
  }> | null;
  ata: {
    titulo: string;
    data: string;
    horario: string;
    participantes: string[];
    pontos_principais: string[];
    deliberacoes: string[];
    resumo: string;
  } | null;
  dips: Array<{
    key: string;
    localidade: string;
    pais: string;
    data: string;
    participantes: string;
    observacoes: string;
  }> | null;
  atualizacoes: Array<{ titulo: string; comentario: string }> | null;
  // Account list for the responsável selects on the review screen —
  // RLS-open to any authenticated user (same query the demandas form runs).
  profiles: Array<{
    id: string;
    email: string;
    full_name: string | null;
  }>;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// MiMo-V2.5 (mimo-v2.5) no gateway Go tem contexto grande e ~150 mil
// requisições/mês inclusas na assinatura — o teto aqui só protege o tempo
// de resposta, não o custo.
const MAX_TEXT_CHARS = 120000;
const EMPTY_INPUT = "Cole um texto ou envie um arquivo antes de analisar.";

function erroState(message: string): AnalisarState {
  return {
    ok: false,
    message,
    tipo: null,
    titulo: null,
    resumo: null,
    financeiro: null,
    eventos: null,
    demandas: null,
    ata: null,
    dips: null,
    atualizacoes: null,
    profiles: [],
  };
}

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
  "demandas": [{"titulo": "tarefa", "responsavel_texto": "nome da pessoa no texto", "prazo_texto": "prazo como mencionado", "prazo_sugerido": "data concreta AAAA-MM-DD"}],
  "ata": {"titulo": "título da ata", "data": "AAAA-MM-DD ("" se não mencionada)", "horario": "HH:mm ("" se não mencionado)", "participantes": ["nomes"], "pontos_principais": ["pontos"], "deliberacoes": ["deliberações"], "resumo": "resumo da reunião"},
  "dips": [{"localidade": "cidade/região", "pais": "país", "data": "AAAA-MM-DD ("" se não mencionada)", "participantes": 123 (número, "" quando não mencionado), "observacoes": "detalhes"}],
  "atualizacoes": [{"titulo": "título da demanda JÁ EXISTENTE mencionada", "comentario": "o que mudou"}]
}
Inclua SOMENTE os campos relevantes ao tipo detectado (ex: se for financeiro, inclua apenas "financeiro" e omita "eventos" e "demandas").
Quando o conteúdo for uma transcrição ou ata de reunião, inclua "ata" completo, "demandas" (deliberações NOVAS com responsável e prazo claros), "dips" (menções à Dinâmica DIP, um registro por menção) e "atualizacoes" (menções a demandas que já existiam, ex.: "atualizar demanda X"). Se uma seção não tiver itens, use o array vazio.
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
    return erroState("Sessão expirada. Faça login novamente.");
  }

  const arquivo = formData.get("arquivo");
  const textoPaste = formData.get("texto");

  let texto: string;

  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > MAX_FILE_BYTES) {
      return erroState("Arquivo grande demais (máx. 5MB).");
    }
    try {
      texto = await extrairTextoDoArquivo(arquivo);
    } catch (err) {
      return erroState(
        err instanceof Error ? err.message : "Não foi possível ler o arquivo."
      );
    }
  } else if (
    typeof textoPaste === "string" &&
    textoPaste.trim().length > 0
  ) {
    texto = textoPaste.trim();
  } else {
    return erroState(EMPTY_INPUT);
  }

  if (texto.length === 0) {
    return erroState(EMPTY_INPUT);
  }

  // Ordinary session-bound client only — same query shape nova/page.tsx
  // already runs, RLS-scoped to what this caller can see. The service-role
  // factory in src/lib/supabase/admin.ts is never imported here, per that
  // file's own import restriction. Profiles (linked accounts) AND the
  // institutional roster (public.voluntarios) are fetched: a volunteer is
  // matched by roster name first, then by account full_name/email.
  const [profilesResult, voluntariosResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, voluntario_id")
      .eq("ativo", true)
      .not("email", "ilike", "%example.invalid%"),
    supabase.from("voluntarios").select("id, nome"),
  ]);

  const profiles = (profilesResult.data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
  }));
  // A roster row whose volunteer has a linked account (profiles.voluntario_id)
  // resolves to a selectable profile id; roster-only volunteers (no account)
  // still match by name — the review shows the badge and the person becomes
  // assignable once their account links the roster row.
  const profileByVoluntarioId = new Map(
    (profilesResult.data ?? [])
      .map((p) => [p.voluntario_id, p.id] as const)
      .filter(([voluntarioId]) => voluntarioId !== null)
  );
  const roster = (voluntariosResult.data ?? []).map((v) => ({
    id: v.id,
    nome: v.nome,
    profileId: profileByVoluntarioId.get(v.id) ?? null,
  }));

  try {
    const raw = JSON.parse(await chamarIA(texto));
    const parsed = responseSchema.safeParse(raw);

    if (!parsed.success) {
      return erroState(
        "A IA retornou um formato inesperado. Tente novamente com um texto mais claro."
      );
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
        ? data.demandas.map((d) => {
            const match = matchResponsavelRoster(
              d.responsavel_texto ?? "",
              profiles,
              roster
            );
            return {
              key: crypto.randomUUID(),
              titulo: d.titulo,
              responsavelId: match.profileId,
              responsavelTexto: d.responsavel_texto ?? "",
              prazoTexto: d.prazo_texto ?? "",
              prazoSugerido: d.prazo_sugerido?.length
                ? d.prazo_sugerido
                : null,
              responsavelEncontrado:
                match.profileId !== null || match.rosterId !== null,
            };
          })
        : null,
      ata: data.ata
        ? {
            titulo: data.ata.titulo,
            data: data.ata.data || "",
            horario: data.ata.horario || "",
            participantes: data.ata.participantes,
            pontos_principais: data.ata.pontos_principais,
            deliberacoes: data.ata.deliberacoes,
            resumo: data.ata.resumo,
          }
        : null,
      dips: data.dips
        ? data.dips.map((dip) => ({
            key: crypto.randomUUID(),
            localidade: dip.localidade,
            pais: dip.pais,
            data: dip.data || "",
            participantes:
              typeof dip.participantes === "number"
                ? String(dip.participantes)
                : "",
            observacoes: dip.observacoes || "",
          }))
        : null,
      atualizacoes: data.atualizacoes ?? null,
      profiles,
    };
  } catch (err) {
    console.error("analisarComIA: erro", err);
    return erroState(
      "Algo deu errado ao processar com a IA. Verifique sua internet e tente novamente."
    );
  }
}

// ── Save actions ──

export type SaveState = { ok: boolean; message: string; ataId?: number | null };

const saveError: SaveState = {
  ok: false,
  message: "Não foi possível salvar. Tente novamente.",
};

export type SalvarTudoInput = {
  financeiro?: Array<{
    tipo: string;
    descricao: string;
    valor: number;
    data: string;
    categoria: string | null;
  }>;
  eventos?: Array<{
    titulo: string;
    data: string;
    local: string | null;
    descricao: string | null;
  }>;
  demandas?: Array<{
    titulo: string;
    responsavelId: string | null;
    prazoSugerido: string | null;
  }>;
  ata?: {
    titulo: string;
    data: string;
    horario: string;
    participantes: string;
    pontos_principais: string;
    deliberacoes: string;
    resumo: string;
  };
  dips?: Array<{
    localidade: string;
    pais: string;
    data: string | null;
    participantes: number | null;
    observacoes: string;
  }>;
  atualizacoes?: Array<{ titulo: string; comentario: string }>;
};

// demandas.prazo is NOT NULL (0003_demandas.sql) — the review always
// pre-fills a date, and this fallback keeps a stray null from failing the
// insert silently.
function prazoFallback(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

const salvarAtaSchema = z.object({
  titulo: z.string().trim().min(1, "Dê um título à ata.").max(200),
  data: z.string().regex(dataRegex, "Escolha uma data válida."),
  horario: z
    .string()
    .regex(horaRegex, "Horário inválido.")
    .optional()
    .or(z.literal("")),
  participantes: z.string().trim().max(20000).optional().or(z.literal("")),
  pontos_principais: z.string().trim().max(20000).optional().or(z.literal("")),
  deliberacoes: z.string().trim().max(30000).optional().or(z.literal("")),
  resumo: z.string().trim().max(10000).optional().or(z.literal("")),
});

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

const salvarAtualizacoesSchema = z
  .array(
    z.object({
      titulo: z.string().trim().min(1).max(300),
      comentario: z.string().trim().min(1).max(3000),
    })
  )
  .max(50);

async function salvarAta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ata: SalvarTudoInput["ata"]
): Promise<{ ataId: number | null; erro: string | null }> {
  if (!ata) return { ataId: null, erro: null };

  const parsed = salvarAtaSchema.safeParse(ata);
  if (!parsed.success) {
    return { ataId: null, erro: "ata (dados inválidos)" };
  }

  const { data: novaAta, error } = await supabase
    .from("reunioes")
    .insert({
      titulo: parsed.data.titulo,
      data_reuniao: parsed.data.data,
      horario: parsed.data.horario || null,
      resumo: parsed.data.resumo || null,
      participantes: parsed.data.participantes || null,
      pontos_principais: parsed.data.pontos_principais || null,
      deliberacoes: parsed.data.deliberacoes || null,
    })
    .select("id")
    .single();

  if (error || !novaAta) {
    console.error("salvarTudoDaAnalise: reunioes insert failed", error);
    return { ataId: null, erro: "ata" };
  }

  return { ataId: novaAta.id, erro: null };
}

async function salvarDips(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ataId: number,
  dips: SalvarTudoInput["dips"]
): Promise<{ salvos: number; erros: string[] }> {
  if (!dips || dips.length === 0 || ataId === null) {
    return { salvos: 0, erros: [] };
  }

  const parsed = salvarDipsSchema.safeParse(dips);
  if (!parsed.success) {
    return { salvos: 0, erros: ["dips (dados inválidos)"] };
  }

  const rows = parsed.data.map((dip) => ({
    ata_id: ataId,
    localidade: dip.localidade,
    pais: dip.pais,
    data_dip: dip.data,
    participantes: dip.participantes,
    observacoes: dip.observacoes || null,
  }));

  const { error } = await supabase.from("dips").insert(rows);
  if (error) {
    console.error("salvarTudoDaAnalise: dips insert failed", error);
    return { salvos: 0, erros: ["dips"] };
  }

  return { salvos: rows.length, erros: [] };
}

// Updates land as comments on the matching EXISTING demanda (same rule as
// the /reunioes AI flow): title ilike match, preferring in-progress demandas
// over concluded ones; unmatched mentions are skipped, never attached to a
// wrong demand.
async function salvarAtualizacoes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  atualizacoes: SalvarTudoInput["atualizacoes"],
  tituloReferencia: string
): Promise<{ salvos: number; erros: string[] }> {
  if (!atualizacoes || atualizacoes.length === 0) {
    return { salvos: 0, erros: [] };
  }

  const parsed = salvarAtualizacoesSchema.safeParse(atualizacoes);
  if (!parsed.success) {
    return { salvos: 0, erros: ["atualizações (dados inválidos)"] };
  }

  let salvos = 0;
  const erros: string[] = [];

  for (const atualizacao of parsed.data) {
    const { data: candidatas } = await supabase
      .from("demandas")
      .select("id, status")
      .ilike("titulo", `%${atualizacao.titulo}%`)
      .order("status", { ascending: false })
      .limit(10);

    const alvo =
      candidatas?.find((d) => d.status !== "concluida") ?? candidatas?.[0] ?? null;
    if (!alvo) {
      erros.push(atualizacao.titulo);
      continue;
    }

    const { error: comentarioError } = await supabase
      .from("demanda_comentarios")
      .insert({
        demanda_id: alvo.id,
        conteudo: `Atualização da reunião "${tituloReferencia}": ${atualizacao.comentario}`,
      });

    if (comentarioError) {
      console.error("salvarTudoDaAnalise: comentario insert failed", comentarioError);
      erros.push(atualizacao.titulo);
      continue;
    }

    salvos++;
  }

  return { salvos, erros };
}

async function salvarFinanceiro(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entries: SalvarTudoInput["financeiro"]
): Promise<{ salvos: number; erros: string[] }> {
  if (!entries || entries.length === 0) return { salvos: 0, erros: [] };

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
    console.error("salvarTudoDaAnalise: financeiro failed", error);
    return { salvos: 0, erros: [`financeiro (${error.message})`] };
  }

  return { salvos: entries.length, erros: [] };
}

async function salvarEventos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  events: SalvarTudoInput["eventos"]
): Promise<{ salvos: number; erros: string[] }> {
  if (!events || events.length === 0) return { salvos: 0, erros: [] };

  const { error } = await supabase.from("eventos").insert(
    events.map((e) => ({
      titulo: e.titulo,
      data_evento: e.data,
      local: e.local ?? null,
      descricao: e.descricao ?? null,
    }))
  );

  if (error) {
    console.error("salvarTudoDaAnalise: eventos failed", error);
    return { salvos: 0, erros: [`eventos (${error.message})`] };
  }

  return { salvos: events.length, erros: [] };
}

async function salvarDemandas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  demands: SalvarTudoInput["demandas"]
): Promise<{ salvos: number; erros: string[] }> {
  if (!demands || demands.length === 0) return { salvos: 0, erros: [] };

  let salvos = 0;
  const erros: string[] = [];

  for (const d of demands) {
    const { data: demanda, error: demandaError } = await supabase
      .from("demandas")
      .insert({
        titulo: d.titulo,
        // demandas.prazo is NOT NULL — fall back to a week from today when
        // the AI didn't surface a deadline.
        prazo: d.prazoSugerido ?? prazoFallback(),
        status: "pendente",
      })
      .select("id")
      .single();

    if (demandaError || !demanda) {
      console.error("salvarTudoDaAnalise: demandas insert failed", demandaError);
      erros.push(d.titulo);
      continue;
    }

    if (d.responsavelId) {
      const { error: linkError } = await supabase
        .from("demanda_responsaveis")
        .insert({ demanda_id: demanda.id, profile_id: d.responsavelId });

      if (linkError) {
        console.error(
          "salvarTudoDaAnalise: demandas responsavel link failed",
          linkError
        );
      }
    }

    salvos++;
  }

  return { salvos, erros };
}

// One-click save for everything the AI extracted (ata, events, demandas,
// DIPs, financial entries and update comments — whatever exists) — the
// single "Salvar tudo" button at the bottom of the review screen.
export async function salvarTudoDaAnalise(
  input: SalvarTudoInput
): Promise<SaveState & { ataId: number | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada.", ataId: null };

  // The ata must be inserted FIRST — DIPs and update comments reference its
  // id. Everything else is independent and runs in parallel.
  const ata = await salvarAta(supabase, input.ata);

  const [financeiro, eventos, demandas, dips, atualizacoes] =
    await Promise.all([
      salvarFinanceiro(supabase, input.financeiro),
      salvarEventos(supabase, input.eventos),
      salvarDemandas(supabase, input.demandas),
      ata.ataId === null
        ? Promise.resolve({ salvos: 0, erros: [] as string[] })
        : salvarDips(supabase, ata.ataId, input.dips),
      ata.ataId === null
        ? Promise.resolve({ salvos: 0, erros: [] as string[] })
        : salvarAtualizacoes(
            supabase,
            input.atualizacoes,
            input.ata
              ? `${input.ata.titulo} (${input.ata.data})`
              : ""
          ),
    ]);

  const partes: string[] = [];
  if (ata.ataId !== null && !ata.erro) {
    partes.push("ata");
  }
  if (financeiro.salvos > 0) {
    partes.push(
      `${financeiro.salvos} ${financeiro.salvos === 1 ? "lançamento" : "lançamentos"} financeiros`
    );
  }
  if (eventos.salvos > 0) {
    partes.push(`${eventos.salvos} ${eventos.salvos === 1 ? "evento" : "eventos"}`);
  }
  if (demandas.salvos > 0) {
    partes.push(`${demandas.salvos} ${demandas.salvos === 1 ? "demanda" : "demandas"}`);
  }
  if (dips.salvos > 0) {
    partes.push(`${dips.salvos} ${dips.salvos === 1 ? "registro DIP" : "registros DIP"}`);
  }
  if (atualizacoes.salvos > 0) {
    partes.push(
      `${atualizacoes.salvos} ${atualizacoes.salvos === 1 ? "atualização" : "atualizações"}`
    );
  }

  const erros = [
    ...financeiro.erros,
    ...eventos.erros,
    ...demandas.erros,
    ...(ata.erro ? [ata.erro] : []),
    ...dips.erros,
    ...atualizacoes.erros,
  ];

  revalidatePath("/financeiro");
  revalidatePath("/eventos");
  revalidatePath("/reunioes");
  revalidatePath("/dips");
  revalidatePath("/");
  revalidatePath("/analisar");

  const totalSalvo =
    financeiro.salvos +
    eventos.salvos +
    demandas.salvos +
    (ata.ataId !== null && !ata.erro ? 1 : 0) +
    dips.salvos +
    atualizacoes.salvos;

  if (totalSalvo === 0 && erros.length > 0) {
    return {
      ok: false,
      message: `Não foi possível salvar: ${erros.join(", ")}.`,
      ataId: ata.erro ? null : ata.ataId,
    };
  }

  const base =
    totalSalvo === 0
      ? "Nada para salvar."
      : `Salvo: ${partes.join(" e ")}.`;

  return {
    ok: true,
    message: erros.length > 0 ? `${base} Falhas: ${erros.join(", ")}.` : base,
    ataId: ata.erro ? null : ata.ataId,
  };
}

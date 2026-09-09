"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chatCompletion } from "@/lib/ai/ai-client";
import { SYSTEM_PROMPT_V2, buildUserPrompt } from "@/lib/ai/prompt-v2";
import { preprocessarTranscricao, filtrarResultado } from "@/lib/ai/pos-filtro";
import { matchResponsavelRoster } from "@/lib/ai/match-responsavel";
import { requireAnaliseComIA } from "@/lib/role-gates";
import { resolverDestinosVoluntario } from "@/lib/destinos-voluntario";
import { parseXlsx } from "@/lib/financeiro/parse-file";
import { sanitizeSearch } from "@/lib/utils";
import { applyGlossary } from "@/lib/glossary";
import { listarTermosGlossario } from "@/lib/glossary-db";
const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

// V2 schemas — aceitam evidencia/timestamp aditivos e nomes legados
const eventoEntrySchema = z.object({
  titulo: z.string().optional(),
  nome: z.string().optional(),
  data: z.string().optional().or(z.literal("")),
  local: z.string().nullable().optional(),
  descricao: z.string().optional().nullable(),
  evidencia: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough();

const demandaEntrySchema = z.object({
  titulo: z.string(),
  responsavel: z.string().nullable().optional(),
  responsavel_texto: z.string().optional(),
  prazo: z.string().nullable().optional(),
  prazo_texto: z.string().optional(),
  prazo_sugerido: z.string().optional(),
  descricao: z.string().optional().nullable(),
  evidencia: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough();

const ataEntrySchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  data: z.string().regex(dataRegex, "data deve ser yyyy-MM-dd").optional().or(z.literal("")),
  horario: z.string().regex(horaRegex, "horario deve ser HH:mm").optional().or(z.literal("")).nullable(),
  participantes: z.array(z.string().trim().min(1).max(200)).max(200),
  pontos_principais: z.array(z.union([z.string().trim().min(1).max(2000), z.object({ titulo: z.string() }).passthrough()])).max(50),
  deliberacoes: z.array(z.union([z.string().trim().min(1).max(2000), z.object({ titulo: z.string() }).passthrough()])).max(100),
  resumo: z.string().trim().min(1).max(10000),
}).passthrough();

const dipEntrySchema = z.object({
  localidade: z.string().trim().min(1).max(200),
  pais: z.string().trim().min(1).max(100).optional(),
  data: z.string().regex(dataRegex, "data_dip deve ser yyyy-MM-dd").optional().or(z.literal("")),
  participantes: z.union([z.number().int().nonnegative(), z.literal("")]).optional().nullable(),
  epicons: z.number().int().nonnegative().nullable().optional(),
  voluntarios: z.number().int().nonnegative().nullable().optional(),
  pedidos_paracirurgia: z.number().int().nonnegative().nullable().optional(),
  campo: z.union([z.number().int().nonnegative(), z.string(), z.null()]).optional(),
  observacoes: z.string().trim().max(3000).optional().or(z.literal("")),
  evidencia: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough();

const atualizacaoEntrySchema = z.object({
  titulo: z.string().trim().min(1).max(300),
  comentario: z.string().trim().min(1).max(3000).optional(),
  descricao: z.string().trim().max(3000).optional(),
  responsavel: z.string().nullable().optional(),
  evidencia: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough();

const pautaEntrySchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  contexto: z.string().trim().max(3000).optional().or(z.literal("")).nullable(),
  motivo: z.string().trim().max(3000).optional().nullable(),
  evidencia: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough();

const incertoEntrySchema = z.object({
  titulo: z.string().trim().min(1).max(300),
  motivo_duvida: z.string().trim().max(1000).optional().nullable(),
  motivo: z.string().trim().max(1000).optional().nullable(),
  responsavel_sugerido: z.string().nullable().optional(),
  responsavel: z.string().nullable().optional(),
  prazo_sugerido: z.string().nullable().optional(),
  prazo: z.string().nullable().optional(),
  evidencia: z.string().optional(),
  evidencias: z.array(z.string()).optional(),
  timestamp: z.string().optional(),
}).passthrough();

const glossarioSugeridoEntrySchema = z.object({
  termo: z.string().trim().min(1).max(100),
  significado: z.string().trim().min(1).max(200).optional().nullable(),
  definicao: z.string().trim().max(500).optional().nullable(),
  evidencia: z.string().optional(),
  timestamp: z.string().optional(),
}).passthrough();

const responseSchema = z.object({
  tipo: z.enum(["eventos", "transcricao_reuniao", "ata_reuniao", "outro", "reuniao_geral"]).or(z.string()),
  titulo: z.string(),
  resumo: z.string(),
  eventos: z.array(eventoEntrySchema).optional(),
  demandas: z.array(demandaEntrySchema).optional(),
  ata: ataEntrySchema.optional(),
  dips: z.array(dipEntrySchema).max(100).optional(),
  atualizacoes: z.array(atualizacaoEntrySchema).max(50).optional(),
  pautas: z.array(pautaEntrySchema).max(50).optional(),
  incertos: z.array(incertoEntrySchema).max(10).optional(),
  glossario_sugerido: z.array(glossarioSugeridoEntrySchema).max(20).optional(),
}).passthrough();

export type AnalisarState = {
  ok: boolean;
  message: string;
  tipo: string | null;
  titulo: string | null;
  resumo: string | null;
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
  pautas: Array<{ key: string; titulo: string; contexto: string }> | null;
  incertos: Array<{
    key: string;
    titulo: string;
    motivo: string;
    responsavelTexto: string;
    prazoTexto: string;
  }> | null;
  // Possible duplicates against existing records, keyed by the item's
  // client key (demandas/eventos/dips). The review screen asks the user
  // what to do with each one (pular / mesclar / criar mesmo assim).
  duplicados: {
    demandas: Record<string, { id: number; titulo: string }>;
    eventos: Record<string, { id: number; titulo: string }>;
    dips: Record<string, { id: number; localidade: string; data: string | null }>;
  };
  // Account list for the responsável selects on the review screen. The
  // ROSTER (public.voluntarios) is the source of truth: every registered
  // volunteer is assignable — "mesmo que não estejam cadastrados" (sem
  // conta ativada ainda). temConta marca quem já ativou o acesso.
  voluntarios: Array<{
    id: number;
    nome: string;
    temConta: boolean;
  }>;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Go gateway (modelo via ai_config, default muse-spark-1.3) — teto só protege o tempo de resposta, não o custo.
const MAX_TEXT_CHARS = 60000;
const EMPTY_INPUT = "Cole um texto ou envie um arquivo antes de analisar.";

function erroState(message: string): AnalisarState {
  return {
    ok: false,
    message,
    tipo: null,
    titulo: null,
    resumo: null,
    eventos: null,
    demandas: null,
    ata: null,
    dips: null,
    atualizacoes: null,
    pautas: null,
    incertos: null,
    duplicados: { demandas: {}, eventos: {}, dips: {} },
    voluntarios: [],
  };
}

async function extrairTextoDoArquivo(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const { rows } = await parseXlsx(buffer);
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

function extrairDataReuniao(texto: string, fallback: string): string {
  const m = texto.match(/Meeting started:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3];
    const iso = `${yyyy}-${mm}-${dd}`;
    if (dataRegex.test(iso)) return iso;
    // formato americano M/D/YYYY vs D/M? tenta inverter se mês >12
    if (Number(mm) > 12) return `${yyyy}-${dd}-${mm}`;
    return iso;
  }
  const iso = texto.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return fallback;
}

async function chamarIA(
  transcricaoPreprocessada: string,
  dataReuniao: string,
  participantesConhecidos: string[],
  glossarioExistente: string[],
) {
  return chatCompletion(
    SYSTEM_PROMPT_V2,
    buildUserPrompt({
      dataReuniao,
      transcricao: transcricaoPreprocessada.slice(0, MAX_TEXT_CHARS),
      participantesConhecidos,
      glossarioExistente,
    }),
    { jsonMode: true }
  );
}

export async function analisarComIA(
  prevState: AnalisarState,
  formData: FormData
): Promise<AnalisarState> {
  // Auditoria 0063 (M1): gate de role no servidor — coordenador_geral,
  // coordenador_area ou cargo com o módulo analisar.
  let gate;
  try {
    gate = await requireAnaliseComIA();
  } catch (err) {
    return erroState(
      err instanceof Error ? err.message : "Sem permissão para analisar com IA."
    );
  }
  const supabase = gate.supabase;

  // Outer guard: qualquer throw abaixo (supabase, preprocess, filtro,
  // mapeamento) vira erro inline em vez de estourar no global-error
  // boundary ("Ops, algo deu errado").
  try {
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

  // Pré-processamento V2: remove Highlights (duplicação Tactiq), colapsa
  // repetições e descarta ruído — corta ~35% tokens sem custo.
  let textoParaIA = preprocessarTranscricao(texto);
  const textoFonteParaFiltro = textoParaIA;
  let termosGlossario: Awaited<ReturnType<typeof listarTermosGlossario>> = [];
  try {
    termosGlossario = await listarTermosGlossario(supabase);
    if (termosGlossario.length > 0) textoParaIA = applyGlossary(textoParaIA, termosGlossario);
  } catch (err) {
    console.error("analisarComIA: glossary load failed", err);
  }
  const glossarioExistente = termosGlossario.map((t) => t.term);
  const textoIA = textoParaIA;

  // Ordinary session-bound client only — same query shape nova/page.tsx
  // already runs, RLS-scoped to what this caller can see. The service-role
  // factory in src/lib/supabase/admin.ts is never imported here, per that
  // file's own import restriction. Profiles (linked accounts) AND the
  // institutional roster (public.voluntarios) are fetched: a volunteer is
  // matched by roster name first, then by account full_name/email.
  const [profilesResult, voluntariosResult, demandasExistentes, eventosExistentes, dipsExistentes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, voluntario_id")
        .eq("ativo", true)
        .not("email", "ilike", "%example.invalid%"),
      supabase.from("voluntarios").select("id, nome"),
      supabase.from("demandas").select("id, titulo"),
      supabase.from("eventos").select("id, titulo, data_evento"),
      supabase.from("dips").select("id, localidade, pais, data_dip"),
    ]);

  const demandasExistentesRows = (demandasExistentes.data ?? []).map((d) => ({
    id: d.id,
    titulo: d.titulo,
    norm: normalizeTexto(d.titulo),
  }));
  const eventosExistentesRows = (eventosExistentes.data ?? []).map((e) => ({
    id: e.id,
    titulo: e.titulo,
    norm: normalizeTexto(e.titulo),
    data: e.data_evento,
  }));
  const dipsExistentesRows = (dipsExistentes.data ?? []).map((d) => ({
    id: d.id,
    localidade: d.localidade,
    pais: d.pais,
    normLocalidade: normalizeTexto(d.localidade),
    normPais: normalizeTexto(d.pais),
    data: d.data_dip,
  }));

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
  const comConta = new Set(
    (profilesResult.data ?? [])
      .map((p) => p.voluntario_id)
      .filter((id): id is number => typeof id === "number")
  );
  const roster = (voluntariosResult.data ?? []).map((v) => ({
    id: v.id,
    nome: v.nome,
    profileId: profileByVoluntarioId.get(v.id) ?? null,
  }));
  // Full roster for the review selects, with the linked-account flag.
  const voluntarios = (voluntariosResult.data ?? []).map((v) => ({
    id: v.id,
    nome: v.nome,
    temConta: comConta.has(v.id),
  }));

  try {
    const dataReuniao = extrairDataReuniao(textoIA, hojeBRTISO());
    const participantesConhecidos = voluntarios.map((v) => v.nome);
    const rawJson = JSON.parse(await chamarIA(textoIA, dataReuniao, participantesConhecidos, glossarioExistente));
    // Pós-filtro V2: evidência obrigatória, hedge->pauta, ranking e dedup (custo zero)
    const { resultado: filtrado } = filtrarResultado(rawJson as Record<string, unknown>, textoFonteParaFiltro);
    const parsed = responseSchema.safeParse(filtrado);

    if (!parsed.success) {
      console.error("analisarComIA: schema fail", parsed.error.flatten());
      return erroState(
        "A IA retornou um formato inesperado. Tente novamente com um texto mais claro."
      );
    }

    const data = parsed.data as typeof rawJson & {
      tipo: string;
      titulo: string;
      resumo: string;
      eventos?: Array<Record<string, unknown>>;
      demandas?: Array<Record<string, unknown>>;
      ata?: Record<string, unknown>;
      dips?: Array<Record<string, unknown>>;
      atualizacoes?: Array<Record<string, unknown>>;
      pautas?: Array<Record<string, unknown>>;
      incertos?: Array<Record<string, unknown>>;
    };

    // IA pode sugerir glossario_sugerido, mas NÃO gravamos automaticamente
    // como ativo — evita que a IA invente significados aleatórios (reclamação
    // do usuário). Sugestões ficam apenas no payload para futura tela de
    // revisão humana; o aprendizado real vem só de correção manual explícita
    // (alias_responsaveis + aprenderCorrecaoDicionario).

    // Possible duplicates are keyed by the SAME crypto.randomUUID() keys the
    // mapping below generates, so the review screen can look them up per item.
    const duplicados: AnalisarState["duplicados"] = {
      demandas: {},
      eventos: {},
      dips: {},
    };

    return {
      ok: true,
      message: "",
      tipo: data.tipo,
      titulo: data.titulo,
      resumo: data.resumo,
      eventos: data.eventos
        ? data.eventos.map((e: any) => {
            const titulo = String(e.titulo ?? e.nome ?? "").trim();
            const dataEv = String(e.data ?? "").trim();
            const local = e.local ?? null;
            const descricao = e.descricao ?? null;
            const key = crypto.randomUUID();
            const norm = normalizeTexto(titulo);
            const match = eventosExistentesRows.find(
              (existing) =>
                existing.data === dataEv &&
                (existing.norm === norm ||
                  (norm.length >= 6 &&
                    (existing.norm.includes(norm) || norm.includes(existing.norm))))
            );
            if (match) {
              duplicados.eventos[key] = { id: match.id, titulo: match.titulo };
            }
            return { key, titulo, data: dataEv, local: local ? String(local) : null, descricao: descricao ? String(descricao) : null };
          })
        : null,
      demandas: data.demandas
        ? await Promise.all(
            (data.demandas as any[]).map(async (d: any) => {
              const key = crypto.randomUUID();
              const texto = String(d.responsavel ?? d.responsavel_texto ?? "").trim();
              let match: { profileId: string | null; rosterId: number | null } = { profileId: null, rosterId: null };
              if (texto) {
                const { data: aliasVid } = await supabase.rpc("buscar_alias", { termo_busca: texto });
                if (typeof aliasVid === "number") {
                  const { data: linked } = await supabase.from("profiles").select("id").eq("voluntario_id", aliasVid).maybeSingle();
                  match = { profileId: linked?.id ?? null, rosterId: aliasVid };
                }
              }
              if (!match.profileId && !match.rosterId) match = matchResponsavelRoster(texto, profiles, roster);
              const norm = normalizeTexto(d.titulo);
              const dup = norm.length >= 4 ? demandasExistentesRows.find((existing) => existing.norm === norm || (norm.length >= 8 && existing.norm.includes(norm))) : undefined;
              if (dup) duplicados.demandas[key] = { id: dup.id, titulo: dup.titulo };
              const prazoTexto = String(d.prazo_texto ?? d.descricao ?? "").trim();
              const prazoSugeridoRaw = String(d.prazo ?? d.prazo_sugerido ?? "").trim();
              return {
                key,
                titulo: d.titulo,
                responsavelId: match.rosterId !== null ? String(match.rosterId) : null,
                responsavelTexto: texto,
                prazoTexto,
                prazoSugerido: prazoSugeridoRaw.length ? prazoSugeridoRaw : null,
                responsavelEncontrado: match.profileId !== null || match.rosterId !== null,
              };
            })
          )
        : null,
      ata: data.ata
        ? (() => {
            const a: any = data.ata;
            const normArr = (arr: unknown): string[] => {
              if (!Array.isArray(arr)) return [];
              return arr.map((it: unknown) => {
                if (typeof it === "string") return it;
                if (it && typeof it === "object" && "titulo" in (it as Record<string, unknown>)) return String((it as Record<string, unknown>).titulo);
                if (it && typeof it === "object" && "nome" in (it as Record<string, unknown>)) return String((it as Record<string, unknown>).nome);
                return String(it);
              }).filter((s: string) => s.trim().length > 0);
            };
            return {
              titulo: a.titulo,
              data: a.data || "",
              horario: a.horario || "",
              participantes: Array.isArray(a.participantes) ? a.participantes : [],
              pontos_principais: normArr(a.pontos_principais),
              deliberacoes: normArr(a.deliberacoes),
              resumo: a.resumo,
            };
          })()
        : null,
      dips: data.dips
        ? (data.dips as any[]).map((dip: any) => {
            const key = crypto.randomUUID();
            const localidade = String(dip.localidade ?? "").trim();
            const pais = String(dip.pais ?? dip.localidade?.includes?.("Portugal") ? "Portugal" : "Brasil").trim() || "Brasil";
            const dipData = String(dip.data ?? "").trim() || null;
            const normLocalidade = normalizeTexto(localidade);
            const normPais = normalizeTexto(pais);
            const match = dipsExistentesRows.find(
              (existing) => existing.normLocalidade === normLocalidade && existing.normPais === normPais && (existing.data === dipData || (existing.data === null && dipData === null))
            );
            if (match) duplicados.dips[key] = { id: match.id, localidade: match.localidade, data: match.data };
            const obsParts: string[] = [];
            if (dip.observacoes) obsParts.push(String(dip.observacoes));
            else if (dip.evidencia) obsParts.push(String(dip.evidencia).slice(0, 200));
            if (dip.campo != null && String(dip.campo).trim() !== "") obsParts.push(`campo ${dip.campo}`);
            if (dip.epicons != null) obsParts.push(`epicons ${dip.epicons}`);
            if (dip.voluntarios != null) obsParts.push(`voluntarios ${dip.voluntarios}`);
            if (dip.pedidos_paracirurgia != null) obsParts.push(`pedidos ${dip.pedidos_paracirurgia}`);
            return {
              key,
              localidade,
              pais,
              data: dip.data ? String(dip.data) : "",
              participantes: typeof dip.participantes === "number" ? String(dip.participantes) : String(dip.participantes ?? ""),
              observacoes: obsParts.join(" · ").slice(0, 3000),
            };
          })
        : null,
      atualizacoes: (data.atualizacoes as any[])
        ? (data.atualizacoes as any[]).map((a: any) => ({ titulo: String(a.titulo ?? ""), comentario: String(a.comentario ?? a.descricao ?? a.evidencia ?? "") }))
        : null,
      pautas: (data.pautas as any[])
        ? (data.pautas as any[]).map((p: any) => ({
            key: crypto.randomUUID(),
            titulo: String(p.titulo ?? ""),
            contexto: String(p.contexto ?? p.motivo ?? p.descricao ?? ""),
          }))
        : null,
      incertos: (data.incertos as any[])
        ? (data.incertos as any[]).map((it: any) => ({
            key: crypto.randomUUID(),
            titulo: String(it.titulo ?? ""),
            motivo: String(it.motivo_duvida ?? it.motivo ?? "confirmar"),
            responsavelTexto: String(it.responsavel_sugerido ?? it.responsavel ?? "").trim(),
            prazoTexto: String(it.prazo_sugerido ?? it.prazo ?? "").trim(),
          }))
        : null,
      duplicados,
      voluntarios,
    };
  } catch (err) {
    console.error("analisarComIA: erro", err);
    return erroState(
      "Algo deu errado ao processar com a IA. Verifique sua internet e tente novamente."
    );
  }
  } catch (err) {
    console.error("analisarComIA: outer erro", err);
    return erroState(
      "Algo deu errado ao analisar. Tente novamente — se persistir, recarregue a página."
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
  eventos?: Array<{
    titulo: string;
    data: string;
    local: string | null;
    descricao: string | null;
    // "criar" (default) creates a new event;
    // "pular" skips a possible duplicate;
    // "incrementar" atualiza o evento existente com as novas informações
    // (local/descrição/data) — sem perder o histórico, sem duplicar.
    acao?: "criar" | "pular" | "incrementar";
    eventoId?: number | null;
  }>;
  demandas?: Array<{
    titulo: string;
    responsavelId: string | null;
    prazoSugerido: string | null;
    // Original text from the AI — passed to save aliases when the user's
    // final selection differs from the automatic match.
    responsavelTexto?: string;
    // "criar" (default) creates a new demanda; "pular" skips a possible
    // duplicate; "comentar" attaches an update comment to the existing
    // demanda (demandaId); "incrementar" updates the demanda details and
    // attaches an update comment.
    acao?: "criar" | "pular" | "comentar" | "incrementar";
    demandaId?: number | null;
    comentario?: string | null;
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
    // "criar" (default) creates a new DIP record;
    // "pular" skips a possible duplicate;
    // "incrementar" atualiza o DIP existente (participantes/observações)
    // com as novas informações da transcrição.
    acao?: "criar" | "pular" | "incrementar";
    dipId?: number | null;
  }>;
  atualizacoes?: Array<{ titulo: string; comentario: string }>;
  pautas?: Array<{ titulo: string; contexto: string | null }>;
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

const salvarPautasSchema = z
  .array(
    z.object({
      titulo: z.string().trim().min(1).max(200),
      contexto: z.string().trim().max(3000).nullable(),
    })
  )
  .max(50);

async function salvarAta(
  supabase: SupabaseClient,
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

  // Auto-vínculo de participantes ao roster — mesma regra do fluxo
  // /reunioes (analise-actions.ts): cada nome em texto livre é casado com
  // voluntarios.nome; sem match confiável fica só no texto livre e o
  // criador vincula depois na tela da ata.
  const participantesTexto = (parsed.data.participantes ?? "")
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
          .map((match) => [
            match.rosterId,
            { ata_id: novaAta.id, voluntario_id: match.rosterId },
          ])
      ).values(),
    ];

    if (vinculos.length > 0) {
      const { error: vinculoError } = await supabase
        .from("ata_participantes")
        .insert(vinculos);
      if (vinculoError) {
        console.error(
          "salvarTudoDaAnalise: ata_participantes auto-link failed",
          vinculoError
        );
      }
    }
  }

  return { ataId: novaAta.id, erro: null };
}

async function salvarDips(
  supabase: SupabaseClient,
  ataId: number,
  dips: SalvarTudoInput["dips"]
): Promise<{ salvos: number; ignorados: number; atualizados: number; erros: string[] }> {
  if (!dips || dips.length === 0 || ataId === null) {
    return { salvos: 0, ignorados: 0, atualizados: 0, erros: [] };
  }

  const parsed = salvarDipsSchema.safeParse(dips);
  if (!parsed.success) {
    return { salvos: 0, ignorados: 0, atualizados: 0, erros: ["dips (dados inválidos)"] };
  }

  const ignorados = dips.filter((d) => d.acao === "pular").length;
  const aCriar = dips.filter((d) => d.acao !== "pular" && d.acao !== "incrementar");
  const aIncrementar = dips.filter((d) => d.acao === "incrementar" && d.dipId);

  let salvos = 0;
  let atualizados = 0;
  const erros: string[] = [];

  if (aCriar.length > 0) {
    const rows = aCriar.map((dip) => ({
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
      erros.push("dips");
    } else {
      salvos = rows.length;
    }
  }

  for (const dip of aIncrementar) {
    // Incrementa o DIP existente com as novas informações da transcrição:
    // mantém o vínculo com a ata anterior, mas atualiza participantes/
    // observações (e corrige localidade/país/data se editados na revisão).
    const { error } = await supabase
      .from("dips")
      .update({
        localidade: dip.localidade,
        pais: dip.pais,
        data_dip: dip.data,
        participantes: dip.participantes,
        observacoes: dip.observacoes || null,
      })
      .eq("id", dip.dipId!);
    if (error) {
      console.error("salvarTudoDaAnalise: dips increment update failed", error);
      erros.push(`${dip.localidade} (${dip.pais})`);
    } else {
      atualizados++;
    }
  }

  return { salvos, ignorados, atualizados, erros };
}

// Updates land as comments on the matching EXISTING demanda (same rule as
// the /reunioes AI flow): title ilike match, preferring in-progress demandas
// over concluded ones; unmatched mentions are skipped, never attached to a
// wrong demand.
async function salvarAtualizacoes(
  supabase: SupabaseClient,
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
      .ilike("titulo", `%${sanitizeSearch(atualizacao.titulo)}%`)
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

async function salvarPautas(
  supabase: SupabaseClient,
  pautas: SalvarTudoInput["pautas"]
): Promise<{ salvos: number; erros: string[] }> {
  if (!pautas || pautas.length === 0) return { salvos: 0, erros: [] };

  const parsed = salvarPautasSchema.safeParse(pautas);
  if (!parsed.success) {
    return { salvos: 0, erros: ["pautas (dados inválidos)"] };
  }

  const rows = parsed.data
    .filter((p) => p.titulo.trim().length > 0)
    .map((p) => ({
      titulo: p.titulo,
      contexto: p.contexto || null,
      origem: "ata",
      status: "pendente",
    }));

  if (rows.length === 0) return { salvos: 0, erros: [] };

  const { error } = await supabase.from("pautas").insert(rows);
  if (error) {
    console.error("salvarTudoDaAnalise: pautas insert failed", error);
    return { salvos: 0, erros: ["pautas"] };
  }

  return { salvos: rows.length, erros: [] };
}

async function salvarEventos(
  supabase: SupabaseClient,
  events: SalvarTudoInput["eventos"]
): Promise<{ salvos: number; ignorados: number; atualizados: number; erros: string[] }> {
  if (!events || events.length === 0) return { salvos: 0, ignorados: 0, atualizados: 0, erros: [] };

  const ignorados = events.filter((e) => e.acao === "pular").length;
  const aCriar = events.filter((e) => e.acao !== "pular" && e.acao !== "incrementar");
  const aIncrementar = events.filter((e) => e.acao === "incrementar" && e.eventoId);

  let salvos = 0;
  let atualizados = 0;
  const erros: string[] = [];

  if (aCriar.length > 0) {
    const { error } = await supabase.from("eventos").insert(
      aCriar.map((e) => ({
        titulo: e.titulo,
        data_evento: e.data,
        local: e.local ?? null,
        descricao: e.descricao ?? null,
      }))
    );
    if (error) {
      console.error("salvarTudoDaAnalise: eventos failed", error);
      erros.push(`eventos (${error.message})`);
    } else {
      salvos = aCriar.length;
    }
  }

  for (const e of aIncrementar) {
    // Incrementa o evento existente: atualiza local/descrição/data e
    // título com as novas informações da transcrição. O evento mantém
    // seu id e vínculos com demandas; nada se perde.
    const { error } = await supabase
      .from("eventos")
      .update({
        titulo: e.titulo,
        data_evento: e.data,
        local: e.local ?? null,
        descricao: e.descricao ?? null,
      })
      .eq("id", e.eventoId!);
    if (error) {
      console.error("salvarTudoDaAnalise: evento increment update failed", error);
      erros.push(`${e.titulo} (${e.data})`);
    } else {
      atualizados++;
    }
  }

  return { salvos, ignorados, atualizados, erros };
}

async function salvarDemandas(
  supabase: SupabaseClient,
  demands: SalvarTudoInput["demandas"]
): Promise<{ salvos: number; ignorados: number; comentados: number; erros: string[] }> {
  if (!demands || demands.length === 0) {
    return { salvos: 0, ignorados: 0, comentados: 0, erros: [] };
  }

  let salvos = 0;
  let ignorados = 0;
  let comentados = 0;
  const erros: string[] = [];

  for (const d of demands) {
    // "pular": user confirmed this is a duplicate — nothing happens.
    if (d.acao === "pular") {
      ignorados++;
      continue;
    }

    // "comentar": user said this is the SAME task already tracked — attach
    // an update comment to the existing demanda instead of a new row.
    if (d.acao === "comentar" && d.demandaId) {
      const { error: comentarioError } = await supabase
        .from("demanda_comentarios")
        .insert({
          demanda_id: d.demandaId,
          conteudo:
            d.comentario ??
            `Mencionada novamente em análise (${d.titulo}).`,
        });

      if (comentarioError) {
        console.error(
          "salvarTudoDaAnalise: demanda merge comment failed",
          comentarioError
        );
        erros.push(d.titulo);
        continue;
      }
      comentados++;
      continue;
    }

    // "incrementar": update existing demanda details (prazo, responsavel)
    // and attach an update comment.
    if (d.acao === "incrementar" && d.demandaId) {
      // Update demanda prazo if provided
      if (d.prazoSugerido) {
        const { error: updateError } = await supabase
          .from("demandas")
          .update({ prazo: d.prazoSugerido })
          .eq("id", d.demandaId);

        if (updateError) {
          console.error(
            "salvarTudoDaAnalise: demanda increment update failed",
            updateError
          );
          erros.push(d.titulo);
          continue;
        }
      }

      // Link new responsavel if provided
      if (d.responsavelId) {
        const destinos = await resolverDestinosVoluntario(
          supabase,
          [Number(d.responsavelId)]
        );
        const destino = destinos[0];

        if (destino) {
          const { error: linkError } = await supabase
            .from("demanda_responsaveis")
            .insert({ demanda_id: d.demandaId, ...destino });

          if (linkError) {
            console.error(
              "salvarTudoDaAnalise: demanda increment responsavel link failed",
              linkError
            );
          }
        }

        // Alias + dicionário learning também no caminho incrementar
        if (d.responsavelTexto) {
          const texto = normalizeTexto(d.responsavelTexto);
          if (texto) {
            const vid = Number(d.responsavelId);
            await supabase.from("alias_responsaveis").insert({ termo: texto, voluntario_id: vid });
            try {
              const { data: vol } = await supabase.from("voluntarios").select("nome").eq("id", vid).maybeSingle();
              const canonico = vol?.nome?.trim();
              if (canonico && normalizeTexto(canonico) !== texto) {
                await supabase.rpc("registrar_aprendizado_glossario", {
                  p_term: d.responsavelTexto.trim(),
                  p_replacement: canonico,
                  p_description: `Aprendido automaticamente: alias de responsável corrigido na análise (incremento ${d.titulo.slice(0, 60)})`,
                });
              }
            } catch {}
          }
        }
      }

      // Attach update comment
      const { error: comentarioError } = await supabase
        .from("demanda_comentarios")
        .insert({
          demanda_id: d.demandaId,
          conteudo:
            d.comentario ??
            `Atualizada com novos detalhes da análise (${d.titulo}).`,
        });

      if (comentarioError) {
        console.error(
          "salvarTudoDaAnalise: demanda increment comment failed",
          comentarioError
        );
        erros.push(d.titulo);
        continue;
      }
      comentados++;
      continue;
    }

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
      // The select submits a ROSTER volunteer id (voluntarios.id) — resolve
      // it to the effective destination (profile_id when the volunteer has
      // a linked account, voluntario_id otherwise), same rule as
      // createDemanda (migration 0020).
      const destinos = await resolverDestinosVoluntario(
        supabase,
        [Number(d.responsavelId)]
      );
      const destino = destinos[0];

      if (destino) {
        const { error: linkError } = await supabase
          .from("demanda_responsaveis")
          .insert({ demanda_id: demanda.id, ...destino });

        if (linkError) {
          console.error(
            "salvarTudoDaAnalise: demandas responsavel link failed",
            linkError
          );
        }
      }
    }

    // Alias + dicionário learning: quando a IA extraiu um nome com erro de
    // transcrição ("dar o van brum") e o operador corrigiu manualmente para
    // o voluntário correto ("Dalvan Brum"), salvamos o mapeamento para que
    // próximas análises já resolvam sozinhas — tanto o alias (pós-IA, para
    // o matcher de responsável) quanto o termo do dicionário (pré-IA, para
    // corrigir o texto antes da IA). Ex.: "DEEEP" → "DIP", "D e P" → "DIP".
    if (d.responsavelTexto && d.responsavelId) {
      const texto = normalizeTexto(d.responsavelTexto);
      if (texto) {
        const vid = Number(d.responsavelId);
        // 1) Alias responsável (lookup pós-IA)
        await supabase.from("alias_responsaveis").insert({
          termo: texto,
          voluntario_id: vid,
        });
        // 2) Termo do dicionário (correção pré-IA) — busca o nome canônico
        // para usar como replacement; SECURITY DEFINER contorna a RLS de
        // glossary_terms para coordenadores de área.
        try {
          const { data: vol } = await supabase
            .from("voluntarios")
            .select("nome")
            .eq("id", vid)
            .maybeSingle();
          const canonico = vol?.nome?.trim();
          const jaIgual = canonico && normalizeTexto(canonico) === texto;
          if (canonico && !jaIgual) {
            await supabase.rpc("registrar_aprendizado_glossario", {
              p_term: d.responsavelTexto.trim(),
              p_replacement: canonico,
              p_description: `Aprendido automaticamente: alias de responsável corrigido na análise (${d.titulo.slice(0, 60)})`,
            });
          }
        } catch {
          // aprendizado é best-effort — nunca falha o salvamento da demanda
        }
      }
    }

    salvos++;
  }

  return { salvos, ignorados, comentados, erros };
}

// ── Helpers ──

function normalizeTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// One-click save for everything the AI extracted (ata, events, demandas,
// DIPs, financial entries and update comments — whatever exists) — the
// single "Salvar tudo" button at the bottom of the review screen.
export async function salvarTudoDaAnalise(
  input: SalvarTudoInput
): Promise<SaveState & { ataId: number | null }> {
  // Auditoria 0063 (M1): gate de role no servidor (a tela é client-only).
  let gate;
  try {
    gate = await requireAnaliseComIA();
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Sem permissão para salvar.",
      ataId: null,
    };
  }
  const supabase = gate.supabase;

  // The ata must be inserted FIRST — DIPs and update comments reference its
  // id. Everything else is independent and runs in parallel.
  const ata = await salvarAta(supabase, input.ata);

  const [eventos, demandas, dips, atualizacoes, pautas] =
    await Promise.all([
      salvarEventos(supabase, input.eventos),
      salvarDemandas(supabase, input.demandas),
      ata.ataId === null
        ? Promise.resolve({ salvos: 0, ignorados: 0, atualizados: 0, erros: [] as string[] })
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
      salvarPautas(supabase, input.pautas),
    ]);

  const partes: string[] = [];
  if (ata.ataId !== null && !ata.erro) {
    partes.push("ata");
  }
  if (eventos.salvos > 0) {
    partes.push(`${eventos.salvos} ${eventos.salvos === 1 ? "evento" : "eventos"}`);
  }
  if (eventos.atualizados > 0) {
    partes.push(
      `${eventos.atualizados} ${eventos.atualizados === 1 ? "evento atualizado" : "eventos atualizados"}`
    );
  }
  if (demandas.salvos > 0) {
    partes.push(`${demandas.salvos} ${demandas.salvos === 1 ? "demanda" : "demandas"}`);
  }
  if (demandas.comentados > 0) {
    partes.push(
      `${demandas.comentados} ${demandas.comentados === 1 ? "comentário" : "comentários"} em demandas existentes`
    );
  }
  if (dips.salvos > 0) {
    partes.push(`${dips.salvos} ${dips.salvos === 1 ? "registro DIP" : "registros DIP"}`);
  }
  if (dips.atualizados > 0) {
    partes.push(
      `${dips.atualizados} ${dips.atualizados === 1 ? "DIP atualizado" : "DIPs atualizados"}`
    );
  }
  if (atualizacoes.salvos > 0) {
    partes.push(
      `${atualizacoes.salvos} ${atualizacoes.salvos === 1 ? "atualização" : "atualizações"}`
    );
  }
  if (pautas.salvos > 0) {
    partes.push(`${pautas.salvos} ${pautas.salvos === 1 ? "pauta" : "pautas"}`);
  }

  const ignoradosTotal =
    eventos.ignorados + demandas.ignorados + dips.ignorados;
  if (ignoradosTotal > 0) {
    partes.push(
      `${ignoradosTotal} ${ignoradosTotal === 1 ? "duplicado ignorado" : "duplicados ignorados"}`
    );
  }

  const erros = [
    ...eventos.erros,
    ...demandas.erros,
    ...(ata.erro ? [ata.erro] : []),
    ...dips.erros,
    ...atualizacoes.erros,
    ...pautas.erros,
  ];

  revalidatePath("/eventos");
  revalidatePath("/reunioes");
  revalidatePath("/dips");
  revalidatePath("/");
  revalidatePath("/analisar");

  const totalSalvo =
    eventos.salvos +
    eventos.atualizados +
    demandas.salvos +
    demandas.comentados +
    (ata.ataId !== null && !ata.erro ? 1 : 0) +
    dips.salvos +
    dips.atualizados +
    atualizacoes.salvos +
    pautas.salvos;

  if (totalSalvo === 0 && erros.length > 0) {
    return {
      ok: false,
      message: `Não foi possível salvar: ${erros.join(", ")}.`,
      ataId: ata.erro ? null : ata.ataId,
    };
  }

  const base =
    totalSalvo === 0
      ? ignoradosTotal > 0
        ? `${ignoradosTotal} ${ignoradosTotal === 1 ? "duplicado ignorado" : "duplicados ignorados"}.`
        : "Nada para salvar."
      : `Salvo: ${partes.join(" e ")}.`;

  return {
    ok: true,
    message: erros.length > 0 ? `${base} Falhas: ${erros.join(", ")}.` : base,
    ataId: ata.erro ? null : ata.ataId,
  };
}

// Aprendizado manual de termo: quando o operador corrige um campo na
// revisão (ex: dip "DEEEP" → "DIP", evento "qualificacão" → "Qualificação"),
// chamamos esta action para registrar no dicionário. É o segundo pilar do
// "sempre aprenda" — o primeiro é o glossario_sugerido da IA, este é a
// correção humana explícita.
export async function aprenderCorrecaoDicionario(
  termo: string,
  significado: string
): Promise<{ ok: boolean }> {
  const t = termo?.trim();
  const s = significado?.trim();
  if (!t || !s || normalizeTexto(t) === normalizeTexto(s)) return { ok: false };
  if (t.length > 200 || s.length > 200) return { ok: false };
  let gate;
  try {
    gate = await requireAnaliseComIA();
  } catch {
    return { ok: false };
  }
  try {
    await gate.supabase.rpc("registrar_aprendizado_glossario", {
      p_term: t,
      p_replacement: s,
      p_description: "Aprendido automaticamente: correção manual na revisão da análise",
    });
  } catch {
    // best-effort
  }
  return { ok: true };
}

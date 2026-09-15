"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseCsv, parseXlsx } from "@/lib/financeiro/parse-file";
import { chatCompletion, wrapUserContent } from "@/lib/ai/ai-client";

export type ImportarEventosState = {
  ok: boolean;
  message: string;
};

const initialState: ImportarEventosState = { ok: false, message: "" };

export type AdicionarTarefasState = {
  ok: boolean;
  message: string;
};

const adicionarTarefasInitialState: AdicionarTarefasState = {
  ok: false,
  message: "",
};

export type EditarEventoState = {
  ok: boolean;
  message: string;
};

const editarEventoInitialState: EditarEventoState = { ok: false, message: "" };

const editarEventoSchema = z.object({
  id: z.preprocess(
    (value) => (value === "" || value == null ? undefined : Number(value)),
    z.number().int().positive("Evento inválido")
  ),
  titulo: z.string().trim().min(1, "Dê um título ao evento.").max(200),
  data_evento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data válida."),
  local: z.string().trim().max(200).optional().or(z.literal("")),
  descricao: z.string().trim().max(2000).optional().or(z.literal("")),
});

// Corrects an existing event's data (the pre-registration events have no
// edit screen). RLS (migration 0008) is the real boundary: only the
// creator or any coordenador_geral can update.
export async function editarEvento(
  prevState: EditarEventoState,
  formData: FormData
): Promise<EditarEventoState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...editarEventoInitialState, message: "Sessão expirada." };
  }

  const parsed = editarEventoSchema.safeParse({
    id: formData.get("id"),
    titulo: formData.get("titulo"),
    data_evento: formData.get("data_evento"),
    local: formData.get("local"),
    descricao: formData.get("descricao"),
  });

  if (!parsed.success) {
    return { ...editarEventoInitialState, message: "Verifique os campos do evento." };
  }

  const { error } = await supabase
    .from("eventos")
    .update({
      titulo: parsed.data.titulo,
      data_evento: parsed.data.data_evento,
      local: parsed.data.local || null,
      descricao: parsed.data.descricao || null,
    })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("editarEvento: update failed", error);
    return {
      ...editarEventoInitialState,
      message: "Não foi possível salvar o evento. Tente novamente.",
    };
  }

  revalidatePath(`/eventos/${parsed.data.id}`);
  revalidatePath("/eventos");
  revalidatePath("/");
  return { ok: true, message: "Evento atualizado com sucesso." };
}

// CSV row: parsed by header name (not position) — supports any column
// order and extra columns. Required headers: Data, Título. Optional: Local,
// Descrição. Dates in dd/MM/yyyy or yyyy-MM-dd.
const eventoRowSchema = z.object({
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use dd/mm/aaaa ou aaaa-mm-dd)"),
  titulo: z.string().trim().min(1, "Título vazio").max(200),
  local: z.string().trim().max(200).optional(),
  descricao: z.string().trim().max(2000).optional(),
});

// Normalize header name: lowercase, strip accents, trim.
function normHeader(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Find the column index for a header by normalized name. Returns -1 if not
// found. Handles BOM-prefixed headers and common spelling variations.
function findCol(headers: string[], ...targets: string[]): number {
  const normalized = headers.map(normHeader);
  for (const target of targets) {
    const idx = normalized.indexOf(normHeader(target));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseData(raw: string): string | null {
  const trimmed = raw.trim();
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (
      date.getUTCFullYear() === Number(y) &&
      date.getUTCMonth() === Number(m) - 1 &&
      date.getUTCDate() === Number(d)
    ) {
      return date.toISOString().slice(0, 10);
    }
    return null;
  }
  const yyyymmdd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    if (
      date.getUTCFullYear() === Number(y) &&
      date.getUTCMonth() === Number(m) - 1 &&
      date.getUTCDate() === Number(d)
    ) {
      return date.toISOString().slice(0, 10);
    }
  }
  return null;
}

const MAX_FILE_BYTES = 1024 * 1024; // 1MB

export async function importarEventos(
  prevState: ImportarEventosState,
  formData: FormData
): Promise<ImportarEventosState> {
  try {
    return await importarEventosInner(prevState, formData);
  } catch (err) {
    console.error("importarEventos: unhandled error", err);
    return {
      ...initialState,
      message:
        "Ocorreu um erro inesperado ao importar. Verifique se o arquivo é um CSV válido (texto) e tente novamente.",
    };
  }
}

async function importarEventosInner(
  prevState: ImportarEventosState,
  formData: FormData
): Promise<ImportarEventosState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...initialState, message: "Sessão expirada. Faça login novamente." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ...initialState, message: "Escolha um arquivo .csv ou .xlsx." };
  }
  if (arquivo.size > MAX_FILE_BYTES) {
    return { ...initialState, message: "O arquivo é grande demais (máx. 1MB)." };
  }
  const lowerName = arquivo.name.toLowerCase();
  const isXlsx = lowerName.endsWith(".xlsx");
  const isXls = lowerName.endsWith(".xls");
  const isCsv = lowerName.endsWith(".csv");
  if (!isXlsx && !isXls && !isCsv) {
    return { ...initialState, message: "Envie um arquivo no formato .csv ou .xlsx." };
  }
  if (isXls) {
    // read-excel-file suporta apenas .xlsx (auditoria 0063/M3).
    return {
      ...initialState,
      message:
        "O formato .xls não é suportado. Abra a planilha e salve como .xlsx (ou .csv) e tente novamente.",
    };
  }

  let allRows: unknown[][];
  try {
    if (isXlsx) {
      const buffer = await arquivo.arrayBuffer();
      allRows = (await parseXlsx(buffer)).rows;
    } else {
      let texto: string;
      try {
        texto = await arquivo.text();
      } catch {
        return { ...initialState, message: "Não foi possível ler o arquivo." };
      }

      // Detect binary files (XLSX saved as .csv) — CSV text should never
      // contain null bytes in the first 512 characters.
      const probe = texto.slice(0, 512);
      if (/\0/.test(probe)) {
        return {
          ...initialState,
          message:
            "Este arquivo parece ser XLSX (binário), não CSV. Envie como .xlsx ou salve como .csv no Excel/Google Sheets.",
        };
      }

      allRows = parseCsv(texto);
    }
  } catch {
    return {
      ...initialState,
      message:
        "Não foi possível interpretar o arquivo. Verifique se não há fórmulas corrompidas e tente novamente.",
    };
  }

  if (allRows.length < 2) {
    return { ...initialState, message: "O arquivo está vazio ou não tem dados." };
  }

  // Header-aware column mapping — find columns by name instead of position.
  const headers = allRows[0].map(String);
  const colData = findCol(headers, "Data", "Data do evento", "Date");
  const colTitulo = findCol(headers, "Título", "Titulo", "Title", "Nome");
  const colLocal = findCol(headers, "Local", "Endereço", "Endereco", "Lugar", "Address");
  const colDescricao = findCol(headers, "Descrição", "Descricao", "Description", "Sobre");

  if (colData === -1 || colTitulo === -1) {
    return {
      ...initialState,
      message:
        'Cabeçalho inválido. O CSV precisa ter pelo menos as colunas "Data" e "Título". Colunas encontradas: ' +
        headers.join(", "),
    };
  }

  const rows = allRows.slice(1); // skip header
  const eventos: Array<{
    data_evento: string;
    titulo: string;
    local: string | null;
    descricao: string | null;
  }> = [];

  for (const row of rows) {
    if (row.every((cell) => String(cell).trim() === "")) continue;
    const data = parseData(String(row[colData] ?? ""));
    const titulo = String(row[colTitulo] ?? "").trim();
    const local = colLocal !== -1 ? String(row[colLocal] ?? "").trim() : "";
    const descricao = colDescricao !== -1 ? String(row[colDescricao] ?? "").trim() : "";

    const parsed = eventoRowSchema.safeParse({
      data: data ?? "",
      titulo,
      local: local || undefined,
      descricao: descricao || undefined,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => i.message).join("; ");
      return {
        ...initialState,
        message: `Linha inválida: ${issues}`,
      };
    }
    eventos.push({
      data_evento: parsed.data.data,
      titulo: parsed.data.titulo,
      local: parsed.data.local ?? null,
      descricao: parsed.data.descricao ?? null,
    });
  }

  if (eventos.length === 0) {
    return { ...initialState, message: "Nenhum evento encontrado no arquivo." };
  }

  // Regra AGENTS.md (atualizar, não duplicar): filtra duplicados antes de
  // inserir — (a) dentro do próprio arquivo e (b) contra a base existente
  // (mesma data + título normalizado igual ou contido). Nada se perde: o
  // retorno informa quantos foram ignorados e quais.
  const chaveEvento = (data_evento: string, titulo: string) =>
    `${data_evento}|${normalizarTituloEvento(titulo)}`;

  const vistosNoArquivo = new Set<string>();
  const novos: typeof eventos = [];
  let duplicadosNoArquivo = 0;
  for (const ev of eventos) {
    const chave = chaveEvento(ev.data_evento, ev.titulo);
    if (vistosNoArquivo.has(chave)) {
      duplicadosNoArquivo++;
      continue;
    }
    vistosNoArquivo.add(chave);
    novos.push(ev);
  }

  const { data: existentes } = await supabase
    .from("eventos")
    .select("titulo, data_evento");
  const chavesExistentes = new Set(
    (existentes ?? []).map((e) =>
      chaveEvento(String(e.data_evento), String(e.titulo))
    )
  );
  // Match "contido" (título parecido): ex. "Foz 2026" vs "Evento Foz 2026".
  const normasExistentesPorData = new Map<string, string[]>();
  for (const e of existentes ?? []) {
    const data = String(e.data_evento);
    const lista = normasExistentesPorData.get(data) ?? [];
    lista.push(normalizarTituloEvento(String(e.titulo)));
    normasExistentesPorData.set(data, lista);
  }

  const finais: typeof eventos = [];
  const ignoradosBase: string[] = [];
  for (const ev of novos) {
    const chave = chaveEvento(ev.data_evento, ev.titulo);
    if (chavesExistentes.has(chave)) {
      ignoradosBase.push(`${ev.titulo} (${ev.data_evento})`);
      continue;
    }
    const norm = normalizarTituloEvento(ev.titulo);
    const candidatos = normasExistentesPorData.get(ev.data_evento) ?? [];
    const parecido = candidatos.some(
      (ex) =>
        norm.length >= 6 && (ex.includes(norm) || norm.includes(ex))
    );
    if (parecido) {
      ignoradosBase.push(`${ev.titulo} (${ev.data_evento})`);
      continue;
    }
    finais.push(ev);
  }

  if (finais.length === 0) {
    return {
      ...initialState,
      message:
        "Nenhum evento novo — todos já estavam cadastrados (duplicados ignorados).",
    };
  }

  // criado_por comes from the column default (session) — never from the
  // CSV, same anti-spoofing discipline as every other insert in this app.
  const { error } = await supabase.from("eventos").insert(finais);

  if (error) {
    console.error("importarEventos: insert failed", error);
    return {
      ...initialState,
      message: "Não foi possível salvar os eventos importados.",
    };
  }

  revalidatePath("/eventos");
  const partes = [`${finais.length} eventos importados com sucesso.`];
  const ignoradosTotal = duplicadosNoArquivo + ignoradosBase.length;
  if (ignoradosTotal > 0) {
    partes.push(
      `${ignoradosTotal} ${ignoradosTotal === 1 ? "duplicado ignorado" : "duplicados ignorados"} (já cadastrados ou repetidos no arquivo).`
    );
  }
  return { ok: true, message: partes.join(" ") };
}

function normalizarTituloEvento(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Materializes the event type's task template into real demandas linked to
// the event ("Adicionar tarefas do evento"). Created WITHOUT responsáveis —
// the join table allows a demanda with zero responsáveis (the reminder
// cron already treats that case), and assignment happens afterwards via the
// edit screen. prazo = event date + template offset (negative = days
// before), status pendente, criado_por = the clicking volunteer.
export type MesclarEventosState = {
  ok: boolean;
  message: string;
};

const mesclarEventosInitialState: MesclarEventosState = { ok: false, message: "" };

// Merge de eventos duplicados (migration 0046) — a análise automática de
// atas pode extrair o mesmo evento duas vezes; o coordenador escolhe qual
// fica (manter) e qual é absorvido (remover). Todas as referências do
// duplicado (demandas, contratos, turmas PROEP) são movidas para o
// definitivo e o duplicado é apagado.
const MESCLAR_MENSAGENS: Record<string, string> = {
  ok: "Eventos mesclados com sucesso. O duplicado foi removido.",
  evento_nao_encontrado: "Um dos eventos não foi encontrado.",
  mesmo_evento: "Escolha dois eventos diferentes.",
  sem_permissao: "Você não tem permissão para mesclar eventos.",
};

export async function mesclarEventos(
  manterId: number,
  removerId: number
): Promise<MesclarEventosState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...mesclarEventosInitialState, message: "Sessão expirada." };
  }

  if (!Number.isFinite(manterId) || !Number.isFinite(removerId)) {
    return { ...mesclarEventosInitialState, message: "Evento inválido." };
  }

  const { data, error } = await supabase.rpc("mesclar_eventos", {
    p_manter_id: manterId,
    p_remover_id: removerId,
  });

  if (error) {
    console.error("mesclarEventos: rpc failed", error);
    return {
      ...mesclarEventosInitialState,
      message: "Não foi possível mesclar agora. Tente novamente.",
    };
  }

  const resultado = typeof data === "string" ? data : "erro";
  if (resultado === "ok") {
    revalidatePath("/eventos");
    revalidatePath("/demandas");
    revalidatePath("/");
  }

  return {
    ok: resultado === "ok",
    message: MESCLAR_MENSAGENS[resultado] ?? "Não foi possível mesclar agora.",
  };
}

// Mesclagem múltipla — junta N duplicados num único definitivo, chamando
// o RPC 0046 uma vez por duplicado (cada chamada é atômica; o definitivo
// acumula descricao/local/tipo vazios e todas as referências). Retorna a
// contagem de absorvidos; se algum falhar no meio, informa quantos já
// foram mesclados para o coordenador decidir se continua.
export async function mesclarEventosEmMassa(
  manterId: number,
  removerIds: number[]
): Promise<MesclarEventosState & { mesclados?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...mesclarEventosInitialState, message: "Sessão expirada." };
  }

  if (!Number.isFinite(manterId) || manterId <= 0) {
    return { ...mesclarEventosInitialState, message: "Escolha o evento definitivo." };
  }

  const alvos = [...new Set(removerIds.filter((n) => Number.isInteger(n) && n > 0 && n !== manterId))].slice(0, 50);
  if (alvos.length === 0) {
    return { ...mesclarEventosInitialState, message: "Selecione ao menos um duplicado diferente do definitivo." };
  }

  let mesclados = 0;
  for (const removerId of alvos) {
    const { data, error } = await supabase.rpc("mesclar_eventos", {
      p_manter_id: manterId,
      p_remover_id: removerId,
    });
    if (error) {
      console.error("mesclarEventosEmMassa: rpc failed", { removerId, error });
      break;
    }
    if (data !== "ok") {
      console.error("mesclarEventosEmMassa: rpc returned", { removerId, data });
      const detalhe =
        typeof data === "string" && MESCLAR_MENSAGENS[data]
          ? ` (${MESCLAR_MENSAGENS[data]})`
          : "";
      if (mesclados === 0) {
        return {
          ...mesclarEventosInitialState,
          message: `Não foi possível mesclar agora${detalhe}.`,
        };
      }
      break;
    }
    mesclados += 1;
  }

  if (mesclados === 0) {
    return { ...mesclarEventosInitialState, message: "Não foi possível mesclar agora. Tente novamente." };
  }

  revalidatePath("/eventos");
  revalidatePath("/demandas");
  revalidatePath("/");
  return {
    ok: mesclados === alvos.length,
    mesclados,
    message:
      mesclados === alvos.length
        ? mesclados === 1
          ? "Eventos mesclados com sucesso. O duplicado foi removido."
          : `${mesclados} eventos mesclados no definitivo. Os duplicados foram removidos.`
        : `${mesclados} de ${alvos.length} mesclados — confira a lista e repita para o restante.`,
  };
}

export type MassaEventosState = {
  ok: boolean;
  message: string;
  afetados?: number;
};

const massaInitial: MassaEventosState = { ok: false, message: "" };

// Exclusão em massa — RLS (migration 0008) é a fronteira real: só o
// criador ou coordenador_geral consegue apagar cada linha. O delete com
// .in() apaga apenas as linhas permitidas; retornamos a contagem real.
export async function excluirEventosEmMassa(
  ids: number[]
): Promise<MassaEventosState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...massaInitial, message: "Sessão expirada." };
  }

  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
  if (limpos.length === 0) {
    return { ...massaInitial, message: "Selecione ao menos um evento." };
  }

  const { data: existentes, error: leituraError } = await supabase
    .from("eventos")
    .select("id")
    .in("id", limpos);

  if (leituraError) {
    console.error("excluirEventosEmMassa: read failed", leituraError);
    return { ...massaInitial, message: "Não foi possível excluir agora. Tente novamente." };
  }

  const visiveis = (existentes ?? []).map((e) => e.id);
  if (visiveis.length === 0) {
    return { ...massaInitial, message: "Você não tem permissão para excluir esses eventos." };
  }

  const { error: deleteError, count } = await supabase
    .from("eventos")
    .delete({ count: "exact" })
    .in("id", visiveis);

  if (deleteError) {
    console.error("excluirEventosEmMassa: delete failed", deleteError);
    return { ...massaInitial, message: "Não foi possível excluir agora. Tente novamente." };
  }

  revalidatePath("/eventos");
  revalidatePath("/");
  const apagados = count ?? visiveis.length;
  return {
    ok: true,
    afetados: apagados,
    message:
      apagados === 1
        ? "1 evento excluído."
        : `${apagados} eventos excluídos.`,
  };
}

const editarMassaSchema = z.object({
  local: z.string().trim().max(200).optional(),
  descricao: z.string().trim().max(2000).optional(),
  data_evento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data válida.")
    .optional(),
  tipo_evento_id: z.number().int().positive().nullable().optional(),
});

// Edição em massa — aplica os mesmos valores a todos os ids. Campos
// omitidos são mantidos. local/descricao com string vazia limpam o campo.
// tipo_evento_id null remove o vínculo com o tipo.
export async function editarEventosEmMassa(
  ids: number[],
  campos: { local?: string; descricao?: string; data_evento?: string; tipo_evento_id?: number | null }
): Promise<MassaEventosState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...massaInitial, message: "Sessão expirada." };
  }

  const limpos = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
  if (limpos.length === 0) {
    return { ...massaInitial, message: "Selecione ao menos um evento." };
  }

  const parsed = editarMassaSchema.safeParse(campos);
  if (!parsed.success) {
    return { ...massaInitial, message: "Verifique os campos da edição em massa." };
  }

  const patch: Record<string, string | number | null> = {};
  if (parsed.data.local !== undefined) patch.local = parsed.data.local || null;
  if (parsed.data.descricao !== undefined) patch.descricao = parsed.data.descricao || null;
  if (parsed.data.data_evento !== undefined) patch.data_evento = parsed.data.data_evento;
  if (parsed.data.tipo_evento_id !== undefined) patch.tipo_evento_id = parsed.data.tipo_evento_id;

  if (Object.keys(patch).length === 0) {
    return { ...massaInitial, message: "Marque ao menos um campo para alterar." };
  }

  const { data, error } = await supabase
    .from("eventos")
    .update(patch)
    .in("id", limpos)
    .select("id");

  if (error) {
    console.error("editarEventosEmMassa: update failed", error);
    return { ...massaInitial, message: "Não foi possível salvar agora. Tente novamente." };
  }

  const afetados = (data ?? []).length;
  if (afetados === 0) {
    return { ...massaInitial, message: "Você não tem permissão para editar esses eventos." };
  }

  revalidatePath("/eventos");
  revalidatePath("/");
  return {
    ok: true,
    afetados,
    message:
      afetados === 1
        ? "1 evento atualizado."
        : `${afetados} eventos atualizados.`,
  };
}
export async function adicionarTarefasDoModelo(
  eventoId: number
): Promise<AdicionarTarefasState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...adicionarTarefasInitialState, message: "Sessão expirada." };
  }

  const { data: evento, error: eventoError } = await supabase
    .from("eventos")
    .select("id, data_evento, tipo_evento_id")
    .eq("id", eventoId)
    .single();

  if (eventoError || !evento) {
    return { ...adicionarTarefasInitialState, message: "Evento não encontrado." };
  }
  if (!evento.tipo_evento_id) {
    return {
      ...adicionarTarefasInitialState,
      message: "Esse evento não tem um tipo definido — configure o tipo na tela de modelos.",
    };
  }

  const { data: modelo, error: modeloError } = await supabase
    .from("modelo_tarefas")
    .select("titulo, area, prazo_offset_dias")
    .eq("tipo_id", evento.tipo_evento_id)
    .order("ordem", { ascending: true });

  if (modeloError) {
    return {
      ...adicionarTarefasInitialState,
      message: "Não foi possível carregar o modelo de tarefas.",
    };
  }
  if (!modelo || modelo.length === 0) {
    return {
      ...adicionarTarefasInitialState,
      message: "O modelo deste tipo de evento ainda não tem tarefas cadastradas.",
    };
  }

  // Skip tasks already materialized for this event (idempotent) — the
  // button can be pressed again without duplicating the 150 tasks.
  const { data: existentes } = await supabase
    .from("demandas")
    .select("titulo")
    .eq("evento_id", eventoId);

  const titulosExistentes = new Set(
    (existentes ?? []).map((d) => d.titulo.trim().toLowerCase())
  );

  const novas = modelo.filter(
    (tarefa) => !titulosExistentes.has(tarefa.titulo.trim().toLowerCase())
  );

  if (novas.length === 0) {
    return {
      ...adicionarTarefasInitialState,
      ok: true,
      message: "As tarefas do modelo já estão todas cadastradas neste evento.",
    };
  }

  const dataEvento = new Date(`${evento.data_evento}T00:00:00`);
  const insertRows = novas.map((tarefa) => {
    const prazo = new Date(dataEvento);
    prazo.setDate(prazo.getDate() + (tarefa.prazo_offset_dias ?? 0));
    return {
      titulo: tarefa.titulo,
      area: tarefa.area ?? null,
      prazo: prazo.toISOString().slice(0, 10),
      status: "pendente" as const,
      evento_id: eventoId,
    };
  });

  const { error: insertError } = await supabase.from("demandas").insert(insertRows);

  if (insertError) {
    console.error("adicionarTarefasDoModelo: insert failed", insertError);
    return {
      ...adicionarTarefasInitialState,
      message: "Não foi possível criar as tarefas do modelo.",
    };
  }

  revalidatePath(`/eventos/${eventoId}`);
  revalidatePath("/");
  return {
    ok: true,
    message: `${novas.length} tarefas do modelo adicionadas ao evento.`,
  };
}

// --- Model configuration actions (coordinator-only; RLS on the tables is
// the real boundary) ---

export type ModelosState = {
  ok: boolean;
  message: string;
};

const modelosInitialState: ModelosState = { ok: false, message: "" };

const tipoSchema = z.object({
  nome: z.string().trim().min(1, "Dê um nome ao tipo.").max(100),
});

export async function criarTipoEvento(
  prevState: ModelosState,
  formData: FormData
): Promise<ModelosState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...modelosInitialState, message: "Sessão expirada." };
  }

  const parsed = tipoSchema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { ...modelosInitialState, message: "Dê um nome ao tipo." };
  }

  const { error } = await supabase.from("evento_tipos").insert({ nome: parsed.data.nome });

  if (error) {
    console.error("criarTipoEvento: insert failed", error);
    return {
      ...modelosInitialState,
      message:
        error.code === "23505"
          ? "Já existe um tipo com esse nome."
          : "Não foi possível criar o tipo.",
    };
  }

  revalidatePath("/eventos/modelos");
  return { ok: true, message: "Tipo de evento criado." };
}

const tarefaModeloSchema = z.object({
  tipoId: z.preprocess(
    (value) => (value === "" || value == null ? undefined : Number(value)),
    z.number().int().positive()
  ),
  titulo: z.string().trim().min(1, "Escreva a tarefa.").max(300),
  area: z.string().trim().max(100).optional(),
  prazoOffsetDias: z.preprocess(
    (value) => (value === "" || value == null ? 0 : Number(value)),
    z.number().int().min(-365).max(365)
  ),
});

export async function adicionarTarefaModelo(
  prevState: ModelosState,
  formData: FormData
): Promise<ModelosState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...modelosInitialState, message: "Sessão expirada." };
  }

  const parsed = tarefaModeloSchema.safeParse({
    tipoId: formData.get("tipoId"),
    titulo: formData.get("titulo"),
    area: formData.get("area"),
    prazoOffsetDias: formData.get("prazoOffsetDias"),
  });

  if (!parsed.success) {
    return { ...modelosInitialState, message: "Verifique os campos da tarefa." };
  }

  const { error } = await supabase.from("modelo_tarefas").insert({
    tipo_id: parsed.data.tipoId,
    titulo: parsed.data.titulo,
    area: parsed.data.area || null,
    prazo_offset_dias: parsed.data.prazoOffsetDias,
  });

  if (error) {
    console.error("adicionarTarefaModelo: insert failed", error);
    return {
      ...modelosInitialState,
      message: "Não foi possível adicionar a tarefa ao modelo.",
    };
  }

  revalidatePath("/eventos/modelos");
  return { ok: true, message: "Tarefa adicionada ao modelo." };
}

export async function removerTarefaModelo(
  prevState: ModelosState,
  formData: FormData
): Promise<ModelosState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...modelosInitialState, message: "Sessão expirada." };
  }

  const rawId = formData.get("id");
  const id = Number(rawId);
  if (!Number.isFinite(id)) {
    return { ...modelosInitialState, message: "Tarefa inválida." };
  }

  const { error } = await supabase.from("modelo_tarefas").delete().eq("id", id);

  if (error) {
    console.error("removerTarefaModelo: delete failed", error);
    return { ...modelosInitialState, message: "Não foi possível remover a tarefa." };
  }

  revalidatePath("/eventos/modelos");
  return { ok: true, message: "Tarefa removida do modelo." };
}

export async function removerTipoEvento(
  prevState: ModelosState,
  formData: FormData
): Promise<ModelosState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...modelosInitialState, message: "Sessão expirada." };
  }

  const rawId = formData.get("id");
  const id = Number(rawId);
  if (!Number.isFinite(id)) {
    return { ...modelosInitialState, message: "Tipo inválido." };
  }

  // cascade removes the template tasks; eventos keep existing but lose the
  // type link (on delete set null).
  const { error } = await supabase.from("evento_tipos").delete().eq("id", id);

  if (error) {
    console.error("removerTipoEvento: delete failed", error);
    return { ...modelosInitialState, message: "Não foi possível remover o tipo." };
  }

  revalidatePath("/eventos/modelos");
  return { ok: true, message: "Tipo de evento removido." };
}

// ── Análise IA de duplicados (tela /eventos, com conferência humana) ──

export type EventoDuplicadoInfo = {
  id: number;
  titulo: string;
  data_evento: string;
  local: string | null;
  descricao: string | null;
};

export type GrupoDuplicado = {
  eventos: EventoDuplicadoInfo[];
  justificativa: string;
  manterId: number;
  confianca: "alta" | "media" | "baixa";
};

export type AnalisarDuplicadosState = {
  ok: boolean;
  message: string;
  grupos: GrupoDuplicado[];
  totalAnalisado: number;
};

function diasEntre(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 999;
  return Math.abs(Math.round((da - db) / 86400000));
}

function saoParecidos(a: EventoDuplicadoInfo, b: EventoDuplicadoInfo): boolean {
  const na = normalizarTituloEvento(a.titulo);
  const nb = normalizarTituloEvento(b.titulo);
  if (!na || !nb) return false;
  const mesmaData = a.data_evento === b.data_evento;
  const dataProxima = diasEntre(a.data_evento, b.data_evento) <= 3;
  const tituloIgual = na === nb;
  const tituloContido =
    na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na));
  // Token overlap (ex.: "Encontro Foz 2026" vs "Encontro de Voluntarios Foz 2026")
  const tokA = new Set(na.split(" ").filter((t) => t.length >= 4));
  const tokB = new Set(nb.split(" ").filter((t) => t.length >= 4));
  let comuns = 0;
  for (const t of tokA) if (tokB.has(t)) comuns++;
  const overlapForte =
    tokA.size >= 2 && tokB.size >= 2 && comuns >= Math.min(tokA.size, tokB.size, 2);

  if (tituloIgual && dataProxima) return true;
  if ((tituloContido || overlapForte) && (mesmaData || dataProxima)) return true;
  return false;
}

function sugerirDefinitivo(grupo: EventoDuplicadoInfo[]): number {
  const pontuacao = (e: EventoDuplicadoInfo) =>
    (e.local ? 2 : 0) + (e.descricao ? 2 : 0) + (e.titulo.length >= 10 ? 1 : 0);
  const ordenado = [...grupo].sort((x, y) => {
    const p = pontuacao(y) - pontuacao(x);
    if (p !== 0) return p;
    return x.id - y.id; // mais antigo primeiro em empate
  });
  return ordenado[0].id;
}

const duplicadoGrupoSchema = z.object({
  ids: z.array(z.number().int().positive()).min(2).max(10),
  justificativa: z.string().max(300),
  manterId: z.number().int().positive(),
  confianca: z.enum(["alta", "media", "baixa"]),
});

const duplicadoRespostaSchema = z.object({
  grupos: z.array(duplicadoGrupoSchema).max(50),
});

// Varre a base procurando réplicas (o mesmo evento extraído em várias atas
// ou importado várias vezes — 4-5 cópias na tela). Pré-filtro determinístico
// (union-find por título/data) reduz o custo; a IA confirma cada grupo com
// justificativa e sugere o definitivo. A mesclagem em si é sempre humana
// (conferência na UI via mesclarEventos). Coordenador apenas.
export async function analisarDuplicadosEventosIA(): Promise<AnalisarDuplicadosState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada.", grupos: [], totalAnalisado: 0 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "coordenador_geral") {
    return { ok: false, message: "Só o coordenador pode rodar a análise.", grupos: [], totalAnalisado: 0 };
  }

  const { data, error } = await supabase
    .from("eventos")
    .select("id, titulo, data_evento, local, descricao")
    .order("data_evento", { ascending: true })
    .limit(1000);
  if (error) {
    console.error("analisarDuplicadosEventosIA: read failed", error);
    return { ok: false, message: "Não foi possível ler os eventos.", grupos: [], totalAnalisado: 0 };
  }
  const eventos: EventoDuplicadoInfo[] = (data ?? []).map((e) => ({
    id: e.id,
    titulo: String(e.titulo),
    data_evento: String(e.data_evento),
    local: e.local ?? null,
    descricao: e.descricao ? String(e.descricao).slice(0, 200) : null,
  }));
  if (eventos.length < 2) {
    return { ok: true, message: "Menos de 2 eventos — nada para comparar.", grupos: [], totalAnalisado: eventos.length };
  }

  // Union-find sobre pares parecidos → grupos candidatos.
  const pai = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (pai.get(r) !== r) r = pai.get(r)!;
    return r;
  };
  const unir = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) pai.set(Math.max(ra, rb), Math.min(ra, rb));
  };
  for (const e of eventos) pai.set(e.id, e.id);
  for (let i = 0; i < eventos.length; i++) {
    for (let j = i + 1; j < eventos.length; j++) {
      if (saoParecidos(eventos[i], eventos[j])) unir(eventos[i].id, eventos[j].id);
    }
  }
  const baldes = new Map<number, EventoDuplicadoInfo[]>();
  for (const e of eventos) {
    const r = find(e.id);
    const lista = baldes.get(r) ?? [];
    lista.push(e);
    baldes.set(r, lista);
  }
  const candidatos = [...baldes.values()].filter((g) => g.length >= 2);
  if (candidatos.length === 0) {
    return { ok: true, message: "Nenhum duplicado encontrado. A base está coerente.", grupos: [], totalAnalisado: eventos.length };
  }

  const porId = new Map(eventos.map((e) => [e.id, e]));
  const fallback: GrupoDuplicado[] = candidatos.slice(0, 50).map((g) => ({
    eventos: g.slice(0, 10),
    justificativa: "Títulos muito parecidos na mesma época — confira data e local antes de mesclar.",
    manterId: sugerirDefinitivo(g),
    confianca: g.every((x) => x.data_evento === g[0].data_evento) ? ("alta" as const) : ("media" as const),
  }));

  // IA confirma/refina os candidatos (máx. 30 grupos por chamada).
  try {
    const amostra = candidatos.slice(0, 30).map((g) =>
      g.slice(0, 6).map((e) => ({
        id: e.id,
        titulo: e.titulo,
        data: e.data_evento,
        local: e.local,
      }))
    );
    const raw = JSON.parse(
      await chatCompletion(
        `Você confere eventos duplicados de uma instituição (responda APENAS JSON válido com a chave "grupos"). Cada grupo candidato contém eventos possivelmente repetidos (mesmo evento extraído de várias atas ou importado várias vezes). Mantenha um grupo SOMENTE se os eventos forem provavelmente o MESMO evento real: títulos equivalentes (ignorando acentos, caixa, "Palestra/Curso/Encontro" genéricos) E datas iguais ou com até 3 dias de diferença. Separe eventos de anos diferentes ou temas claramente distintos. Para cada grupo mantido, explique em 1 frase (justificativa), escolha manterId (o registro mais completo/mais antigo) e dê confianca alta/media/baixa. Formato exato: {"grupos": [{"ids": [1,2], "justificativa": "...", "manterId": 1, "confianca": "alta"}]}. Se nenhum for duplicado real, retorne {"grupos": []}. JSON apenas.`,
        wrapUserContent(JSON.stringify(amostra).slice(0, 20000)),
        { jsonMode: true }
      )
    );
    const parsed = duplicadoRespostaSchema.safeParse(raw);
    if (!parsed.success) return { ok: true, message: `${candidatos.length} ${candidatos.length === 1 ? "grupo suspeito" : "grupos suspeitos"} (análise por regras — a IA retornou formato inesperado). Confira antes de mesclar.`, grupos: fallback, totalAnalisado: eventos.length };
    const grupos: GrupoDuplicado[] = [];
    for (const g of parsed.data.grupos) {
      const evs = g.ids.map((id) => porId.get(id)).filter((e): e is EventoDuplicadoInfo => !!e);
      if (evs.length < 2) continue;
      grupos.push({
        eventos: evs,
        justificativa: g.justificativa || "Possível réplica — confira antes de mesclar.",
        manterId: evs.some((e) => e.id === g.manterId) ? g.manterId : sugerirDefinitivo(evs),
        confianca: g.confianca,
      });
    }
    if (grupos.length === 0) {
      return { ok: true, message: "A IA revisou os suspeitos e não confirmou duplicados reais.", grupos: [], totalAnalisado: eventos.length };
    }
    return { ok: true, message: `${grupos.length} ${grupos.length === 1 ? "grupo duplicado confirmado" : "grupos duplicados confirmados"} pela IA — confira e mescle.`, grupos, totalAnalisado: eventos.length };
  } catch (err) {
    console.error("analisarDuplicadosEventosIA: IA falhou, usando regras", err);
    return { ok: true, message: `${candidatos.length} ${candidatos.length === 1 ? "grupo suspeito" : "grupos suspeitos"} (análise por regras — a IA falhou). Confira antes de mesclar.`, grupos: fallback, totalAnalisado: eventos.length };
  }
}

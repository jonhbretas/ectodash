"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseCsv } from "@/lib/financeiro/parse-file";

export type ImportarEventosState = {
  ok: boolean;
  message: string;
};

const initialState: ImportarEventosState = { ok: false, message: "" };

export { initialState as importarEventosInitialState };

export type AdicionarTarefasState = {
  ok: boolean;
  message: string;
};

const adicionarTarefasInitialState: AdicionarTarefasState = {
  ok: false,
  message: "",
};

export { adicionarTarefasInitialState };

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...initialState, message: "Sessão expirada. Faça login novamente." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ...initialState, message: "Escolha um arquivo .csv." };
  }
  if (arquivo.size > MAX_FILE_BYTES) {
    return { ...initialState, message: "O arquivo é grande demais (máx. 1MB)." };
  }
  if (!arquivo.name.toLowerCase().endsWith(".csv")) {
    return { ...initialState, message: "Envie um arquivo no formato .csv." };
  }

  let texto: string;
  try {
    texto = await arquivo.text();
  } catch {
    return { ...initialState, message: "Não foi possível ler o arquivo." };
  }

  const allRows = parseCsv(texto);
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

  // criado_por comes from the column default (session) — never from the
  // CSV, same anti-spoofing discipline as every other insert in this app.
  const { error } = await supabase.from("eventos").insert(eventos);

  if (error) {
    console.error("importarEventos: insert failed", error);
    return {
      ...initialState,
      message: "Não foi possível salvar os eventos importados.",
    };
  }

  revalidatePath("/eventos");
  return {
    ok: true,
    message: `${eventos.length} eventos importados com sucesso.`,
  };
}

// Materializes the event type's task template into real demandas linked to
// the event ("Adicionar tarefas do evento"). Created WITHOUT responsáveis —
// the join table allows a demanda with zero responsáveis (the reminder
// cron already treats that case), and assignment happens afterwards via the
// edit screen. prazo = event date + template offset (negative = days
// before), status pendente, criado_por = the clicking volunteer.
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

export { modelosInitialState };

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

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

// CSV row: Data;Título;Local;Descrição — header row skipped, dates in
// dd/MM/yyyy or yyyy-MM-dd.
const eventoRowSchema = z.object({
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use dd/mm/aaaa ou aaaa-mm-dd)"),
  titulo: z.string().trim().min(1, "Título vazio").max(200),
  local: z.string().trim().max(200).optional(),
  descricao: z.string().trim().max(2000).optional(),
});

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

  const rows = parseCsv(texto).slice(1); // skip header
  const eventos: Array<{
    data_evento: string;
    titulo: string;
    local: string | null;
    descricao: string | null;
  }> = [];

  for (const row of rows) {
    if (row.every((cell) => String(cell).trim() === "")) continue;
    const data = parseData(String(row[0] ?? ""));
    const titulo = String(row[1] ?? "").trim();
    const local = String(row[2] ?? "").trim();
    const descricao = String(row[3] ?? "").trim();

    const parsed = eventoRowSchema.safeParse({
      data: data ?? "",
      titulo,
      local: local || undefined,
      descricao: descricao || undefined,
    });
    if (!parsed.success) {
      return {
        ...initialState,
        message:
          "Linha inválida no CSV: Data;Título;Local;Descrição (com cabeçalho na primeira linha).",
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

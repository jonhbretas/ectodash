"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseFinanceiroFile } from "@/lib/financeiro/parse-file";
import { chatCompletion } from "@/lib/ai/ai-client";

export type ImportarFinanceiroState = {
  ok: boolean;
  message: string;
  resumo: string | null;
};

const initialState: ImportarFinanceiroState = {
  ok: false,
  message: "",
  resumo: null,
};

export { initialState as importarFinanceiroInitialState };

// Manual CSV/XLSX import + AI didactic summary. The role branch below is
// UX-layer convenience — financial_entries' own RLS policies (0006/0008)
// are the real boundary; a wrong-role caller's delete/insert would return
// zero rows.
export async function importarFinanceiro(
  prevState: ImportarFinanceiroState,
  formData: FormData
): Promise<ImportarFinanceiroState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...initialState, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed =
    profile?.role === "coordenador_geral" || profile?.role === "financeiro";

  if (!allowed) {
    return { ...initialState, message: "Você não tem acesso ao financeiro." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ...initialState, message: "Escolha um arquivo .csv ou .xlsx." };
  }

  const parsed = await parseFinanceiroFile(arquivo);
  if (!parsed.ok) {
    return { ...initialState, message: parsed.error };
  }

  // Whole-table replace, same semantics as the cron sync: the uploaded
  // spreadsheet becomes the system of record, the dashboard mirrors it.
  const { error: deleteError } = await supabase
    .from("financial_entries")
    .delete()
    .gte("id", 0);

  if (deleteError) {
    console.error("importarFinanceiro: delete failed", deleteError);
    return {
      ...initialState,
      message: "Não foi possível substituir os lançamentos atuais.",
    };
  }

  const { error: insertError } = await supabase
    .from("financial_entries")
    .insert(
      parsed.entries.map((entry) => ({
        tipo: entry.tipo,
        descricao: entry.descricao,
        valor: entry.valor,
        data: entry.data,
        categoria: entry.categoria,
      }))
    );

  if (insertError) {
    console.error("importarFinanceiro: insert failed", insertError);
    return {
      ...initialState,
      message: "Não foi possível salvar os lançamentos importados.",
    };
  }

  revalidatePath("/financeiro");

  // AI didactic summary — best effort: a failure here never fails the
  // import, it just leaves the narrative card empty.
  let resumo: string | null = null;
  try {
    resumo = await gerarResumoInteligente(parsed.entries);
  } catch (err) {
    console.error("importarFinanceiro: AI summary failed", err);
  }

  return {
    ok: true,
    message: `${parsed.entries.length} lançamentos importados com sucesso.`,
    resumo,
  };
}

// Builds the didactic narrative from the imported numbers themselves —
// never from raw spreadsheet text — so the AI only ever sees aggregated
// figures, not the institution's full ledger.
async function gerarResumoInteligente(
  entries: { tipo: string; descricao: string; valor: number; data: string; categoria: string | null }[]
): Promise<string> {
  const totalEntradas = entries
    .filter((e) => e.tipo === "entrada")
    .reduce((sum, e) => sum + e.valor, 0);
  const totalSaidas = entries
    .filter((e) => e.tipo === "saida")
    .reduce((sum, e) => sum + e.valor, 0);

  const saidasPorCategoria = new Map<string, number>();
  for (const entry of entries) {
    if (entry.tipo !== "saida") continue;
    const key = entry.categoria?.trim() || "Sem categoria";
    saidasPorCategoria.set(key, (saidasPorCategoria.get(key) ?? 0) + entry.valor);
  }
  const topCategorias = [...saidasPorCategoria.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([categoria, valor]) => `${categoria}: R$ ${valor.toFixed(2)}`)
    .join("; ");

  const brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const numbers = [
    `Total de lançamentos: ${entries.length}`,
    `Entradas totais: ${brl.format(totalEntradas)}`,
    `Saídas totais: ${brl.format(totalSaidas)}`,
    `Resultado: ${brl.format(totalEntradas - totalSaidas)}`,
    `Maiores categorias de saída: ${topCategorias || "nenhuma"}`,
  ].join("\n");

  return chatCompletion(
    "Você é um consultor financeiro que explica números para voluntários de uma instituição sem fins lucrativos, incluindo pessoas mais velhas. Seja didático, positivo e simples. Responda em português com no máximo 5 frases curtas, em formato de lista ou parágrafo curto, sem jargão.",
    `Resumo dos dados financeiros da instituição:\n${numbers}\n\nEscreva uma leitura didática e fácil desses números, destacando o que está saudável e o que merece atenção.`
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseFinanceiroFile } from "@/lib/financeiro/parse-file";
import { parseRefValor } from "@/lib/financeiro/parse-ectolab";
import { labelMes } from "./financeiro-filter-schema";
import { chatCompletion, wrapUserContent } from "@/lib/ai/ai-client";

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

// Manual CSV/XLSX import + AI didactic summary. The role branch below is
// UX-layer convenience — financial_entries' own RLS policies (0006/0008)
// are the real boundary; a wrong-role caller's delete/insert would return
// zero rows.
export async function importarFinanceiro(
  prevState: ImportarFinanceiroState,
  formData: FormData
): Promise<ImportarFinanceiroState> {
  // Top-level safety net (same pattern as importarEventos): no file —
  // however malformed — may ever escape to the global error boundary.
  // SheetJS can still throw on deeply corrupt workbooks even with
  // cellFormula:false (e.g. "ERROR 2179011101@E352"); a throw here would
  // otherwise blank the whole page instead of showing the inline message.
  try {
    return await importarFinanceiroInner(prevState, formData);
  } catch (err) {
    console.error("importarFinanceiro: unhandled error", err);
    return {
      ...initialState,
      message:
        "Não foi possível ler o arquivo. Se for XLSX, verifique se não há fórmulas corrompidas (células com #REF! ou erros) — salve como .csv e tente novamente.",
    };
  }
}

async function importarFinanceiroInner(
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
    // 23514 = check constraint violation (e.g. valor negativo) — expose the
    // DB detail so a malformed spreadsheet row is actionable, not cryptic.
    const detail =
      insertError.code === "23514"
        ? " Algum valor veio negativo ou inválido na planilha — ajuste e tente novamente."
        : "";
    return {
      ...initialState,
      message: `Não foi possível salvar os lançamentos importados.${detail}`,
    };
  }

  // Referências mensais (linhas de total/soma/saldo/aplicação da planilha
  // EctoLab): upsert por mês, sem tocar em meses que o arquivo não trouxe
  // (um ajuste manual feito nos cards não é sobrescrito por um re-import
  // parcial). Falha aqui não reprova o import — é dado de acompanhamento.
  if (parsed.references.length > 0) {
    const { error: refError } = await supabase
      .from("financial_monthly_references")
      .upsert(
        parsed.references.map((ref) => ({
          mes: ref.mes,
          saldo_anterior: ref.saldoAnterior,
          receita_total: ref.receitaTotal,
          despesa_total: ref.despesaTotal,
          saldo_total: ref.saldoTotal,
          saldo_caixa: ref.saldoCaixa,
          aplicacao: ref.aplicacao,
          extra: ref.extra,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })),
        { onConflict: "mes" }
      );
    if (refError) {
      console.error("importarFinanceiro: references upsert failed", refError);
    }
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

export type SalvarReferenciasFinanceirasState = {
  ok: boolean;
  message: string;
};

const referenciasInitialState: SalvarReferenciasFinanceirasState = {
  ok: false,
  message: "",
};

// Campos dos cards de referência do mês — todos opcionais, valor em branco
// = sem referência para aquele campo.
const REFERENCIA_FIELDS = [
  "saldoAnterior",
  "receitaTotal",
  "despesaTotal",
  "saldoTotal",
  "saldoCaixa",
  "aplicacao",
] as const;

// Salva os cards de referência do mês selecionado (aplicação, saldo de
// caixa, saldo anterior etc.). Upsert por mês — cria ou atualiza o
// registro daquele mês sem afetar os demais.
export async function salvarReferenciasFinanceiras(
  prevState: SalvarReferenciasFinanceirasState,
  formData: FormData
): Promise<SalvarReferenciasFinanceirasState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...referenciasInitialState, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed =
    profile?.role === "coordenador_geral" || profile?.role === "financeiro";

  if (!allowed) {
    return { ...referenciasInitialState, message: "Você não tem acesso ao financeiro." };
  }

  const mes = String(formData.get("mes") ?? "");
  if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(mes)) {
    return { ...referenciasInitialState, message: "Mês inválido." };
  }

  const values: Partial<Record<(typeof REFERENCIA_FIELDS)[number], number | null>> = {};
  for (const field of REFERENCIA_FIELDS) {
    const raw = String(formData.get(field) ?? "").trim();
    if (raw === "") {
      values[field] = null;
    } else {
      const parsed = parseRefValor(raw);
      if (parsed === null) {
        return {
          ...referenciasInitialState,
          message: `Valor inválido no campo ${field}. Use números com vírgula decimal (ex.: 1.234,56).`,
        };
      }
      values[field] = parsed;
    }
  }

  const { error } = await supabase
    .from("financial_monthly_references")
    .upsert(
      {
        mes,
        saldo_anterior: values.saldoAnterior,
        receita_total: values.receitaTotal,
        despesa_total: values.despesaTotal,
        saldo_total: values.saldoTotal,
        saldo_caixa: values.saldoCaixa,
        aplicacao: values.aplicacao,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: "mes" }
    );

  if (error) {
    console.error("salvarReferenciasFinanceiras: upsert failed", error);
    return {
      ...referenciasInitialState,
      message: "Não foi possível salvar as referências. Tente novamente.",
    };
  }

  revalidatePath("/financeiro");
  return {
    ok: true,
    message: `Referências de ${labelMes(mes)} salvas.`,
  };
}

export type LimparFinanceiroState = {
  ok: boolean;
  message: string;
};

const limparInitialState: LimparFinanceiroState = {
  ok: false,
  message: "",
};

// Esvazia os lançamentos e as referências mensais do financeiro, deixando o
// painel pronto para uma importação nova. Deleção inteira de tabela — as
// mesmas políticas RLS do import (financeiro/coordenador_geral) valem aqui.
export async function limparFinanceiro(
  prevState: LimparFinanceiroState,
  formData: FormData
): Promise<LimparFinanceiroState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...limparInitialState, message: "Sessão expirada. Faça login novamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed =
    profile?.role === "coordenador_geral" || profile?.role === "financeiro";

  if (!allowed) {
    return { ...limparInitialState, message: "Você não tem acesso ao financeiro." };
  }

  const { error: entriesError } = await supabase
    .from("financial_entries")
    .delete()
    .gte("id", 0);

  if (entriesError) {
    console.error("limparFinanceiro: delete entries failed", entriesError);
    return {
      ...limparInitialState,
      message: "Não foi possível limpar os lançamentos. Tente novamente.",
    };
  }

  const { error: refsError } = await supabase
    .from("financial_monthly_references")
    .delete()
    .gte("mes", "");

  if (refsError) {
    console.error("limparFinanceiro: delete references failed", refsError);
    return {
      ...limparInitialState,
      message: "Lançamentos limpos, mas as referências mensais não puderam ser removidas.",
    };
  }

  revalidatePath("/financeiro");
  return {
    ok: true,
    message: "Dados financeiros limpos. Agora é só importar a nova planilha.",
  };
}

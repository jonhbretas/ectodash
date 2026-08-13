// src/lib/financeiro/parse-ectolab.ts
// Parser para o formato específico da planilha de fluxo de caixa da
// EctoLab (SISPRIME). O layout é uma matriz mensal:
//   - Col de descrição do item (na exportação CSV há uma coluna vazia
//     antes; no XLSX a descrição vem direto na col A)
//   - Col de centro de custo (categoria)
//   - Cols dos meses: Janeiro … Dezembro
//   - Col de Total Geral (ignorada)
//   - Col %
//
// As posições de descrição/categoria/meses são DERIVADAS do cabeçalho
// detectado (as duas colunas à esquerda do primeiro mês), então o mesmo
// parser aceita o CSV e o XLSX da mesma planilha.
//
// A planilha tem seções de RECEITAS (antes do primeiro TOTAL GERAL) e
// DESPESAS (depois do primeiro TOTAL GERAL, agrupadas por centro de
// custo). Cada célula mensal vira um lançamento individual na data do
// último dia daquele mês.
//
// Linhas de REFERÊNCIA — SALDO ANTERIOR, RECEITA TOTAL, DESPESA TOTAL,
// SALDO TOTAL, SALDO DE CAIXA, APLICAÇÃO e qualquer linha cujo nome
// contenha "total"/"soma"/"subtotal" — NUNCA viram lançamento de operação:
// elas são capturadas por mês em `references` (a conta de receita/despesa
// do dashboard usa apenas linhas de item).

import type { FinancialEntry } from "@/lib/sheets/parse-rows";

// Referência mensal agregada — um registro por mês (MM/yyyy), com os
// campos fixos conhecidos e `extra` para outras linhas de total/soma que a
// planilha trouxer sem casar com nenhum papel fixo.
export type FinancialReference = {
  mes: string; // MM/yyyy
  saldoAnterior: number | null;
  receitaTotal: number | null;
  despesaTotal: number | null;
  saldoTotal: number | null;
  saldoCaixa: number | null;
  aplicacao: number | null;
  extra: Record<string, number>;
};

export type EctolabParseResult = {
  entries: FinancialEntry[];
  references: FinancialReference[];
};

const MONTH_NAMES: string[] = [
  "janeiro",
  "fevereiro",
  "março",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export { MONTH_NAMES };

function extractYear(rows: unknown[][]): number | null {
  for (const row of rows.slice(0, 5)) {
    if (!Array.isArray(row) || row.length === 0) continue;
    const firstCell = String(row[0] ?? "").trim();
    const match = /(\d{4})/.exec(firstCell);
    if (match) {
      const year = Number(match[1]);
      if (year >= 2000 && year <= 2100) return year;
    }
  }
  return null;
}

function findMonthHeaderRow(
  rows: unknown[][]
): { rowIndex: number; monthIndices: Map<number, string> } | null {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const monthIndices = new Map<number, string>();
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? "").trim().toLowerCase();
      if (MONTH_NAMES.includes(cell)) {
        monthIndices.set(j, cell);
      }
    }

    if (monthIndices.size >= 6) {
      return { rowIndex: i, monthIndices };
    }
  }
  return null;
}

function parseValor(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    // Células negativas (saldo/resultado do período) não são lançamentos —
    // financial_entries exige valor >= 0 e o sinal vem de tipo entrada/saida.
    return raw > 0 ? raw : null;
  }

  const str = String(raw).trim();
  if (!str || str === "-" || str === "R$ -") return null;

  // Rejeita erros do Excel que possam ter vindo como texto
  if (str.includes("#") || /\b(div\/0|ref|value|num|name|null)\b/i.test(str)) {
    return null;
  }

  // Remove prefixo R$ e espaços
  let cleaned = str.replace(/^R\$\s*/, "").trim();
  if (!cleaned || cleaned === "0,00" || cleaned === "0.00" || cleaned === "0") {
    return null;
  }

  // PT-BR: vírgula é decimal, ponto é milhar
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function monthToDate(year: number, monthName: string): string | null {
  const map: Record<string, number> = {
    janeiro: 1,
    fevereiro: 2,
    março: 3,
    marco: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };
  const month = map[monthName.toLowerCase().trim()];
  if (!month) return null;

  // último dia do mês
  const date = new Date(year, month, 0);
  return date.toISOString().slice(0, 10);
}

// Mesmo parse de valor do parseValor, mas para REFERÊNCIAS: aceita zero e
// valores negativos (saldo de caixa negativo, saldo anterior a débito,
// resgate de aplicação) e parênteses contábeis "(1.234,56)". O sinal do
// lançamento vem do tipo entrada/saida — a referência carrega o sinal real.
function parseRefValor(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  const str = String(raw).trim();
  if (!str || str === "-" || str === "R$ -") return null;

  if (str.includes("#") || /\b(div\/0|ref|value|num|name|null)\b/i.test(str)) {
    return null;
  }

  let cleaned = str.replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!cleaned) return null;

  let negative = false;
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    negative = true;
    cleaned = cleaned.slice(1, -1);
  } else if (cleaned.startsWith("-")) {
    negative = true;
    cleaned = cleaned.slice(1);
  }

  // PT-BR: vírgula é decimal, ponto é milhar
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

export { parseRefValor };

// Chave normalizada para classificar linhas de referência: sem acentos,
// minúscula, sem espaços repetidos ("SALDO DE CAIXA" -> "saldo de caixa").
function refKey(descricao: string): string {
  return descricao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

// Papéis de referência reconhecidos por nome de linha. A ordem importa:
// nomes mais específicos vêm antes dos genéricos ("SALDO" puro cai no
// papel saldoCaixa apenas se nada mais casar).
const REFERENCE_ROLES: {
  re: RegExp;
  field: "saldoAnterior" | "receitaTotal" | "despesaTotal" | "saldoTotal" | "saldoCaixa" | "aplicacao";
}[] = [
  { re: /^saldo (anterior|inicial)$/, field: "saldoAnterior" },
  { re: /^(total (de )?receitas?|receita total)$/, field: "receitaTotal" },
  { re: /^(total (de )?despesas?|despesa total)$/, field: "despesaTotal" },
  { re: /^(saldo|soma) total$/, field: "saldoTotal" },
  { re: /^(saldo (de |do |em |no )?caixa|saldo)$/, field: "saldoCaixa" },
  { re: /^aplica(c|ç)(ao|ões|oes)$/, field: "aplicacao" },
];

// "TOTAL GERAL", "SUBTOTAL", "SOMA", "SOMATÓRIO..." — qualquer linha cujo
// nome contenha total/soma/subtotal é referência, nunca operação.
const TOTAL_LIKE = /\b(total|soma|subtotal)\b/;

function classifyReference(descricao: string): "extra" | keyof Omit<FinancialReference, "mes" | "extra"> | null {
  const key = refKey(descricao);
  if (!key) return null;
  for (const role of REFERENCE_ROLES) {
    if (role.re.test(key)) return role.field;
  }
  if (TOTAL_LIKE.test(key)) return "extra";
  return null;
}

/**
 * Detecta se a grade de linhas parece ser uma planilha EctoLab
 * (fluxo de caixa mensal com colunas de mês).
 */
export function isEctolabFormat(rows: unknown[][]): boolean {
  return findMonthHeaderRow(rows) !== null;
}

/**
 * Converte a grade de uma planilha EctoLab em entradas financeiras +
 * referências mensais (linhas de total/soma/saldo/aplicação).
 * Retorna `null` quando não consegue detectar o cabeçalho de meses.
 */
export function parseEctolabRows(
  rows: unknown[][]
): EctolabParseResult | null {
  const year = extractYear(rows) ?? new Date().getFullYear();
  const headerResult = findMonthHeaderRow(rows);
  if (!headerResult) return null;

  const { rowIndex: headerRowIndex, monthIndices } = headerResult;

  // Column positions are DERIVED from the detected header, never hardcoded:
  // the same workbook exports differently (CSV keeps a leading empty column,
  // XLSX does not — description sits at 0 in one and at 1 in the other).
  // The description/category columns are always the two columns left of the
  // first month.
  const firstMonthCol = Math.min(...monthIndices.keys());
  const colDesc = Math.max(0, firstMonthCol - 2);
  const colCat = Math.max(0, firstMonthCol - 1);

  const entries: FinancialEntry[] = [];
  const references: FinancialReference[] = [];
  const refByMes = new Map<string, FinancialReference>();
  let foundFirstTotal = false;

  function refBucket(mes: string): FinancialReference {
    let bucket = refByMes.get(mes);
    if (!bucket) {
      bucket = {
        mes,
        saldoAnterior: null,
        receitaTotal: null,
        despesaTotal: null,
        saldoTotal: null,
        saldoCaixa: null,
        aplicacao: null,
        extra: {},
      };
      refByMes.set(mes, bucket);
    }
    return bucket;
  }

  // "MM/yyyy" a partir de uma data yyyy-MM-dd (último dia do mês).
  function mesKeyOf(date: string): string {
    return `${date.slice(5, 7)}/${date.slice(0, 4)}`;
  }

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const desc = String(row[colDesc] ?? "").trim();
    const categoria = String(row[colCat] ?? "").trim();

    // Pula linhas completamente vazias nas colunas relevantes
    if (!desc && !categoria) continue;

    const upperDesc = desc.toUpperCase();

    // TOTAL GERAL — marca fim da seção de receitas E é também uma linha de
    // referência (capturada em `extra`, nunca vira lançamento).
    if (upperDesc === "TOTAL GERAL") {
      foundFirstTotal = true;
    }

    // Linhas de referência: total/soma/saldo/aplicação não entram na conta
    // de receita/despesa da operação — são capturadas por mês e exibidas em
    // cards de acompanhamento no dashboard.
    const role = classifyReference(desc);
    if (role !== null) {
      for (const [colIndex, monthName] of monthIndices) {
        const valor = parseRefValor(row[colIndex]);
        if (valor === null) continue;
        const data = monthToDate(year, monthName);
        if (!data) continue;
        const bucket = refBucket(mesKeyOf(data));
        if (role === "extra") {
          const key = `${desc}${categoria ? ` (${categoria})` : ""}`;
          if (!(key in bucket.extra)) bucket.extra[key] = valor;
        } else if (bucket[role] === null) {
          bucket[role] = valor;
        }
      }
      continue;
    }

    // Se ainda não encontrou o primeiro TOTAL GERAL, é receita;
    // depois disso, tudo é despesa
    const tipo: "entrada" | "saida" = foundFirstTotal ? "saida" : "entrada";

    // Pula linhas sem descrição (evita importar linhas de espaçamento)
    if (!desc) continue;

    for (const [colIndex, monthName] of monthIndices) {
      const valor = parseValor(row[colIndex]);
      if (valor !== null) {
        const data = monthToDate(year, monthName);
        if (data) {
          entries.push({
            tipo,
            descricao: desc,
            valor,
            data,
            categoria: categoria || null,
          });
        }
      }
    }
  }

  for (const bucket of refByMes.values()) references.push(bucket);
  references.sort((a, b) => a.mes.localeCompare(b.mes));

  return { entries, references };
}

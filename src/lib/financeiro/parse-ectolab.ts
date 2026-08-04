// src/lib/financeiro/parse-ectolab.ts
// Parser para o formato específico da planilha de fluxo de caixa da
// EctoLab (SISPRIME). O layout é uma matriz mensal:
//   - Col A: vazia
//   - Col B: descrição do item
//   - Col C: centro de custo (categoria)
//   - Cols D-O: Janeiro … Dezembro
//   - Col P: Total Geral
//   - Col Q: %
//
// A planilha tem seções de RECEITAS (antes do primeiro TOTAL GERAL) e
// DESPESAS (depois do primeiro TOTAL GERAL, agrupadas por centro de
// custo). Cada célula mensal vira um lançamento individual na data do
// último dia daquele mês. O SALDO ANTERIOR é importado como uma única
// entrada no último dia do mês anterior ao primeiro mês com valor,
// garantindo que o caixa computado pelo dashboard bata com a planilha.

import type { FinancialEntry } from "@/lib/sheets/parse-rows";

const MONTH_NAMES = [
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
    return raw === 0 ? null : raw;
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
  if (!Number.isFinite(value) || value === 0) return null;
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

/**
 * Detecta se a grade de linhas parece ser uma planilha EctoLab
 * (fluxo de caixa mensal com colunas de mês).
 */
export function isEctolabFormat(rows: unknown[][]): boolean {
  return findMonthHeaderRow(rows) !== null;
}

/**
 * Converte a grade de uma planilha EctoLab em entradas financeiras.
 * Retorna `null` quando não consegue detectar o cabeçalho de meses.
 */
export function parseEctolabRows(
  rows: unknown[][]
): FinancialEntry[] | null {
  const year = extractYear(rows) ?? new Date().getFullYear();
  const headerResult = findMonthHeaderRow(rows);
  if (!headerResult) return null;

  const { rowIndex: headerRowIndex, monthIndices } = headerResult;
  const entries: FinancialEntry[] = [];
  let foundFirstTotal = false;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const desc = String(row[1] ?? "").trim();
    const categoria = String(row[2] ?? "").trim();

    // Pula linhas completamente vazias nas colunas relevantes
    if (!desc && !categoria) continue;

    const upperDesc = desc.toUpperCase();

    // Detecta TOTAL GERAL — marca fim da seção de receitas
    if (upperDesc === "TOTAL GERAL") {
      foundFirstTotal = true;
      continue;
    }

    // Linhas de resumo do rodapé
    if (
      upperDesc === "RECEITA TOTAL" ||
      upperDesc === "DESPESA TOTAL" ||
      upperDesc === "SALDO DE CAIXA"
    ) {
      continue;
    }

    // SALDO ANTERIOR — importa apenas o primeiro mês com valor como
    // entrada de abertura no último dia do mês anterior
    if (upperDesc === "SALDO ANTERIOR") {
      for (const [colIndex, monthName] of monthIndices) {
        const valor = parseValor(row[colIndex]);
        if (valor !== null) {
          const data = monthToDate(year, monthName);
          if (data) {
            const prev = new Date(`${data}T00:00:00`);
            prev.setDate(0); // último dia do mês anterior
            entries.push({
              tipo: "entrada",
              descricao: "SALDO ANTERIOR",
              valor,
              data: prev.toISOString().slice(0, 10),
              categoria: null,
            });
          }
          break; // apenas o primeiro mês com valor
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

  return entries;
}

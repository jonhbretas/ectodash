// src/lib/propostas/parse-sheet.ts
// Parser puro das linhas do Google Sheets → proposta (sem I/O, testável).
// Layout esperado da aba (primeira linha = cabeçalho, ignorado):
//   A aluno | B email | C curso/evento/atividade | D valor | E método |
//   F prazo | G pago | H observações
// Método e pago aceitam variações em PT (com/sem acento, maiúsculas).
// Valor aceita "1.234,56" (BR) ou "1234.56"; prazo aceita dd/mm/aaaa
// ou aaaa-mm-dd. Linha sem aluno ou sem curso é ignorada (contada).

import type { METODOS } from "@/app/(dashboard)/financeiro/propostas/proposta-schema";

export type LinhaPlanilha = {
  aluno: string;
  email: string | null;
  curso: string;
  valor: number;
  metodo: (typeof METODOS)[number];
  prazo: string | null;
  pago: boolean;
  observacoes: string | null;
};

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function mapearMetodo(raw: string): LinhaPlanilha["metodo"] {
  const v = semAcento(raw);
  if (v === "pix") return "pix";
  if (v.includes("transf")) return "transferencia";
  if (v.includes("bolet")) return "boleto";
  if (v.includes("cred")) return "cartao_credito";
  if (v.includes("deb")) return "cartao_debito";
  if (v.includes("dinheiro") || v === "espécie" || v === "especie") return "dinheiro";
  return "outro";
}

const PAGO_SIM = new Set(["pago", "paga", "sim", "s", "yes", "y", "true", "1", "x", "ok"]);

export function mapearPago(raw: string): boolean {
  const v = semAcento(raw).replace(/[✓✔]/g, "x");
  return PAGO_SIM.has(v);
}

/** "1.234,56" | "R$ 1.234,56" | "1234.56" | "1500" → número ou null. */
export function parseValorPlanilha(raw: string): number | null {
  let v = raw.trim().replace(/^r\$\s*/i, "").replace(/\s/g, "");
  if (!v) return null;
  if (v.includes(",")) {
    v = v.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** "dd/mm/aaaa" | "aaaa-mm-dd" → "aaaa-mm-dd" ou null. */
export function parsePrazoPlanilha(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const br = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, d, m, a] = br;
    return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

export type ParseResult = {
  linhas: Array<LinhaPlanilha & { sheetRow: number }>;
  ignoradas: number;
};

/** values = resposta de spreadsheets.values.get (com cabeçalho na linha 1). */
export function parseLinhasPropostas(values: string[][]): ParseResult {
  const linhas: ParseResult["linhas"] = [];
  let ignoradas = 0;
  // Pula o cabeçalho (linha 1); sheetRow = número real da linha na aba.
  for (let i = 1; i < values.length; i++) {
    const cells = values[i] ?? [];
    const aluno = (cells[0] ?? "").trim();
    const curso = (cells[2] ?? "").trim();
    if (!aluno || !curso) {
      ignoradas++;
      continue;
    }
    const valor = parseValorPlanilha(cells[3] ?? "");
    if (valor === null) {
      ignoradas++;
      continue;
    }
    const email = (cells[1] ?? "").trim() || null;
    linhas.push({
      aluno,
      email,
      curso,
      valor,
      metodo: mapearMetodo(cells[4] ?? ""),
      prazo: parsePrazoPlanilha(cells[5] ?? ""),
      pago: mapearPago(cells[6] ?? ""),
      observacoes: (cells[7] ?? "").trim() || null,
      sheetRow: i + 1,
    });
  }
  return { linhas, ignoradas };
}

/** Cabeçalho + linhas para a EXPORTAÇÃO (sistema → planilha). */
export const CABECALHO_EXPORT = [
  "aluno",
  "email",
  "curso/evento/atividade",
  "valor",
  "metodo",
  "prazo",
  "pago",
  "observacoes",
];

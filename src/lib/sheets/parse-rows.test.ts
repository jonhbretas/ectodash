// src/lib/sheets/parse-rows.test.ts
// Pure-unit tests for parseSheetRows() — no live Google Sheets API, no
// network. Covers the PLACEHOLDER column layout's parsing rules: PT-BR
// date/currency formats, tipo normalization, header skipping, empty-row
// tolerance, and whole-batch rejection on any invalid row (the phase's
// "never a half-ingested dashboard" invariant).

import { describe, expect, it } from "vitest";
import { parseSheetRows, SHEET_COLUMNS } from "./parse-rows";

// Helper building a raw sheet row in the placeholder column order:
// [data, descricao, tipo, valor, categoria].
function raw(data: string, descricao: string, tipo: string, valor: string, categoria = "") {
  const row: unknown[] = [];
  row[SHEET_COLUMNS.data] = data;
  row[SHEET_COLUMNS.descricao] = descricao;
  row[SHEET_COLUMNS.tipo] = tipo;
  row[SHEET_COLUMNS.valor] = valor;
  row[SHEET_COLUMNS.categoria] = categoria;
  return row;
}

const HEADER = ["Data", "Descrição", "Tipo", "Valor", "Categoria"];

describe("parseSheetRows", () => {
  it("skips the header row and parses valid data rows", () => {
    const entries = parseSheetRows([
      HEADER,
      raw("15/07/2026", "Doação", "entrada", "500,00", "Doações"),
      raw("2026-07-20", "Energia", "saida", "120.50", "Contas"),
    ]);

    expect(entries).toEqual([
      {
        data: "2026-07-15",
        descricao: "Doação",
        tipo: "entrada",
        valor: 500,
        categoria: "Doações",
      },
      {
        data: "2026-07-20",
        descricao: "Energia",
        tipo: "saida",
        valor: 120.5,
        categoria: "Contas",
      },
    ]);
  });

  it("normalizes PT-BR decimal separators (1.234,56 -> 1234.56)", () => {
    const entries = parseSheetRows([
      HEADER,
      raw("01/08/2026", "Aluguel", "saida", "1.234,56"),
    ]);

    expect(entries?.[0].valor).toBe(1234.56);
  });

  it("accepts tipo synonyms (receita/despesa/pagamento) case-insensitively", () => {
    const entries = parseSheetRows([
      HEADER,
      raw("01/08/2026", "Aula", "Receita", "90,00"),
      raw("02/08/2026", "Material", "Despesa", "30,00"),
      raw("03/08/2026", "Conta", "PAGAMENTO", "15,00"),
    ]);

    expect(entries?.map((e) => e.tipo)).toEqual([
      "entrada",
      "saida",
      "saida",
    ]);
  });

  it("tolerates trailing fully-empty rows (blank rows at the sheet bottom)", () => {
    const entries = parseSheetRows([
      HEADER,
      raw("01/08/2026", "Doação", "entrada", "10,00"),
      [],
      [null, null, null],
    ]);

    expect(entries?.length).toBe(1);
  });

  it("returns an empty array for a header-only sheet (legitimate 0-entry sync)", () => {
    expect(parseSheetRows([HEADER])).toEqual([]);
  });

  it("rejects the ENTIRE batch when any non-empty row is invalid (no half-ingest)", () => {
    const result = parseSheetRows([
      HEADER,
      raw("01/08/2026", "Doação", "entrada", "10,00"),
      raw("não-é-data", "Energia", "saida", "120,00"),
    ]);

    expect(result).toBeNull();
  });

  it("rejects unknown tipo values", () => {
    const result = parseSheetRows([
      HEADER,
      raw("01/08/2026", "Doação", "transferência", "10,00"),
    ]);

    expect(result).toBeNull();
  });

  it("rejects zero/negative/blank valor values", () => {
    const zero = parseSheetRows([HEADER, raw("01/08/2026", "Doação", "entrada", "0,00")]);
    const blank = parseSheetRows([HEADER, raw("01/08/2026", "Doação", "entrada", "")]);

    expect(zero).toBeNull();
    expect(blank).toBeNull();
  });
});

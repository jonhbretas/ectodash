// src/lib/financeiro/parse-ectolab.test.ts
// Pure-unit tests para o parser do fluxo de caixa EctoLab — sem I/O,
// sem rede. Valida detecção de formato, parsing de valores PT-BR,
// separação receitas/despesas e captura das linhas de referência
// (total/soma/saldo/aplicação), que nunca viram lançamento de operação.

import { describe, expect, it } from "vitest";
import {
  isEctolabFormat,
  parseEctolabRows,
  parseRefValor,
  type EctolabParseResult,
} from "./parse-ectolab";

const HEADER_ROW = [
  "",
  "Receitas - Forma de Pagamento",
  "Centro de Custo",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
  "Total Geral",
  "",
  "%",
];

function makeRow(
  desc: string,
  categoria: string,
  ...months: (string | number | null | undefined)[]
) {
  const row: unknown[] = Array(18).fill("");
  row[1] = desc;
  row[2] = categoria;
  for (let i = 0; i < months.length && i < 12; i++) {
    row[3 + i] = months[i] ?? "";
  }
  return row;
}

// Layout XLSX: a planilha real exporta SEM a coluna vazia inicial que o
// CSV tem — descrição na col 0, centro de custo na col 1, meses da col 2.
function makeXlsxRow(
  desc: string,
  categoria: string,
  ...months: (string | number | null | undefined)[]
) {
  const row: unknown[] = Array(17).fill("");
  row[0] = desc;
  row[1] = categoria;
  for (let i = 0; i < months.length && i < 12; i++) {
    row[2 + i] = months[i] ?? "";
  }
  return row;
}

function parse(rows: unknown[][]): EctolabParseResult | null {
  return parseEctolabRows(rows);
}

describe("isEctolabFormat", () => {
  it("retorna true quando há pelo menos 6 meses no cabeçalho", () => {
    expect(isEctolabFormat([HEADER_ROW])).toBe(true);
  });

  it("retorna false para planilha flat tradicional", () => {
    expect(
      isEctolabFormat([
        ["Data", "Descrição", "Tipo", "Valor", "Categoria"],
        ["01/01/2026", "Doação", "entrada", "100,00", "Doações"],
      ])
    ).toBe(false);
  });

  it("retorna false para planilha vazia", () => {
    expect(isEctolabFormat([])).toBe(false);
    expect(isEctolabFormat([[]])).toBe(false);
  });
});

describe("parseEctolabRows", () => {
  it("retorna null quando não detecta cabeçalho de meses", () => {
    expect(
      parseEctolabRows([
        ["Data", "Descrição", "Tipo", "Valor"],
        ["01/01/2026", "X", "entrada", "10"],
      ])
    ).toBeNull();
  });

  it("converte receitas mensais em entradas no último dia de cada mês", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow(
        "Vendas à vista - Pix",
        "Depósitos",
        "  5.350,39 ",
        "  2.635,00 ",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
      ),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00", "0,00", "0,00", "0,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries.length).toBe(2);

    const jan = result!.entries.find((e) => e.data === "2026-01-31");
    expect(jan).toEqual({
      tipo: "entrada",
      descricao: "Vendas à vista - Pix",
      valor: 5350.39,
      data: "2026-01-31",
      categoria: "Depósitos",
    });

    const fev = result!.entries.find((e) => e.data === "2026-02-28");
    expect(fev).toEqual({
      tipo: "entrada",
      descricao: "Vendas à vista - Pix",
      valor: 2635.0,
      data: "2026-02-28",
      categoria: "Depósitos",
    });
  });

  it("converte despesas mensais em saídas", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
      makeRow("Facebook", "Comunicação e MKT", null, null, null, "  255,86 "),
      makeRow("TOTAL GERAL", "COMUNICAÇÃO E MKT", "0,00", "0,00", "0,00", "255,86"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();

    const despesa = result!.entries.find((e) => e.descricao === "Facebook");
    expect(despesa).toEqual({
      tipo: "saida",
      descricao: "Facebook",
      valor: 255.86,
      data: "2026-04-30",
      categoria: "Comunicação e MKT",
    });
  });

  it("captura SALDO ANTERIOR como referência mensal, sem virar lançamento", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
      makeRow("TOTAL GERAL", "COMUNICAÇÃO E MKT", "0,00"),
      makeRow("SALDO ANTERIOR", "", "R$ 41.445,78", "R$ 42.467,15"),
      makeRow("RECEITA TOTAL", "", "0,00"),
      makeRow("DESPESA TOTAL", "", "0,00"),
      makeRow("SALDO DE CAIXA", "", "0,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    // Nenhuma das linhas de referência vira lançamento de operação.
    expect(result!.entries.length).toBe(0);

    const jan = result!.references.find((r) => r.mes === "01/2026");
    expect(jan?.saldoAnterior).toBe(41445.78);
    const fev = result!.references.find((r) => r.mes === "02/2026");
    expect(fev?.saldoAnterior).toBe(42467.15);
  });

  it("captura RECEITA TOTAL, DESPESA TOTAL e SALDO DE CAIXA do rodapé", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("Doação", "Doações", "10.000,00"),
      makeRow("TOTAL GERAL", "Receitas Diversas", "10.000,00"),
      makeRow("SALDO ANTERIOR", "", "5.000,00"),
      makeRow("RECEITA TOTAL", "", "10.000,00"),
      makeRow("DESPESA TOTAL", "", "6.500,00"),
      makeRow("SALDO DE CAIXA", "", "8.500,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries.length).toBe(1); // apenas a Doação é operação

    const jan = result!.references.find((r) => r.mes === "01/2026");
    expect(jan?.saldoAnterior).toBe(5000);
    expect(jan?.receitaTotal).toBe(10000);
    expect(jan?.despesaTotal).toBe(6500);
    expect(jan?.saldoCaixa).toBe(8500);
  });

  it("captura APLICAÇÃO como referência e aceita saldo negativo", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("Doação", "Doações", "3.000,00"),
      makeRow("TOTAL GERAL", "Receitas Diversas", "3.000,00"),
      makeRow("APLICAÇÃO", "", "1.200,00"),
      makeRow("SALDO DE CAIXA", "", "-500,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries.length).toBe(1);

    const jan = result!.references.find((r) => r.mes === "01/2026");
    expect(jan?.aplicacao).toBe(1200);
    expect(jan?.saldoCaixa).toBe(-500);
  });

  it("trata qualquer linha com total/soma/subtotal como referência extra", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("SOMA DAS RECEITAS", "", "4.000,00"),
      makeRow("SUBTOTAL MKT", "", "700,00"),
      makeRow("SALDO TOTAL", "", "3.300,00"),
      makeRow("TOTAL GERAL", "Receitas Diversas", "4.000,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries.length).toBe(0);

    const jan = result!.references.find((r) => r.mes === "01/2026");
    expect(jan?.extra["SOMA DAS RECEITAS"]).toBe(4000);
    expect(jan?.extra["SUBTOTAL MKT"]).toBe(700);
    expect(jan?.extra["TOTAL GERAL (Receitas Diversas)"]).toBe(4000);
    expect(jan?.saldoTotal).toBe(3300);
  });

  it("TOTAL GERAL marca a transição receitas/despesas e é capturado como extra", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("TOTAL GERAL", "Receitas Diversas", "18.857,82"),
      makeRow("Facebook", "Comunicação e MKT", null, null, null, "  255,86 "),
      makeRow("TOTAL GERAL", "COMUNICAÇÃO E MKT", "1.428,33"),
      makeRow("SALDO DE CAIXA", "", "42.467,15"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    // Apenas o Facebook (pós primeiro TOTAL GERAL) vira saída.
    expect(result!.entries.length).toBe(1);
    expect(result!.entries[0]).toEqual({
      tipo: "saida",
      descricao: "Facebook",
      valor: 255.86,
      data: "2026-04-30",
      categoria: "Comunicação e MKT",
    });

    const jan = result!.references.find((r) => r.mes === "01/2026");
    expect(jan?.saldoCaixa).toBe(42467.15);
    expect(jan?.extra["TOTAL GERAL (COMUNICAÇÃO E MKT)"]).toBe(1428.33);
    expect(jan?.extra["TOTAL GERAL (Receitas Diversas)"]).toBe(18857.82);
  });

  it("pula linhas com valor zero ou vazio", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("Resgate", "Resgate aplicação", "R$ 0,00", "", null),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries.length).toBe(0);
  });

  it("pula células com valor negativo (saldo/resultado, não lançamento)", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("Doação", "Doações", 500, -700, 0),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries.length).toBe(1);
    expect(result!.entries[0].valor).toBe(500);
    expect(result!.entries[0].data).toBe("2026-01-31");
  });

  it("aceita valores como números (vindo de XLSX raw)", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("Doação", "Doações", 500.0, 0, null),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries.length).toBe(1);
    expect(result!.entries[0].valor).toBe(500);
  });

  it("rejeita células com erro do Excel (#DIV/0!, #REF! etc.)", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("Item A", "Cat A", "#DIV/0!", "#REF!"),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries.length).toBe(0);
  });

  it("extrai ano do título 'Fluxo de Caixa - YYYY'", () => {
    const rows = [
      ["Fluxo de Caixa - 2027"],
      HEADER_ROW,
      makeRow("Doação", "Doações", "100,00"),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries[0].data).toBe("2027-01-31");
  });

  it("usa ano atual quando não encontra ano no título", () => {
    const currentYear = new Date().getFullYear();
    const rows = [
      ["Outro título"],
      HEADER_ROW,
      makeRow("Doação", "Doações", "100,00"),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();
    expect(result!.entries[0].data).toBe(`${currentYear}-01-31`);
  });

  it("parseia o layout XLSX (sem coluna vazia inicial, meses na col 2)", () => {
    const xlsxHeader = [
      "Receitas - Forma de Pagamento",
      "Centro de Custo",
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
      "Total Geral",
      "",
      "%",
    ];
    const rows = [
      ["Fluxo de Caixa - 2026"],
      xlsxHeader,
      makeXlsxRow("Vendas à vista -  Ted, Pix", "Depósitos", 5350.39, 2635, 7185),
      makeXlsxRow("TOTAL GERAL", "Receitas Diversas", 18857.82),
      makeXlsxRow("Facebook", "Comunicação e MKT", null, null, null, 255.86),
      makeXlsxRow("TOTAL GERAL", "COMUNICAÇÃO E MKT", 0, 0, 0, 255.86),
    ];

    const result = parse(rows);
    expect(result).not.toBeNull();

    const receita = result!.entries.find(
      (e) => e.descricao === "Vendas à vista -  Ted, Pix"
    );
    expect(receita).toEqual({
      tipo: "entrada",
      descricao: "Vendas à vista -  Ted, Pix",
      valor: 5350.39,
      data: "2026-01-31",
      categoria: "Depósitos",
    });

    const despesa = result!.entries.find((e) => e.descricao === "Facebook");
    expect(despesa).toEqual({
      tipo: "saida",
      descricao: "Facebook",
      valor: 255.86,
      data: "2026-04-30",
      categoria: "Comunicação e MKT",
    });
  });
});

describe("parseRefValor", () => {
  it("parseia valores PT-BR com vírgula decimal e pontos de milhar", () => {
    expect(parseRefValor("1.234,56")).toBe(1234.56);
    expect(parseRefValor("R$ 42.467,15")).toBe(42467.15);
    expect(parseRefValor("0,00")).toBe(0);
    expect(parseRefValor(1234.5)).toBe(1234.5);
  });

  it("aceita negativos e parênteses contábeis", () => {
    expect(parseRefValor("-500,00")).toBe(-500);
    expect(parseRefValor("(1.200,00)")).toBe(-1200);
    expect(parseRefValor(-700)).toBe(-700);
  });

  it("retorna null para vazio, '-' e erros do Excel", () => {
    expect(parseRefValor("")).toBeNull();
    expect(parseRefValor(" ")).toBeNull();
    expect(parseRefValor("-")).toBeNull();
    expect(parseRefValor("#REF!")).toBeNull();
    expect(parseRefValor(null)).toBeNull();
    expect(parseRefValor(undefined)).toBeNull();
  });
});

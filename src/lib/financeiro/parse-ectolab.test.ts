// src/lib/financeiro/parse-ectolab.test.ts
// Pure-unit tests para o parser do fluxo de caixa EctoLab — sem I/O,
// sem rede. Valida detecção de formato, parsing de valores PT-BR,
// separação receitas/despesas, importação do SALDO ANTERIOR e rejeição
// de linhas inválidas.

import { describe, expect, it } from "vitest";
import { isEctolabFormat, parseEctolabRows } from "./parse-ectolab";

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

    const entries = parseEctolabRows(rows);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(2);

    const jan = entries!.find((e) => e.data === "2026-01-31");
    expect(jan).toEqual({
      tipo: "entrada",
      descricao: "Vendas à vista - Pix",
      valor: 5350.39,
      data: "2026-01-31",
      categoria: "Depósitos",
    });

    const fev = entries!.find((e) => e.data === "2026-02-28");
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

    const entries = parseEctolabRows(rows);
    expect(entries).not.toBeNull();

    const despesa = entries!.find((e) => e.descricao === "Facebook");
    expect(despesa).toEqual({
      tipo: "saida",
      descricao: "Facebook",
      valor: 255.86,
      data: "2026-04-30",
      categoria: "Comunicação e MKT",
    });
  });

  it("importa SALDO ANTERIOR como entrada no último dia do mês anterior", () => {
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

    const entries = parseEctolabRows(rows);
    expect(entries).not.toBeNull();

    const saldo = entries!.find((e) => e.descricao === "SALDO ANTERIOR");
    expect(saldo).toEqual({
      tipo: "entrada",
      descricao: "SALDO ANTERIOR",
      valor: 41445.78,
      data: "2025-12-31",
      categoria: null,
    });
  });

  it("pula linhas com valor zero ou vazio", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("Resgate", "Resgate aplicação", "R$ 0,00", "", null),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const entries = parseEctolabRows(rows);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(0);
  });

  it("aceita valores como números (vindo de XLSX raw)", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("Doação", "Doações", 500.0, 0, null),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const entries = parseEctolabRows(rows);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(1);
    expect(entries![0].valor).toBe(500);
  });

  it("pula TOTAL GERAL de cada seção e não gera entradas para eles", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("TOTAL GERAL", "Receitas Diversas", "18.857,82"),
      makeRow("TOTAL GERAL", "COMUNICAÇÃO E MKT", "1.428,33"),
      makeRow("TOTAL GERAL", "CONTABILIDADE E ENCARGOS", "5.607,56"),
      makeRow("SALDO DE CAIXA", "", "42.467,15"),
    ];

    const entries = parseEctolabRows(rows);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(0);
  });

  it("rejeita células com erro do Excel (#DIV/0!, #REF! etc.)", () => {
    const rows = [
      ["Fluxo de Caixa - 2026"],
      HEADER_ROW,
      makeRow("Item A", "Cat A", "#DIV/0!", "#REF!"),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const entries = parseEctolabRows(rows);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(0);
  });

  it("extrai ano do título 'Fluxo de Caixa - YYYY'", () => {
    const rows = [
      ["Fluxo de Caixa - 2027"],
      HEADER_ROW,
      makeRow("Doação", "Doações", "100,00"),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const entries = parseEctolabRows(rows);
    expect(entries).not.toBeNull();
    expect(entries![0].data).toBe("2027-01-31");
  });

  it("usa ano atual quando não encontra ano no título", () => {
    const currentYear = new Date().getFullYear();
    const rows = [
      ["Outro título"],
      HEADER_ROW,
      makeRow("Doação", "Doações", "100,00"),
      makeRow("TOTAL GERAL", "Receitas Diversas", "0,00"),
    ];

    const entries = parseEctolabRows(rows);
    expect(entries).not.toBeNull();
    expect(entries![0].data).toBe(`${currentYear}-01-31`);
  });
});

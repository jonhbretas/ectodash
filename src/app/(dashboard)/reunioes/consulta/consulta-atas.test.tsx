// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConsultaAtas from "./consulta-atas";
import { CAMPOS_CONSULTA, consultarAtas, mapearAtaConsulta, trechoConsulta, type AtaConsulta } from "../_lib/consulta-atas";

afterEach(cleanup);

function ata(id: number, campos: Partial<AtaConsulta> = {}): AtaConsulta {
  return {
    ...Object.fromEntries(Object.keys(CAMPOS_CONSULTA).map((key) => [key, null])),
    id, titulo: `Ata ${id}`, data_reuniao: "2026-10-15", ...campos,
  } as AtaConsulta;
}
const atas = [
  ata(1, { deliberacoes: "João enviará o orçamento aprovado.", texto: `${"Introdução. ".repeat(100)}A formação será realizada em novembro.` }),
  ata(2, { data_reuniao: "2026-09-01", decisoes: "Orçamento adiado para dezembro." }),
];

describe("consulta das atas sem IA", () => {
  it("localiza deliberações sem acentos, destaca o trecho e mantém o link da fonte", async () => {
    render(<ConsultaAtas atas={atas} />);
    await userEvent.type(screen.getByRole("searchbox"), "joao orcamento");
    expect(screen.getByRole("status").textContent).toBe("1 ata encontrada");
    expect(screen.getByRole("heading", { name: "Deliberações" })).toBeTruthy();
    expect(screen.getByText("João").tagName).toBe("MARK");
    expect(screen.getByRole("link", { name: "Ver ata completa" }).getAttribute("href")).toBe("/reunioes/1");
  });

  it("combina campo e período, valida datas invertidas e limpa os filtros", async () => {
    render(<ConsultaAtas atas={atas} />);
    await userEvent.type(screen.getByRole("searchbox"), "orcamento");
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-15" } });
    expect(screen.getByRole("status").textContent).toBe("1 ata encontrada");
    await userEvent.selectOptions(screen.getByLabelText("Onde buscar"), "decisoes");
    expect(screen.getByRole("status").textContent).toBe("0 atas encontradas");
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-09-01" } });
    expect(screen.getByRole("alert").textContent).toContain("data inicial");
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getByRole("status").textContent).toBe("2 atas encontradas");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("pagina os resultados e volta à primeira página ao filtrar", async () => {
    render(<ConsultaAtas atas={Array.from({ length: 21 }, (_, i) => ata(i + 1))} />);
    expect(screen.getAllByRole("article")).toHaveLength(20);
    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Ata 21" })).toBeTruthy();
    await userEvent.type(screen.getByRole("searchbox"), "Ata 1");
    expect(screen.getByRole("heading", { name: "Ata 1" })).toBeTruthy();
  });

  it("informa quando não há atas disponíveis", () => {
    render(<ConsultaAtas atas={[]} />);
    expect(screen.getByText("Nenhuma ata disponível para consulta.")).toBeTruthy();
  });

  it("busca também em texto original longo, em datas e nos demais campos", () => {
    expect(consultarAtas(atas, "formacao", "", "", "todos")[0].ata.id).toBe(1);
    expect(trechoConsulta(atas[0].texto!, "formacao")).toContain("formação será realizada");
    expect(consultarAtas(atas, "15/10/2026", "", "", "todos").map((r) => r.ata.id)).toEqual([1]);
    for (const campo of Object.keys(CAMPOS_CONSULTA) as (keyof typeof CAMPOS_CONSULTA)[]) {
      expect(consultarAtas([ata(1, { [campo]: "Informação única" })], "informacao", "", "", campo)).toHaveLength(1);
    }
    expect(consultarAtas(atas, "inexistente", "", "", "todos")).toEqual([]);
  });

  it("converte decisões e calendários JSON em trechos legíveis e pesquisáveis", () => {
    const registro = mapearAtaConsulta({ ...ata(3), decisoes: [{ assunto: "Orçamento", responsavel: "João", prazo: "2026-11-05" }], calendario: [{ data: "2026-12-01", evento: "Formação" }], saidas_antecipadas: [] });
    const resultado = consultarAtas([registro], "joao 05/11/2026", "", "", "todos");
    expect(resultado).toHaveLength(1);
    expect(resultado[0].correspondencias[0].texto).toContain("Orçamento · João · 05/11/2026");
    expect(consultarAtas([registro], "formacao", "", "", "calendario")).toHaveLength(1);
  });
});

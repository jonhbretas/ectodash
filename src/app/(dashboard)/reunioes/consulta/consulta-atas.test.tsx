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
  it("começa pela escolha do tipo de pesquisa", () => {
    render(<ConsultaAtas atas={atas} />);
    expect(screen.getByRole("heading", { name: "Como você quer buscar?" })).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("busca uma pessoa além da lista de participantes e permite expandir todas as menções", async () => {
    const texto = `Ana vai revisar a proposta. ${"Contexto sem nomes. ".repeat(40)}Ana confirmou o prazo final.`;
    render(<ConsultaAtas atas={[
      ata(1, { participantes: "Pedro\nJoão", texto }),
      ata(2, { participantes: "Mariana", texto: "Mariana fará a revisão." }),
    ]} meuNome="Ana" />);
    await userEvent.click(screen.getByRole("button", { name: /^Pessoa/ }));
    expect(screen.queryByRole("article")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Buscar meu nome" }));
    expect(screen.getByLabelText("Nome da pessoa").getAttribute("value")).toBe("Ana");
    expect(screen.getByRole("status").textContent).toBe("1 ata encontrada");
    const expandir = screen.getByText("Ver mais trechos (1)");
    await userEvent.click(expandir);
    expect(expandir.closest("details")?.open).toBe(true);
    expect(screen.getByText(/confirmou o prazo final/)).toBeTruthy();
  });

  it("oferece nomes das atas e áreas cadastradas como atalhos", async () => {
    render(<ConsultaAtas atas={[ata(1, { participantes: "- João\nAna", decisoes: "Financeiro revisará os custos." })]} areas={["Financeiro", "Ensino"]} />);
    await userEvent.click(screen.getByRole("button", { name: /^Pessoa/ }));
    await userEvent.click(screen.getByRole("button", { name: "João" }));
    expect(screen.getByRole("status").textContent).toBe("1 ata encontrada");
    await userEvent.click(screen.getByRole("button", { name: "Trocar busca" }));
    await userEvent.click(screen.getByRole("button", { name: /^Área/ }));
    expect(screen.getByLabelText("Nome da área").getAttribute("value")).toBe("");
    await userEvent.click(screen.getByRole("button", { name: "Financeiro" }));
    expect(screen.getByRole("status").textContent).toBe("1 ata encontrada");
    expect(screen.getByRole("heading", { name: "Decisões" })).toBeTruthy();
  });

  it("seleciona uma data pelo atalho e permite substituí-la por um período", async () => {
    render(<ConsultaAtas atas={atas} />);
    await userEvent.click(screen.getByRole("button", { name: /^Data da reunião/ }));
    await userEvent.click(screen.getByRole("button", { name: "15/10/2026" }));
    expect(screen.getByRole("status").textContent).toBe("1 ata encontrada");
    expect(screen.getByRole("heading", { name: "Ata 1" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Buscar por período" }));
    expect(screen.queryByLabelText("Data da reunião")).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-09-01" } });
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByRole("status").textContent).toBe("2 atas encontradas");
  });

  it("localiza deliberações sem acentos, destaca o trecho e mantém o link da fonte", async () => {
    render(<ConsultaAtas atas={atas} />);
    await userEvent.click(screen.getByRole("button", { name: "Assunto" }));
    await userEvent.type(screen.getByRole("searchbox"), "joao orcamento");
    expect(screen.queryByRole("article")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByRole("status").textContent).toBe("1 ata encontrada");
    expect(screen.getByRole("heading", { name: "Deliberações" })).toBeTruthy();
    expect(screen.getByText("João").tagName).toBe("MARK");
    expect(screen.getByRole("link", { name: "Ver ata completa" }).getAttribute("href")).toBe("/reunioes/1");
  });

  it("combina campo e período, valida datas invertidas e limpa os filtros", async () => {
    render(<ConsultaAtas atas={atas} />);
    await userEvent.click(screen.getByRole("button", { name: "Assunto" }));
    await userEvent.type(screen.getByRole("searchbox"), "orcamento");
    await userEvent.click(screen.getByText("Mais opções"));
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-15" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-15" } });
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByRole("status").textContent).toBe("1 ata encontrada");
    await userEvent.selectOptions(screen.getByLabelText("Onde buscar"), "decisoes");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByRole("status").textContent).toBe("0 atas encontradas");
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-09-01" } });
    expect(screen.getByRole("alert").textContent).toContain("data inicial");
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("pagina os resultados e volta à primeira página ao filtrar", async () => {
    render(<ConsultaAtas atas={Array.from({ length: 11 }, (_, i) => ata(i + 1))} />);
    await userEvent.click(screen.getByRole("button", { name: "Assunto" }));
    await userEvent.type(screen.getByRole("searchbox"), "Ata");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getAllByRole("article")).toHaveLength(10);
    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Ata 11" })).toBeTruthy();
    await userEvent.type(screen.getByRole("searchbox"), " 1");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(screen.getByRole("heading", { name: "Ata 1" })).toBeTruthy();
  });

  it("informa quando não há atas disponíveis", async () => {
    render(<ConsultaAtas atas={[]} />);
    expect(screen.getByText("Nenhuma ata disponível para consulta.")).toBeTruthy();
  });

  it("mostra só o tipo escolhido e mantém opções extras recolhidas", async () => {
    render(<ConsultaAtas atas={atas} />);
    await userEvent.click(screen.getByRole("button", { name: "Pessoa" }));
    expect(screen.queryByRole("button", { name: "Área" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Data da reunião" })).toBeNull();
    expect(screen.getByText("Mais opções").closest("details")?.open).toBe(false);
    expect(screen.getByRole("button", { name: "Buscar" }).hasAttribute("disabled")).toBe(true);
    await userEvent.type(screen.getByRole("searchbox"), "João");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("status").textContent).toBe("1 ata encontrada");
    await userEvent.click(screen.getByRole("button", { name: "Trocar busca" }));
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Área" })).toBeTruthy();
  });

  it("recolhe os trechos adicionais para deixar o resultado compacto", async () => {
    render(<ConsultaAtas atas={[ata(1, { participantes: "João", deliberacoes: "João enviará a proposta.", observacoes: "João confirmou presença." })]} />);
    await userEvent.click(screen.getByRole("button", { name: "Pessoa" }));
    await userEvent.type(screen.getByRole("searchbox"), "João");
    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    const expandir = screen.getByText("Ver mais trechos (2)");
    expect(expandir.closest("details")?.open).toBe(false);
    expect(screen.getByRole("heading", { name: "Deliberações" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Observações" }).closest("details")?.open).toBe(false);
    await userEvent.click(expandir);
    expect(screen.getByRole("heading", { name: "Observações" })).toBeTruthy();
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

  it("procura o nome junto e respeita os limites das palavras", () => {
    const registros = [ata(1, { texto: "João Silva revisará o documento." }), ata(2, { texto: "João falará com Maria Silva." }), ata(3, { texto: "Mariana revisará o documento." })];
    expect(consultarAtas(registros, "joao silva", "", "", "todos", "pessoa").map((r) => r.ata.id)).toEqual([1]);
    expect(consultarAtas(registros, "Ana", "", "", "todos", "pessoa")).toHaveLength(0);
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PautaRow } from "../_lib/get-reunioes-data";
vi.mock("./pauta-card", () => ({ default: ({ pauta, numero }: { pauta: PautaRow; numero: number }) => <li>{numero}. {pauta.titulo}</li> }));
import PautasLista from "./pautas-lista";
afterEach(cleanup);
const pautas = [
  { id: 1, titulo: "Formação docente", contexto: "Materiais de apoio", autor: "Ana", criadoPor: "eu", prioridade: "alta" },
  { id: 2, titulo: "Orçamento", contexto: "Nova proposta", autor: "João", criadoPor: "outro", prioridade: "media" },
  { id: 3, titulo: "Reunião da equipe", contexto: "Calendário", autor: "Ana", criadoPor: "eu", prioridade: "baixa" },
] as PautaRow[];

describe("busca e filtros das pautas pendentes", () => {
  it("busca sem acentos no contexto, preserva numeração e limpa filtros", async () => {
    render(<PautasLista pautas={pautas} meuUserId="eu" isCoordenador={false} atasDisponiveis={[]} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar pautas pendentes" }), "calendario");
    expect(screen.getByRole("listitem").textContent).toBe("3. Reunião da equipe");
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
  it("combina autoria e prioridade e informa quando não há resultados", async () => {
    render(<PautasLista pautas={pautas} meuUserId="eu" isCoordenador={false} atasDisponiveis={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Minhas pautas" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    await userEvent.selectOptions(screen.getByRole("combobox"), "media");
    expect(screen.getByText("Nenhuma pauta com esses filtros")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("0 de 3");
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ mesclarEventosEmMassa: vi.fn() }));
import MergeEventosSection from "./merge-eventos-section";

afterEach(cleanup);
const eventos = [
  { id: 3, titulo: "Curso de Ectoplasmia", data_evento: "2027-01-05", local: "Online" },
  { id: 2, titulo: "Imersão  em  Ectoplasmia", data_evento: "2026-11-22", local: "Foz" },
  { id: 1, titulo: "Curso de Ectoplasmia", data_evento: "2026-11-03", local: null },
];

describe("escolha do evento definitivo para mesclar", () => {
  it("separa mês e ano, ordena por dia e mantém nome, data e local visíveis", async () => {
    render(<MergeEventosSection eventos={eventos} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Escolha o evento definitivo" }));
    const lista = screen.getByRole("listbox");
    const grupos = within(lista).getAllByRole("group");
    expect(grupos.map((grupo) => grupo.getAttribute("aria-labelledby")).map((id) => document.getElementById(id!)?.textContent))
      .toEqual(["Novembro de 2026", "Janeiro de 2027"]);
    const novembro = within(grupos[0]).getAllByRole("option");
    expect(novembro.map((opcao) => opcao.textContent)).toEqual([
      "03/11/2026 — Curso de Ectoplasmia",
      "22/11/2026 — Imersão em EctoplasmiaFoz",
    ]);
    await userEvent.click(novembro[0]);
    expect(screen.getByRole("combobox").textContent).toContain("03/11/2026 — Curso de Ectoplasmia");
    expect(screen.queryByRole("checkbox", { name: "Marcar Curso de Ectoplasmia como duplicado" })).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("encontra duplicados usando datas no formato brasileiro", async () => {
    render(<MergeEventosSection eventos={eventos} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Filtrar eventos duplicados" }), "22/11/2026");
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(screen.getByRole("checkbox").getAttribute("aria-label")).toContain("Imersão");
  });
});

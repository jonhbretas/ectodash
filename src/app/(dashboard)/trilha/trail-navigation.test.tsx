// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrailTabs from "./trail-tabs";
import TrailDocenteFlowchart from "./trail-docente-flowchart";

const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
  useRouter: () => ({ replace: navigation.replace }),
}));
vi.mock("../journey-actions", () => ({ registrarExploracao: vi.fn() }));
afterEach(cleanup);
beforeEach(() => navigation.replace.mockReset());

describe("links diretos da jornada", () => {
  it("abre a aba docente indicada no link da tela inicial", () => {
    navigation.query = "tab=docente&etapa=livro";
    render(<TrailTabs tabs={[{ id: "voluntario", label: "Voluntário", icon: "users" }, { id: "docente", label: "Docente", icon: "graduation" }]}>
      <div>Roteiro voluntário</div><div>Roteiro docente</div>
    </TrailTabs>);
    expect(screen.getByRole("tab", { name: "Docente" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Roteiro docente");
  });

  it("abre o caminho docente escolhido e confirma a etapa correspondente", () => {
    navigation.query = "tab=docente&etapa=proep";
    render(<TrailDocenteFlowchart completedIds={[]} />);
    expect(screen.getByRole("heading", { name: "PROEP" })).toBeTruthy();
    expect(screen.getByText("Possibilidade de atuação")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Conheci esta etapa/ })).toBeTruthy();
  });

  it("troca a aba preservando a pessoa consultada e removendo a etapa anterior", async () => {
    navigation.query = "tab=docente&etapa=proep&voluntario=42";
    render(<TrailTabs tabs={[{ id: "voluntario", label: "Voluntário", icon: "users" }, { id: "docente", label: "Docente", icon: "graduation" }]}>
      <div>Roteiro voluntário</div><div>Roteiro docente</div>
    </TrailTabs>);
    await userEvent.click(screen.getByRole("tab", { name: "Voluntário" }));
    expect(navigation.replace).toHaveBeenCalledWith("/trilha?tab=voluntario&voluntario=42", { scroll: false });
  });
});

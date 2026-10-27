// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomeJourney from "./home-journey";

afterEach(cleanup);

describe("jornada na tela inicial", () => {
  it("retoma a próxima etapa e abre a trilha docente no destino correto", async () => {
    render(<HomeJourney completedIds={["voluntario:boas-vindas", "docente:livro"]} availableSystemIds={["sistema:perfil"]} canViewTrails />);
    expect(screen.getByRole("link", { name: /Continuar jornada/ }).getAttribute("href")).toBe("/trilha?tab=voluntario&etapa=fundamentos");
    await userEvent.click(screen.getByRole("tab", { name: "Docente" }));
    expect(screen.getByRole("link", { name: /Continuar jornada/ }).getAttribute("href")).toBe("/trilha?tab=docente&etapa=curso-ead");
    expect(screen.getByText("40 XP de exploração")).toBeTruthy();
  });

  it("não oferece módulos indisponíveis", async () => {
    render(<HomeJourney completedIds={[]} availableSystemIds={["sistema:perfil"]} canViewTrails={false} />);
    expect(screen.queryByRole("tab", { name: "Docente" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Explore a agenda/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Dar o primeiro passo/ }).getAttribute("href")).toBe("/perfil");
  });

  it("informa indisponibilidade sem exibir XP fictício", () => {
    render(<HomeJourney completedIds={[]} availableSystemIds={["sistema:perfil"]} canViewTrails unavailable />);
    expect(screen.getByText("Seu progresso está temporariamente indisponível.")).toBeTruthy();
    expect(screen.queryByText("0 XP de exploração")).toBeNull();
  });
});

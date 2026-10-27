// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JourneyStepButton from "./journey-step-button";

const save = vi.hoisted(() => vi.fn());
vi.mock("../journey-actions", () => ({ registrarExploracao: save }));
afterEach(cleanup);
beforeEach(() => save.mockReset());

describe("confirmação de exploração", () => {
  it("salva somente a etapa confirmada e apresenta falhas com opção de tentar novamente", async () => {
    save.mockResolvedValue({ error: "Não foi possível salvar. Tente novamente." });
    render(<JourneyStepButton stepId="docente:livro" completedIds={[]} />);
    await userEvent.click(screen.getByRole("button", { name: /Conheci esta etapa/ }));
    expect(save).toHaveBeenCalledExactlyOnceWith("docente:livro");
    expect(screen.getByRole("status").textContent).toContain("Não foi possível salvar");
    expect(screen.queryByText(/Etapa explorada/)).toBeNull();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });

  it("impede confirmar novamente e oferece a próxima descoberta", () => {
    render(<JourneyStepButton stepId="docente:livro" completedIds={["docente:livro"]} />);
    expect((screen.getByRole("button", { name: /Etapa explorada/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("link", { name: /Próxima etapa/ }).getAttribute("href")).toBe("/trilha?tab=docente&etapa=curso-ead");
    expect(save).not.toHaveBeenCalled();
  });
});

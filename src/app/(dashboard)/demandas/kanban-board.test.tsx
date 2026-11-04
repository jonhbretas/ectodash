// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import KanbanBoard, { type KanbanDemanda } from "./kanban-board";

const mocks = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn() }));
vi.mock("./actions", () => ({ updateDemandaStatus: mocks.update }));
vi.mock("./quick-create", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/use-stored-preference", () => ({ useStoredPreference: () => ["", vi.fn()] }));

const demanda: KanbanDemanda = {
  id: 42, titulo: "Preparar evento", responsavelEmails: [], prazo: "",
  status: "pendente", atrasada: false, area: null,
};

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("movimentação de demandas", () => {
  it("move imediatamente e aguarda a confirmação sem pedir outro refresh", async () => {
    let resolve!: (value: { ok: boolean; message: string }) => void;
    mocks.update.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<KanbanBoard demandas={[demanda]} />);
    await userEvent.click(screen.getByRole("button", { name: 'Mover "Preparar evento" para Em andamento' }));
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(42, "em_andamento");
    expect(screen.getByRole("button", { name: 'Mover "Preparar evento" para Concluída' }).hasAttribute("disabled")).toBe(true);
    await act(async () => resolve({ ok: true, message: "Atualizada" }));
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: 'Mover "Preparar evento" para Pendente' }).hasAttribute("disabled")).toBe(false);
  });

  it("restaura o cartão se o servidor rejeitar a alteração", async () => {
    mocks.update.mockResolvedValue({ ok: false, message: "Sem permissão." });
    render(<KanbanBoard demandas={[demanda]} />);
    await userEvent.click(screen.getByRole("button", { name: 'Marcar "Preparar evento" como concluída' }));
    expect((await screen.findByRole("alert")).textContent).toBe("Sem permissão.");
    expect(screen.getByRole("button", { name: 'Mover "Preparar evento" para Em andamento' }).hasAttribute("disabled")).toBe(false);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("restaura o cartão e permite tentar de novo se a conexão falhar", async () => {
    mocks.update.mockRejectedValueOnce(new Error("offline"));
    render(<KanbanBoard demandas={[demanda]} />);
    await userEvent.click(screen.getByRole("button", { name: 'Marcar "Preparar evento" como concluída' }));
    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível mover");
    mocks.update.mockResolvedValue({ ok: true, message: "Atualizada" });
    await userEvent.click(screen.getByRole("button", { name: 'Marcar "Preparar evento" como concluída' }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });
});

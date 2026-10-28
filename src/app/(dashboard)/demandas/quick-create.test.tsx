// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuickCreate from "./quick-create";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./quick-create-actions", () => ({ criarTarefaCoordenacao: create }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe("quick coordination task creation", () => {
  it("creates with only a title and keeps details optional", async () => {
    create.mockResolvedValue({ ok: true, id: 10, message: "Tarefa criada." });
    const user = userEvent.setup();
    render(<QuickCreate />);
    await user.click(screen.getByRole("button", { name: "Adicionar tarefa" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Nome da tarefa" }));
    await user.type(screen.getByRole("textbox"), "Planejar reunião{Enter}");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ titulo: "Planejar reunião", status: "pendente", prazo: undefined }));
    expect((await screen.findByRole("link", { name: "Abrir detalhes" })).getAttribute("href")).toBe("/demandas/10/editar");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
  });

  it("offers an explicit merge when a matching task exists", async () => {
    create.mockResolvedValueOnce({ ok: false, message: "Já existe", duplicates: [{ id: 7, titulo: "Reunião" }] })
      .mockResolvedValueOnce({ ok: true, id: 7, message: "Mesclada" });
    const user = userEvent.setup();
    render(<QuickCreate status="em_andamento" area="Gestão" />);
    await user.click(screen.getByRole("button", { name: "Adicionar tarefa: Em andamento" }));
    await user.type(screen.getByRole("textbox"), "Reunião{Enter}");
    await user.click(await screen.findByRole("button", { name: /Mesclar com/ }));
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ titulo: "Reunião", status: "em_andamento", area: "Gestão", mesclarId: 7 }));
    await screen.findByRole("link", { name: "Abrir detalhes" });
  });

  it("uses the calendar day without requiring other fields", async () => {
    create.mockResolvedValue({ ok: true, id: 12, message: "Criada" });
    const user = userEvent.setup();
    render(<QuickCreate compact prazo="2026-10-28" />);
    await user.click(screen.getByRole("button", { name: "Adicionar tarefa em 2026-10-28" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.type(screen.getByRole("textbox"), "Preparar agenda{Enter}");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ prazo: "2026-10-28", titulo: "Preparar agenda" }));
    await screen.findByRole("link", { name: "Abrir detalhes" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("preserves the title after a failure and lets the user retry", async () => {
    create.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    render(<QuickCreate />);
    await user.click(screen.getByRole("button", { name: "Adicionar tarefa" }));
    await user.type(screen.getByRole("textbox"), "Minha tarefa{Enter}");
    await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Minha tarefa");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

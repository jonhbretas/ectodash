// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./pauta-actions", () => ({ marcarPautaDiscutida: vi.fn() }));
import { marcarPautaDiscutida } from "./pauta-actions";
import PautaDiscutirButton from "./pauta-discutir-button";

afterEach(cleanup);
beforeEach(() => {
  vi.mocked(marcarPautaDiscutida).mockReset().mockResolvedValue({ ok: true });
});

describe("marcar pauta discutida dentro da reunião", () => {
  it("usa a reunião atual quando seleciona Esta reunião", async () => {
    render(<PautaDiscutirButton pautaId={12} ataId={34} />);
    await userEvent.click(screen.getByRole("button", { name: "Discutida nesta reunião" }));
    await userEvent.click(screen.getByRole("button", { name: "Esta reunião" }));
    await waitFor(() => expect(marcarPautaDiscutida).toHaveBeenCalledWith(12, 34, undefined));
  });

  it("envia apenas a data ao selecionar uma reunião sem ata", async () => {
    render(<PautaDiscutirButton pautaId={12} ataId={34} />);
    await userEvent.click(screen.getByRole("button", { name: "Discutida nesta reunião" }));
    const opcao = screen.getAllByRole("button", { name: /Sem ata/ })[0];
    const [dia, mes, ano] = opcao.textContent!.split(" — ")[0].split("/");
    await userEvent.click(opcao);
    await waitFor(() => expect(marcarPautaDiscutida).toHaveBeenCalledWith(12, undefined, `${ano}-${mes}-${dia}`));
  });

  it("mostra a falha retornada pela gravação", async () => {
    vi.mocked(marcarPautaDiscutida).mockResolvedValue({ ok: false, message: "Sem permissão para alterar a pauta." });
    render(<PautaDiscutirButton pautaId={12} ataId={34} />);
    await userEvent.click(screen.getByRole("button", { name: "Discutida nesta reunião" }));
    await userEvent.click(screen.getByRole("button", { name: "Esta reunião" }));
    expect(await screen.findByText("Sem permissão para alterar a pauta.")).toBeTruthy();
  });
});

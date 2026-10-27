// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnexoPreview from "./anexo-preview";
afterEach(cleanup);

describe("anexo no cartão da pauta", () => {
  it("carrega a imagem pela rota do sistema e mostra o nome fora da imagem", () => {
    const { container } = render(<AnexoPreview pautaId={12} driveId="drive-file" url="https://drive.google.com/file/d/drive-file/view" nome="Material.png" />);
    const image = container.querySelector("img")!;
    expect(image.getAttribute("src")).toBe("/api/pautas/12/anexo/preview?v=drive-file");
    expect(screen.getByText("Carregando prévia…")).toBeTruthy();
    fireEvent.load(image);
    expect(screen.queryByText("Carregando prévia…")).toBeNull();
    expect(screen.getByText("Material.png")).toBeTruthy();
  });
  it("substitui a imagem quebrada por uma alternativa que ainda abre o anexo", async () => {
    const { container } = render(<AnexoPreview pautaId={12} driveId="drive-file" url="https://drive.google.com/file/d/drive-file/view" nome="Material.png" />);
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Prévia indisponível")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Visualizar: Material.png" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Abrir no Drive/ }).getAttribute("href")).toContain("drive-file/view");
  });
  it("tenta carregar o novo anexo quando um arquivo que falhou é substituído", () => {
    const { container, rerender } = render(<AnexoPreview pautaId={12} driveId="old" url="https://drive.google.com" nome="Material.png" />);
    fireEvent.error(container.querySelector("img")!);
    rerender(<AnexoPreview pautaId={12} driveId="new" url="https://drive.google.com" nome="Novo.png" />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain("v=new");
    expect(screen.queryByText("Prévia indisponível")).toBeNull();
  });
});

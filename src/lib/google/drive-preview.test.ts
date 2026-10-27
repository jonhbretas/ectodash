import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDrivePreview } from "./drive-preview";

vi.mock("./oauth", () => ({ getGoogleAccessToken: async () => "private-google-token" }));
const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
const metadata = (file: object) => new Response(JSON.stringify(file), { headers: { "Content-Type": "application/json" } });
const image = () => new Response("image bytes", { headers: { "Content-Type": "image/png" } });

describe("prévia de anexos do Drive", () => {
  it("obtém a miniatura atual com autenticação no servidor", async () => {
    fetchMock.mockResolvedValueOnce(metadata({ thumbnailLink: "https://lh3.googleusercontent.com/preview", mimeType: "image/png", size: "100" })).mockResolvedValueOnce(image());
    expect((await fetchDrivePreview("file-id")).headers.get("content-type")).toBe("image/png");
    expect(fetchMock.mock.calls[0][0]).toContain("/files/file-id?fields=");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer private-google-token");
  });

  it("usa a imagem original quando o Drive ainda não gerou miniatura", async () => {
    fetchMock.mockResolvedValueOnce(metadata({ mimeType: "image/png", size: "100" })).mockResolvedValueOnce(image());
    await fetchDrivePreview("new-image");
    expect(fetchMock.mock.calls[1][0]).toContain("/files/new-image?alt=media");
  });

  it.each(["html", "network"])("recupera a imagem após falha da miniatura: %s", async (failure) => {
    fetchMock.mockResolvedValueOnce(metadata({ thumbnailLink: "https://lh3.googleusercontent.com/expired", mimeType: "image/png", size: "100" }));
    if (failure === "network") fetchMock.mockRejectedValueOnce(new Error("offline"));
    else fetchMock.mockResolvedValueOnce(new Response("login", { headers: { "Content-Type": "text/html" } }));
    fetchMock.mockResolvedValueOnce(image());
    expect((await fetchDrivePreview("image")).ok).toBe(true);
    expect(fetchMock.mock.calls[2][0]).toContain("alt=media");
  });

  it("não envia a credencial a um domínio estranho", async () => {
    fetchMock.mockResolvedValueOnce(metadata({ thumbnailLink: "https://googleusercontent.com.attacker.invalid/file", mimeType: "image/png", size: "100" })).mockResolvedValueOnce(image());
    await fetchDrivePreview("image");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("https://www.googleapis.com/");
  });

  it("não baixa um vídeo inteiro quando a miniatura está em processamento", async () => {
    fetchMock.mockResolvedValueOnce(metadata({ mimeType: "video/mp4", size: "200000000" }));
    await expect(fetchDrivePreview("video")).rejects.toThrow("Prévia ainda indisponível");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("não retorna páginas HTML como imagens", async () => {
    fetchMock.mockResolvedValueOnce(metadata({ mimeType: "image/png", size: "100" })).mockResolvedValueOnce(new Response("login", { headers: { "Content-Type": "text/html" } }));
    await expect(fetchDrivePreview("image")).rejects.toThrow("Prévia ainda indisponível");
  });
});

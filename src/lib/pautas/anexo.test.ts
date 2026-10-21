import { describe, expect, it } from "vitest";
import {
  ANEXO_MAX_BYTES,
  ANEXO_VIDEO_MAX_BYTES,
  tipoDoAnexo,
  formatarTamanho,
  mimeDoAnexo,
  validarAnexo,
} from "./anexo";

describe("validarAnexo", () => {
  it("aceita pdf pequeno", () => {
    expect(validarAnexo({ nome: "ata.pdf", tamanho: 1000 })).toBeNull();
  });
  it("aceita extensão em maiúsculas", () => {
    expect(validarAnexo({ nome: "FOTO.JPG", tamanho: 1000 })).toBeNull();
  });
  it("rejeita tipo não permitido", () => {
    expect(validarAnexo({ nome: "virus.exe", tamanho: 1000 })).toMatch(/permitidos/i);
  });
  it("rejeita arquivo vazio", () => {
    expect(validarAnexo({ nome: "a.pdf", tamanho: 0 })).toBe("O arquivo está vazio.");
  });
  it("rejeita arquivo acima de 25 MB", () => {
    expect(validarAnexo({ nome: "a.pdf", tamanho: ANEXO_MAX_BYTES + 1 })).toBe(
      "O arquivo é grande demais (máx. 25 MB)."
    );
    expect(validarAnexo({ nome: "a.pdf", tamanho: ANEXO_MAX_BYTES })).toBeNull();
  });
});

describe("vídeos e imagens", () => {
  it("aceita vídeo acima de 25 MB até 300 MB", () => {
    expect(validarAnexo({ nome: "reuniao.mp4", tamanho: 100 * 1024 * 1024 })).toBeNull();
    expect(validarAnexo({ nome: "reuniao.MOV", tamanho: ANEXO_VIDEO_MAX_BYTES })).toBeNull();
    expect(validarAnexo({ nome: "reuniao.mp4", tamanho: ANEXO_VIDEO_MAX_BYTES + 1 })).toBe(
      "O vídeo é grande demais (máx. 300 MB)."
    );
  });
  it("classifica o tipo para pré-visualização", () => {
    expect(tipoDoAnexo("foto.webp")).toBe("imagem");
    expect(tipoDoAnexo("clip.webm")).toBe("video");
    expect(tipoDoAnexo("ata.pdf")).toBe("pdf");
    expect(tipoDoAnexo("plan.xlsx")).toBe("documento");
  });
});

describe("mimeDoAnexo", () => {
  it("mapeia extensões", () => {
    expect(mimeDoAnexo("plan.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(mimeDoAnexo("notas.txt")).toBe("text/plain");
    expect(mimeDoAnexo("x.bin")).toBeNull();
  });
});

describe("formatarTamanho", () => {
  it("formata KB e MB em pt-BR", () => {
    expect(formatarTamanho(850 * 1024)).toBe("850 KB");
    expect(formatarTamanho(2.4 * 1024 * 1024)).toBe("2,4 MB");
  });
});

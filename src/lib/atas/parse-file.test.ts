import { describe, expect, it } from "vitest";
import {
  parseArquivoFonte,
  ArquivoNaoSuportadoError,
  ArquivoVazioError,
  ATA_FILE_TEXT_MAX,
} from "./parse-file";

function makeFile(name: string, content: string | ArrayBuffer, type: string) {
  return new File([content], name, { type });
}

describe("parseArquivoFonte", () => {
  it("lê um arquivo .txt como texto simples", async () => {
    const fonte = await parseArquivoFonte(
      makeFile("transcricao.txt", "Primeira linha\nSegunda linha", "text/plain")
    );
    expect(fonte.formato).toBe("txt");
    expect(fonte.nome).toBe("transcricao.txt");
    expect(fonte.texto).toBe("Primeira linha\nSegunda linha");
  });

  it("lê um arquivo .md como texto simples", async () => {
    const fonte = await parseArquivoFonte(
      makeFile("ata.md", "# Reunião\n\nDeliberações...", "text/markdown")
    );
    expect(fonte.formato).toBe("md");
    expect(fonte.texto).toContain("# Reunião");
  });

  it("aceita PDF (formato resolvido pela extensão)", async () => {
    // A minimal but structurally valid PDF — pdf-parse must extract a
    // non-empty page.
    const pdf = makeFile(
      "ata.pdf",
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 72 720 Td (Reuniao teste) Tj ET\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF",
      "application/pdf"
    );
    const fonte = await parseArquivoFonte(pdf);
    expect(fonte.formato).toBe("pdf");
    expect(fonte.texto.length).toBeGreaterThan(0);
  });

  it("rejeita formatos fora de .pdf/.md/.txt", async () => {
    await expect(
      parseArquivoFonte(makeFile("ata.docx", "conteudo", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
    ).rejects.toBeInstanceOf(ArquivoNaoSuportadoError);
    await expect(
      parseArquivoFonte(makeFile("sem-extensao", "conteudo", "text/plain"))
    ).rejects.toBeInstanceOf(ArquivoNaoSuportadoError);
  });

  it("rejeita texto vazio/em branco", async () => {
    await expect(
      parseArquivoFonte(makeFile("vazia.txt", "   \n  ", "text/plain"))
    ).rejects.toBeInstanceOf(ArquivoVazioError);
  });

  it("trunca arquivos maiores que o teto de custo", async () => {
    const grande = "a".repeat(ATA_FILE_TEXT_MAX + 10000);
    const fonte = await parseArquivoFonte(makeFile("grande.txt", grande, "text/plain"));
    expect(fonte.texto.length).toBeLessThanOrEqual(ATA_FILE_TEXT_MAX);
  });
});

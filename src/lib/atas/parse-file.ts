// src/lib/atas/parse-file.ts
// Meeting-source parsing — turns an uploaded file (.pdf/.md/.txt) into
// plain text for the AI analysis. PDFs are parsed server-side (pdf-parse);
// markdown/text are read verbatim. The user's storage decision
// (2026-08-04): only the extracted TEXT is ever persisted — no binary
// blobs in the database — so a PDF here is a one-way conversion into the
// lightweight source kept on the ata.
import { PDFParse } from "pdf-parse";

// Cost guard: analysis runs the AI over the text, so oversized files are
// truncated to the first N characters (the opening and decisions of a
// meeting are the densest part; the same tradeoff as the Tactiq cap in
// demandas/extrair/actions.ts).
export const ATA_FILE_TEXT_MAX = 120000;
export const ATA_PASTE_MAX = 20000;

export type ArquivoFonte = {
  nome: string;
  formato: "pdf" | "md" | "txt";
  texto: string;
};

const EXTENSIONS: Record<string, ArquivoFonte["formato"]> = {
  ".pdf": "pdf",
  ".md": "md",
  ".txt": "txt",
};

export class ArquivoNaoSuportadoError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ArquivoNaoSuportadoError";
  }
}

export class ArquivoVazioError extends Error {
  constructor() {
    super("O arquivo não contém texto legível.");
    this.name = "ArquivoVazioError";
  }
}

// Resolves the format from the file NAME (user-supplied type headers are
// unreliable), then extracts text. Throws ArquivoNaoSuportadoError for
// anything outside .pdf/.md/.txt and ArquivoVazioError for unreadable
// content — callers turn those into friendly messages.
export async function parseArquivoFonte(file: File): Promise<ArquivoFonte> {
  const lowerName = file.name.toLowerCase();
  const dot = lowerName.lastIndexOf(".");
  const extension = dot >= 0 ? lowerName.slice(dot) : "";
  const formato = EXTENSIONS[extension];

  if (!formato) {
    throw new ArquivoNaoSuportadoError(
      "Formato não suportado. Envie um arquivo .pdf, .md ou .txt."
    );
  }

  if (formato === "pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    let texto: string;
    try {
      const result = await parser.getText();
      texto = result.text ?? "";
    } finally {
      await parser.destroy();
    }
    if (texto.trim().length === 0) {
      throw new ArquivoVazioError();
    }
    return {
      nome: file.name,
      formato,
      texto: texto.slice(0, ATA_FILE_TEXT_MAX),
    };
  }

  const texto = await file.text();
  if (texto.trim().length === 0) {
    throw new ArquivoVazioError();
  }
  return {
    nome: file.name,
    formato,
    texto: texto.slice(0, ATA_FILE_TEXT_MAX),
  };
}

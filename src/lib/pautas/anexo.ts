// Regras puras do anexo de pauta (cliente + servidor): tipos, tamanho, mime.

export const ANEXO_MAX_BYTES = 25 * 1024 * 1024;
/** Vídeos vão direto do navegador ao Drive (upload resumável), sem passar pela Vercel. */
export const ANEXO_VIDEO_MAX_BYTES = 300 * 1024 * 1024;
/** Limite do caminho de fallback via server action (bodySizeLimit = 3mb). */
export const ANEXO_DIRETO_MAX_BYTES = Math.floor(2.5 * 1024 * 1024);

const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
};

export type TipoAnexo = "imagem" | "video" | "pdf" | "documento";

export function tipoDoAnexo(nome: string): TipoAnexo {
  const mime = mimeDoAnexo(nome) ?? "";
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "documento";
}

/** Limite de tamanho conforme o tipo (vídeo aceita arquivos maiores). */
export function maxBytesDoAnexo(nome: string): number {
  return tipoDoAnexo(nome) === "video" ? ANEXO_VIDEO_MAX_BYTES : ANEXO_MAX_BYTES;
}

export const ANEXO_ACCEPT = Object.keys(MIME_POR_EXTENSAO)
  .map((ext) => `.${ext}`)
  .join(",");

export function extensaoDoAnexo(nome: string): string {
  const i = nome.lastIndexOf(".");
  if (i < 0 || i === nome.length - 1) return "";
  return nome.slice(i + 1).toLowerCase();
}

export function mimeDoAnexo(nome: string): string | null {
  return MIME_POR_EXTENSAO[extensaoDoAnexo(nome)] ?? null;
}

export function validarAnexo(arquivo: { nome: string; tamanho: number }): string | null {
  if (!mimeDoAnexo(arquivo.nome)) {
    return "Tipos permitidos: PDF, Word, Excel, PowerPoint, imagem (PNG/JPG/GIF/WEBP), vídeo (MP4/MOV/WEBM) ou texto.";
  }
  if (!Number.isFinite(arquivo.tamanho) || arquivo.tamanho <= 0) {
    return "O arquivo está vazio.";
  }
  if (arquivo.tamanho > maxBytesDoAnexo(arquivo.nome)) {
    return tipoDoAnexo(arquivo.nome) === "video"
      ? "O vídeo é grande demais (máx. 300 MB)."
      : "O arquivo é grande demais (máx. 25 MB).";
  }
  return null;
}

export function formatarTamanho(bytes: number): string {
  const MIB = 1024 * 1024;
  if (bytes < MIB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MIB).toFixed(1).replace(".", ",")} MB`;
}

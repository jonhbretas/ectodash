// Regras puras do anexo de pauta (cliente + servidor): tipos, tamanho, mime.

export const ANEXO_MAX_BYTES = 25 * 1024 * 1024;
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
  txt: "text/plain",
};

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
    return "Tipos permitidos: PDF, Word, Excel, PowerPoint, imagem (PNG/JPG) ou texto.";
  }
  if (!Number.isFinite(arquivo.tamanho) || arquivo.tamanho <= 0) {
    return "O arquivo está vazio.";
  }
  if (arquivo.tamanho > ANEXO_MAX_BYTES) {
    return "O arquivo é grande demais (máx. 25 MB).";
  }
  return null;
}

export function formatarTamanho(bytes: number): string {
  const MIB = 1024 * 1024;
  if (bytes < MIB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / MIB).toFixed(1).replace(".", ",")} MB`;
}

import { getGoogleAccessToken } from "./oauth";
import { ANEXO_MAX_BYTES } from "@/lib/pautas/anexo";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

function isImage(response: Response) {
  return response.ok && IMAGE_TYPES.has((response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase());
}

/** URLs de miniatura do Drive expiram e devem ser acessadas pelo servidor. */
export async function fetchDrivePreview(fileId: string): Promise<Response> {
  const token = await getGoogleAccessToken();
  const headers = { Authorization: `Bearer ${token}` };
  const endpoint = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  const metadata = await fetch(`${endpoint}?fields=mimeType,size,thumbnailLink,trashed&supportsAllDrives=true`, {
    headers, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!metadata.ok) throw new Error("Arquivo indisponível no Drive.");
  const file = await metadata.json() as { mimeType?: string; size?: string; thumbnailLink?: string; trashed?: boolean };
  if (file.trashed) throw new Error("Arquivo removido.");

  if (file.thumbnailLink) {
    try {
      const thumbnail = new URL(file.thumbnailLink);
      // A URL vem da API do Google; a credencial só segue para o domínio de imagens.
      if (thumbnail.protocol === "https:" && (thumbnail.hostname === "googleusercontent.com" || thumbnail.hostname.endsWith(".googleusercontent.com"))) {
        const response = await fetch(thumbnail, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
        if (isImage(response)) return response;
        await response.body?.cancel();
      }
    } catch {
      // Uma miniatura expirada/indisponível não impede o uso da imagem original.
    }
  }

  // Imagens recém-enviadas podem ainda não ter uma miniatura gerada.
  const size = Number(file.size);
  if (IMAGE_TYPES.has(file.mimeType ?? "") && Number.isFinite(size) && size > 0 && size <= ANEXO_MAX_BYTES) {
    const response = await fetch(`${endpoint}?alt=media&supportsAllDrives=true`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (isImage(response)) return response;
    await response.body?.cancel();
  }
  throw new Error("Prévia ainda indisponível.");
}

// src/lib/google/drive.ts
// Google Drive operations: copy files, create folders, set permissions.

import { Readable } from "node:stream";
import { google } from "googleapis";
import { getGoogleAccessToken, googleApiRequest } from "./oauth";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

/** Copy an existing file (e.g. spreadsheet template) */
export async function copyDriveFile(sourceFileId: string, newName: string, parentFolderId?: string) {
  const body: Record<string, unknown> = { name: newName };
  if (parentFolderId) body.parents = [parentFolderId];
  return googleApiRequest(`${DRIVE_API}/files/${sourceFileId}/copy`, {
    method: "POST",
    body: JSON.stringify(body),
  }) as Promise<{ id: string; name: string; webViewLink?: string; mimeType?: string }>;
}

/** Create a folder in Drive */
export async function createDriveFolder(name: string, parentFolderId?: string) {
  const body: Record<string, unknown> = { name, mimeType: "application/vnd.google-apps.folder" };
  if (parentFolderId) body.parents = [parentFolderId];
  return googleApiRequest(`${DRIVE_API}/files`, {
    method: "POST",
    body: JSON.stringify(body),
  }) as Promise<{ id: string }>;
}

/** Set link sharing (anyone with link can view; EDIT por link é proibido —
 * auditoria 0063/M4: edição pública sem autenticação compromete a
 * integridade de dados institucionais e vaza PII de alunos). */
export async function setLinkSharing(fileId: string, role: "reader" | "writer" = "reader") {
  if (role === "writer") {
    throw new Error(
      "Compartilhamento público com edição não é permitido — use shareWithEmail."
    );
  }
  return googleApiRequest(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ type: "anyone", role }),
  });
}

/** Get file/folder metadata. Throws 404 if the account has no access. */
export async function getFileMeta(fileId: string) {
  return googleApiRequest(`${DRIVE_API}/files/${fileId}?fields=id,name,mimeType`) as Promise<{ id: string; name: string; mimeType: string }>;
}

/** List files inside a Drive folder (non-recursive, excludes subfolders). */
export async function listFolderFiles(folderId: string) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await googleApiRequest(`${DRIVE_API}/files?q=${q}&fields=files(id,name,mimeType,webViewLink)&pageSize=100`);
  return (res.files ?? []) as Array<{ id: string; name: string; mimeType: string; webViewLink?: string }>;
}

/** Share a file/folder with a specific user by email (e.g. teachers). */
export async function shareWithEmail(fileId: string, email: string, role: "reader" | "writer" = "reader") {
  return googleApiRequest(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: "POST",
    body: JSON.stringify({ type: "user", role, emailAddress: email }),
  });
}

/** Upload a file (buffer) into a Drive folder. Usa a biblioteca googleapis
 * (gaxios → node:http), que lida com o upload do Google de forma confiável —
 * fetch/undici falhava intermitentemente no upload (o Google não reconhecia
 * o corpo multipart/resumable e respondia "Invalid JSON payload received"). */
export async function uploadDriveFile(
  parentFolderId: string,
  fileName: string,
  buffer: Buffer,
  mimeType = "application/pdf"
) {
  const token = await getGoogleAccessToken();
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  const drive = google.drive({ version: "v3", auth });
  const response = await drive.files.create({
    requestBody: { name: fileName, parents: [parentFolderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id,name,webViewLink",
  });
  const data = response.data;
  if (!data.id) {
    throw new Error("Upload para o Google Drive sem resposta válida.");
  }
  return data as { id: string; name: string; webViewLink?: string };
}

// ---------------------------------------------------------------------------
// Anexos de pauta (quick 261021-g5r)
// ---------------------------------------------------------------------------

export type DriveFileDetails = {
  id: string;
  name?: string;
  mimeType?: string;
  size?: string;
  parents?: string[];
  webViewLink?: string;
  trashed?: boolean;
};

/** Detalhes de um arquivo (pais, tamanho, lixeira) para validação de segurança. */
export async function getDriveFileDetails(fileId: string) {
  return googleApiRequest(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,parents,webViewLink,trashed`
  ) as Promise<DriveFileDetails>;
}

/** Procura uma subpasta pelo nome dentro de parentId; cria se não existir. */
export async function findOrCreateChildFolder(parentId: string, name: string) {
  const nomeEscapado = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `'${parentId}' in parents and name = '${nomeEscapado}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const res = await googleApiRequest(`${DRIVE_API}/files?q=${q}&fields=files(id,name)&pageSize=1`);
  const existente = (res.files ?? [])[0] as { id: string } | undefined;
  if (existente?.id) return { id: existente.id };
  return createDriveFolder(name, parentId);
}

/** Move um arquivo para a lixeira do Drive (recuperável). */
export async function trashDriveFile(fileId: string) {
  return googleApiRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: "PATCH",
    body: JSON.stringify({ trashed: true }),
  });
}

/**
 * Abre uma sessão de upload resumável e devolve a URL (header Location).
 * O Google só envia cabeçalhos CORS para a URL da sessão se ela foi aberta com
 * o Origin do navegador; por isso repassamos `origin`. Os bytes do arquivo vão
 * direto do navegador ao Google — nunca passam pelo servidor.
 */
export async function createResumableUploadSession(input: {
  parentFolderId: string;
  fileName: string;
  mimeType: string;
  size: number;
  origin: string;
}) {
  const token = await getGoogleAccessToken();
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": input.mimeType,
        "X-Upload-Content-Length": String(input.size),
        Origin: input.origin,
      },
      body: JSON.stringify({ name: input.fileName, parents: [input.parentFolderId] }),
    }
  );
  if (!response.ok) {
    const texto = await response.text().catch(() => "");
    throw new Error(`Não foi possível iniciar o envio ao Google Drive (${response.status}). ${texto.slice(0, 200)}`);
  }
  const location = response.headers.get("location");
  if (!location) throw new Error("O Google Drive não devolveu a URL de envio.");
  return location;
}

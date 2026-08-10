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

/** Set link sharing (anyone with link can edit/view) */
export async function setLinkSharing(fileId: string, role: "reader" | "writer" = "writer") {
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

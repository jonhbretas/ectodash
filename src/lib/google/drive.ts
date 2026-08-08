// src/lib/google/drive.ts
// Google Drive operations: copy files, create folders, set permissions.

import { googleApiRequest } from "./oauth";

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

// src/lib/contratos/drive-folders.ts
// Garante a estrutura de pastas dos Contratos no Google Drive:
//   Contratos Ectolab (central)/
//     {título do evento}/          ← 1 pasta por evento (ou "Avulsos")
//       {nome do aluno}/           ← 1 pasta por contrato (arquivo PDF dentro)
// As funções são idempotentes: se a pasta já existe (id salvo no banco),
// reutilizam sem criar duplicata.

import { createClient } from "@/lib/supabase/server";
import { createDriveFolder, setLinkSharing } from "@/lib/google/drive";

const CENTRAL_KEY = "central_drive_folder";
const AVULSOS_KEY = "avulsos_drive_folder";

export type FolderRef = { id: string; url: string };

/** Sanitiza um nome para uso em nome de pasta/arquivo no Drive. */
export function sanitizarNome(nome: string): string {
  const semAcentos = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\-_ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return semAcentos || "documento";
}

async function getSetting(key: string): Promise<FolderRef | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contrato_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (!data?.value) return null;
  const [id, url] = data.value.split("|");
  return { id, url };
}

export async function ensureContratosCentralFolder(): Promise<FolderRef> {
  const existing = await getSetting(CENTRAL_KEY);
  if (existing) return existing;

  const folder = await createDriveFolder("Contratos Ectolab");
  const url = `https://drive.google.com/drive/folders/${folder.id}`;
  const supabase = await createClient();
  await supabase.from("contrato_settings").upsert({
    key: CENTRAL_KEY,
    value: `${folder.id}|${url}`,
    updated_at: new Date().toISOString(),
  });
  return { id: folder.id, url };
}

/** Pasta de contratos de um evento — cria dentro da central quando falta. */
export async function ensureEventFolder(eventoId: number, titulo: string): Promise<FolderRef> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contrato_evento_pastas")
    .select("drive_folder_id, drive_folder_url")
    .eq("evento_id", eventoId)
    .maybeSingle();
  if (data?.drive_folder_id) {
    return { id: data.drive_folder_id, url: data.drive_folder_url || "" };
  }

  const central = await ensureContratosCentralFolder();
  const folder = await createDriveFolder(sanitizarNome(titulo), central.id);
  await setLinkSharing(folder.id, "reader");
  const url = `https://drive.google.com/drive/folders/${folder.id}`;

  await supabase.from("contrato_evento_pastas").upsert({
    evento_id: eventoId,
    drive_folder_id: folder.id,
    drive_folder_url: url,
    updated_at: new Date().toISOString(),
  });
  return { id: folder.id, url };
}

/** Pasta compartilhada para contratos sem evento vinculado. */
export async function ensureAvulsosFolder(): Promise<FolderRef> {
  const existing = await getSetting(AVULSOS_KEY);
  if (existing) return existing;

  const central = await ensureContratosCentralFolder();
  const folder = await createDriveFolder("Avulsos", central.id);
  const url = `https://drive.google.com/drive/folders/${folder.id}`;
  const supabase = await createClient();
  await supabase.from("contrato_settings").upsert({
    key: AVULSOS_KEY,
    value: `${folder.id}|${url}`,
    updated_at: new Date().toISOString(),
  });
  return { id: folder.id, url };
}

/** Pasta do aluno dentro da pasta do evento (1 por contrato). */
export async function createAlunoFolder(
  parentFolderId: string,
  alunoNome: string
): Promise<FolderRef> {
  const folder = await createDriveFolder(sanitizarNome(alunoNome), parentFolderId);
  return { id: folder.id, url: `https://drive.google.com/drive/folders/${folder.id}` };
}

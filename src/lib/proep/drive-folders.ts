// src/lib/proep/drive-folders.ts
// Garante a estrutura de pastas do PROEP no Drive:
//   PROEP (central)/
//     PROEP 26 AGO/     ← 1 pasta por turma
// As funções são idempotentes: se a pasta já existe (id salvo no banco),
// reutilizam sem criar duplicata.

import { createClient } from "@/lib/supabase/server";
import { createDriveFolder, setLinkSharing } from "@/lib/google/drive";
import { editionShortLabel } from "./naming";

const CENTRAL_KEY = "central_drive_folder";

export type FolderRef = { id: string; url: string };

export async function getCentralFolder(): Promise<FolderRef | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("proep_settings").select("value").eq("key", CENTRAL_KEY).maybeSingle();
  if (!data?.value) return null;
  const [id, url] = data.value.split("|");
  return { id, url };
}

export async function ensureCentralFolder(): Promise<FolderRef> {
  const existing = await getCentralFolder();
  if (existing) return existing;

  const folder = await createDriveFolder("PROEP");
  const url = `https://drive.google.com/drive/folders/${folder.id}`;
  const supabase = await createClient();
  await supabase.from("proep_settings").upsert({
    key: CENTRAL_KEY,
    value: `${folder.id}|${url}`,
    updated_at: new Date().toISOString(),
  });
  return { id: folder.id, url };
}

export async function getEditionFolder(editionId: number): Promise<{ folder: FolderRef; label: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("proep_edition_config")
    .select("drive_folder_id, drive_folder_url")
    .eq("edition_id", editionId)
    .maybeSingle();
  if (!data?.drive_folder_id) return null;
  const { data: edition } = await supabase
    .from("eventos")
    .select("data_evento")
    .eq("id", editionId)
    .single();
  const label = editionShortLabel(edition?.data_evento ?? null);
  return { folder: { id: data.drive_folder_id, url: data.drive_folder_url || "" }, label };
}

export async function ensureEditionFolder(editionId: number): Promise<{ folder: FolderRef; label: string }> {
  const existing = await getEditionFolder(editionId);
  if (existing) return existing;

  const supabase = await createClient();
  const { data: edition } = await supabase
    .from("eventos")
    .select("titulo, data_evento")
    .eq("id", editionId)
    .single();
  if (!edition) throw new Error("Turma não encontrada");

  const label = editionShortLabel(edition.data_evento ?? null);
  const central = await ensureCentralFolder();
  const folder = await createDriveFolder(label, central.id);
  // Acesso por link para qualquer pessoa (voluntários/coordenadores)
  await setLinkSharing(folder.id, "reader");
  const url = `https://drive.google.com/drive/folders/${folder.id}`;

  await supabase.from("proep_edition_config").upsert({
    edition_id: editionId,
    drive_folder_id: folder.id,
    drive_folder_url: url,
    updated_at: new Date().toISOString(),
  });
  return { folder: { id: folder.id, url }, label };
}

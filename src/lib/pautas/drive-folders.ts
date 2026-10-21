// src/lib/pautas/drive-folders.ts
// Pastas de anexos de pauta no Google Drive:
//   <pasta central dos contratos>/Pautas/<YYYY-MM-DD da reunião | Em espera>/
// Voluntários não podem escrever em contrato_settings (somente coordenação),
// então NÃO gravamos configuração: a busca por nome dentro do pai conhecido
// (find-or-create) é o registro idempotente. Pastas NÃO são compartilhadas
// publicamente — apenas os arquivos (decisão D-02).

import { createClient } from "@/lib/supabase/server";
import { findOrCreateChildFolder } from "@/lib/google/drive";
import type { FolderRef } from "@/lib/contratos/drive-folders";

const CENTRAL_KEY = "central_drive_folder";

function urlDaPasta(id: string) {
  return `https://drive.google.com/drive/folders/${id}`;
}

export async function ensurePautasRootFolder(): Promise<FolderRef> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contrato_settings")
    .select("value")
    .eq("key", CENTRAL_KEY)
    .maybeSingle();

  const centralId = data?.value ? String(data.value).split("|")[0] : "";
  const pasta = centralId
    ? await findOrCreateChildFolder(centralId, "Pautas")
    : await findOrCreateChildFolder("root", "Pautas Ectolab");
  return { id: pasta.id, url: urlDaPasta(pasta.id) };
}

/** nome = "YYYY-MM-DD" ou "Em espera". */
export async function ensurePautaSubfolder(nome: string): Promise<FolderRef> {
  const root = await ensurePautasRootFolder();
  const pasta = await findOrCreateChildFolder(root.id, nome);
  return { id: pasta.id, url: urlDaPasta(pasta.id) };
}

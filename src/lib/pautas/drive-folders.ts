// src/lib/pautas/drive-folders.ts
// Pastas de anexos de pauta no Google Drive:
//   <pasta central>/Reuniões/Pedidos de pauta/Anexos/<YYYY-MM-DD da reunião | Em espera>/
// Voluntários não podem escrever em contrato_settings (somente coordenação),
// então NÃO gravamos configuração: a busca por nome dentro do pai conhecido
// (find-or-create) é o registro idempotente. Pastas NÃO são compartilhadas
// publicamente — apenas os arquivos (decisão D-02).
//
// A busca por nome do Drive (files.list) é eventualmente consistente: logo
// após criar uma pasta ela pode não aparecer. Por isso a validação final
// (pastaDeAnexoValida) NÃO busca por nome — sobe pelos pais do arquivo com
// GET por id (consistente) e confere o caminho até a pasta central.

import { createClient } from "@/lib/supabase/server";
import { findOrCreateChildFolder, getDriveFileDetails } from "@/lib/google/drive";
import type { FolderRef } from "@/lib/contratos/drive-folders";

const CENTRAL_KEY = "central_drive_folder";
const CAMINHO_ANEXOS = ["Reuniões", "Pedidos de pauta", "Anexos"] as const;
const MIME_PASTA = "application/vnd.google-apps.folder";

function urlDaPasta(id: string) {
  return `https://drive.google.com/drive/folders/${id}`;
}

async function pastaCentralId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contrato_settings")
    .select("value")
    .eq("key", CENTRAL_KEY)
    .maybeSingle();
  return data?.value ? String(data.value).split("|")[0] : "";
}

export async function ensurePautasRootFolder(): Promise<FolderRef> {
  let paiId = (await pastaCentralId()) || "root";
  for (const nome of CAMINHO_ANEXOS) {
    paiId = (await findOrCreateChildFolder(paiId, nome)).id;
  }
  return { id: paiId, url: urlDaPasta(paiId) };
}

/** nome = "YYYY-MM-DD" ou "Em espera". */
export async function ensurePautaSubfolder(nome: string): Promise<FolderRef> {
  const root = await ensurePautasRootFolder();
  const pasta = await findOrCreateChildFolder(root.id, nome);
  return { id: pasta.id, url: urlDaPasta(pasta.id) };
}

/**
 * true se `pastaId` é <central>/Reuniões/Pedidos de pauta/Anexos/<nomeSubpasta>.
 * Usado antes de tornar um arquivo público por link (T-g5r-05).
 */
export async function pastaDeAnexoValida(pastaId: string, nomeSubpasta: string): Promise<boolean> {
  const esperado = [nomeSubpasta, ...[...CAMINHO_ANEXOS].reverse()];
  let atualId = pastaId;
  for (const nome of esperado) {
    const pasta = await getDriveFileDetails(atualId);
    if (pasta.mimeType !== MIME_PASTA || pasta.trashed || pasta.name !== nome) return false;
    const pai = pasta.parents?.[0];
    if (!pai) return false;
    atualId = pai;
  }
  const centralId = await pastaCentralId();
  // Sem pasta central configurada o caminho começa no "Meu Drive" da conta.
  return centralId ? atualId === centralId : true;
}

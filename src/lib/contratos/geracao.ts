// src/lib/contratos/geracao.ts
// Núcleo de arquivamento de um contrato no Google Drive: garante as pastas
// (central → evento/avulsos → aluno), gera o PDF e faz o upload. Compartilhado
// entre a criação individual (form) e a geração em lote por evento.
// A pasta do aluno é 1 por contrato (decisão: Contratos Ectolab > Evento > Aluno).

import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadDriveFile } from "@/lib/google/drive";
import {
  ensureEventFolder,
  ensureAvulsosFolder,
  createAlunoFolder,
} from "./drive-folders";
import { carregarContrato, renderizarContratoPdf } from "./render";

export async function arquivarContratoNoDrive(
  supabase: SupabaseClient,
  contratoId: number,
  eventoId: number | null
): Promise<void> {
  const { data: evento } = eventoId
    ? await supabase
        .from("eventos")
        .select("titulo")
        .eq("id", eventoId)
        .single()
    : { data: null };

  const parent = eventoId
    ? await ensureEventFolder(eventoId, evento?.titulo ?? `Evento ${eventoId}`)
    : await ensureAvulsosFolder();

  const completo = await carregarContrato(supabase, contratoId);
  const alunoFolder = await createAlunoFolder(parent.id, completo.contrato.aluno_nome);
  await supabase
    .from("contratos")
    .update({
      drive_pasta_id: alunoFolder.id,
      drive_pasta_url: alunoFolder.url,
    })
    .eq("id", contratoId);

  const { buffer, filename } = await renderizarContratoPdf(completo);
  const arquivo = await uploadDriveFile(alunoFolder.id, filename, buffer);
  await supabase
    .from("contratos")
    .update({
      drive_arquivo_id: arquivo.id,
      drive_arquivo_url: arquivo.webViewLink || null,
    })
    .eq("id", contratoId);
}

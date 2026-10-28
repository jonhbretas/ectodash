import type { SupabaseClient } from "@supabase/supabase-js";

/** A data identifica a reunião; a função do banco mescla tudo sob a mesma transação/RLS. */
export async function salvarReuniaoPorData(
  supabase: SupabaseClient,
  campos: Record<string, unknown> & { titulo: string; data_reuniao: string },
): Promise<{ id: number }> {
  const { data, error } = await supabase.rpc("salvar_reuniao_por_data", { p_dados: campos });
  const id = Number(data);
  if (error || !Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Não foi possível salvar ou mesclar a reunião desta data. Verifique se você tem permissão para editar a ata existente.");
  }
  return { id };
}

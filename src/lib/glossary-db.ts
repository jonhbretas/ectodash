// src/lib/glossary-db.ts
// SERVER-ONLY: leitura do dicionário (glossary_terms) para as análises de
// IA. Usa o cliente de sessão — a RLS (0079) abre leitura a todo
// autenticado, então a tradução funciona na mesma sessão do operador que
// roda a análise. Nunca o service-role.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GlossaryTerm } from "@/lib/glossary";

export async function listarTermosGlossario(
  supabase: SupabaseClient,
  { ativos = true } = {}
): Promise<GlossaryTerm[]> {
  let query = supabase
    .from("glossary_terms")
    .select("id, term, replacement, description, active, criado_por, created_at, updated_at");
  if (ativos) query = query.eq("active", true);
  const { data } = await query.order("term", { ascending: true });
  return (data ?? []) as GlossaryTerm[];
}

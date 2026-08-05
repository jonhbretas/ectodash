// src/lib/destinos-voluntario.ts
// Resolves roster volunteer ids (public.voluntarios) to the effective
// demanda_responsaveis/demanda_membros destination (migration 0020):
// profile_id when the volunteer has a linked auth account, voluntario_id
// otherwise. The roster is the source of truth for WHO a demanda belongs
// to; profiles only add access ("só precisam ser ativados para ter acesso,
// mas mesmo que não entrem todos, precisamos saber quem é o responsável").
import type { SupabaseClient } from "@supabase/supabase-js";

export type DestinoVoluntario =
  | { profile_id: string }
  | { voluntario_id: number };

export async function resolverDestinosVoluntario(
  supabase: SupabaseClient,
  voluntarioIds: number[]
): Promise<DestinoVoluntario[]> {
  const ids = [...new Set(voluntarioIds)];
  if (ids.length === 0) return [];

  const [linkedResult, existentesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, voluntario_id")
      .in("voluntario_id", ids)
      .not("voluntario_id", "is", null),
    supabase.from("voluntarios").select("id").in("id", ids),
  ]);

  const comConta = new Map(
    (linkedResult.data ?? []).map((p) => [p.voluntario_id, p.id])
  );
  const existentes = new Set(
    (existentesResult.data ?? []).map((v) => v.id)
  );

  const destinos: DestinoVoluntario[] = [];
  for (const id of ids) {
    if (!existentes.has(id)) continue;
    const profileId = comConta.get(id);
    if (profileId) {
      destinos.push({ profile_id: profileId });
    } else {
      destinos.push({ voluntario_id: id });
    }
  }
  return destinos;
}

// O contrário do caminho de escrita: dado um destino já persistido
// (profile_id ou voluntario_id), qual é o id do voluntário do roster?
// Usado para normalizar responsáveis/membros na leitura (filtros, diffs).
export async function voluntarioIdDoDestino(
  supabase: SupabaseClient,
  destino: { profile_id?: string | null; voluntario_id?: number | null }
): Promise<number | null> {
  if (destino.voluntario_id) return destino.voluntario_id;
  if (!destino.profile_id) return null;

  const { data: perfil } = await supabase
    .from("profiles")
    .select("voluntario_id")
    .eq("id", destino.profile_id)
    .maybeSingle();

  return perfil?.voluntario_id ?? null;
}

export async function voluntarioIdsDosDestinos(
  supabase: SupabaseClient,
  destinos: { profile_id?: string | null; voluntario_id?: number | null }[]
): Promise<number[]> {
  const profileIds = destinos
    .map((d) => d.profile_id)
    .filter((id): id is string => Boolean(id));

  const voluntarioIdsDiretos = destinos
    .map((d) => d.voluntario_id)
    .filter((id): id is number => Boolean(id));

  const { data: perfis } = profileIds.length
    ? await supabase
        .from("profiles")
        .select("id, voluntario_id")
        .in("id", profileIds)
        .not("voluntario_id", "is", null)
    : { data: [] as { id: string; voluntario_id: number | null }[] };

  const deProfiles = (perfis ?? [])
    .map((p) => p.voluntario_id)
    .filter((id): id is number => Boolean(id));

  return [...new Set([...voluntarioIdsDiretos, ...deProfiles])];
}

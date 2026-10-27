"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { journeySteps } from "@/lib/journey";

export async function registrarExploracao(etapaId: string) {
  if (!journeySteps.some((step) => step.id === etapaId)) {
    return { error: "Etapa inválida." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Entre novamente para salvar seu progresso." };

  const { error } = await supabase.from("jornada_exploracao").upsert(
    { profile_id: user.id, etapa_id: etapaId },
    { onConflict: "profile_id,etapa_id", ignoreDuplicates: true }
  );
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/");
  revalidatePath("/trilha");
  return { success: true };
}

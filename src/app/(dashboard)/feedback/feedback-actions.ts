"use server";

// src/app/(dashboard)/feedback/feedback-actions.ts
// Atualização do status de acompanhamento de um relato (novo → visto →
// resolvido). Apenas o coordenador geral pode — gate de role aqui e a
// RLS da tabela feedback (migration 0056) reforça no banco.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const STATUS_VALIDOS = ["novo", "visto", "resolvido"] as const;

export async function atualizarStatusFeedback(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "coordenador_geral") return;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUS_VALIDOS.includes(status as (typeof STATUS_VALIDOS)[number])) {
    return;
  }

  await supabase.from("feedback").update({ status }).eq("id", id);
  revalidatePath("/feedback");
}

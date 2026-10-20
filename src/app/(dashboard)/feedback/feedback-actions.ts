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

export type ComentarFeedbackState = { ok: boolean; message: string };

// Comentário no fio do relato — autor do relato ou coordenador geral. A RLS
// de feedback_comentarios garante o escopo; o trigger notifica o outro lado.
export async function comentarFeedback(
  feedbackId: string,
  _prev: ComentarFeedbackState,
  formData: FormData
): Promise<ComentarFeedbackState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Entre novamente para comentar." };

  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!conteudo) return { ok: false, message: "Escreva o comentário antes de enviar." };
  if (conteudo.length > 2000) {
    return { ok: false, message: "O comentário pode ter no máximo 2000 caracteres." };
  }

  const { error } = await supabase
    .from("feedback_comentarios")
    .insert({ feedback_id: feedbackId, autor_id: user.id, conteudo });
  if (error) {
    console.error("comentarFeedback: insert failed", error);
    return { ok: false, message: "Não foi possível enviar o comentário. Tente novamente." };
  }

  revalidatePath("/feedback");
  return { ok: true, message: "" };
}

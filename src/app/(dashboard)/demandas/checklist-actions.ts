"use server";

// Checklist + comments actions (Trello-style collaboration, migration
// 0012). All writes are RLS-gated by the parent demanda's edit/visibility
// predicates — the actions themselves only validate and pass through.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/display-name";
import { sendCommentEmail } from "@/lib/notifications/send-comment-email";

export type ChecklistState = { ok: boolean; message: string };
const checklistInitial: ChecklistState = { ok: false, message: "" };

const itemSchema = z
  .string()
  .trim()
  .min(1, "Escreva o item.")
  .max(300);

export async function adicionarItemChecklist(
  demandaId: number,
  prevState: ChecklistState,
  formData: FormData
): Promise<ChecklistState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...checklistInitial, message: "Sessão expirada." };
  }

  const item = itemSchema.safeParse(formData.get("item"));
  if (!item.success) {
    return { ...checklistInitial, message: "Escreva o item do checklist." };
  }

  const { error } = await supabase
    .from("demanda_checklist")
    .insert({ demanda_id: demandaId, item: item.data });

  if (error) {
    console.error("adicionarItemChecklist: insert failed", error);
    return {
      ...checklistInitial,
      message: "Não foi possível adicionar o item.",
    };
  }

  revalidatePath(`/demandas/${demandaId}/editar`);
  return { ok: true, message: "" };
}

export async function alternarItemChecklist(
  itemId: number,
  concluido: boolean
): Promise<ChecklistState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...checklistInitial, message: "Sessão expirada." };
  }

  const { data: item, error: readError } = await supabase
    .from("demanda_checklist")
    .select("demanda_id")
    .eq("id", itemId)
    .single();

  if (readError || !item) {
    return { ...checklistInitial, message: "Item não encontrado." };
  }

  const { error } = await supabase
    .from("demanda_checklist")
    .update({ concluido })
    .eq("id", itemId);

  if (error) {
    console.error("alternarItemChecklist: update failed", error);
    return { ...checklistInitial, message: "Não foi possível atualizar." };
  }

  revalidatePath(`/demandas/${item.demanda_id}/editar`);
  revalidatePath("/");
  return { ok: true, message: "" };
}

export async function removerItemChecklist(
  itemId: number
): Promise<ChecklistState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...checklistInitial, message: "Sessão expirada." };
  }

  const { data: item, error: readError } = await supabase
    .from("demanda_checklist")
    .select("demanda_id")
    .eq("id", itemId)
    .single();

  if (readError || !item) {
    return { ...checklistInitial, message: "Item não encontrado." };
  }

  const { error } = await supabase
    .from("demanda_checklist")
    .delete()
    .eq("id", itemId);

  if (error) {
    console.error("removerItemChecklist: delete failed", error);
    return { ...checklistInitial, message: "Não foi possível remover." };
  }

  revalidatePath(`/demandas/${item.demanda_id}/editar`);
  revalidatePath("/");
  return { ok: true, message: "" };
}

export type ComentarioState = { ok: boolean; message: string };
const comentarioInitial: ComentarioState = { ok: false, message: "" };

const comentarioSchema = z
  .string()
  .trim()
  .min(1, "Escreva um comentário.")
  .max(5000);

// Extracts @mention tokens from the comment and resolves them against the
// volunteers' display names and email local-parts — the same normalization
// used by matchResponsavel, so "@Ana" hits "Ana Beatriz Souza".
function resolverMencoes(
  conteudo: string,
  profiles: { id: string; email: string; full_name?: string | null }[]
): string[] {
  const tokens = new Set(
    (conteudo.match(/@([\wà-úÀ-ÚãõÃÕ.-]+)/g) ?? []).map((token) =>
      token.slice(1).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    )
  );
  if (tokens.size === 0) return [];

  const matched: string[] = [];
  for (const profile of profiles) {
    const haystacks = [profile.email.split("@")[0].toLowerCase()];
    if (profile.full_name) {
      haystacks.push(
        profile.full_name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      );
    }
    for (const token of tokens) {
      if (haystacks.some((haystack) => haystack.includes(token) || token.includes(haystack))) {
        matched.push(profile.email);
        break;
      }
    }
  }
  return matched;
}

export async function comentarDemanda(
  demandaId: number,
  prevState: ComentarioState,
  formData: FormData
): Promise<ComentarioState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...comentarioInitial, message: "Sessão expirada." };
  }

  const conteudo = comentarioSchema.safeParse(formData.get("conteudo"));
  if (!conteudo.success) {
    return { ...comentarioInitial, message: "Escreva um comentário." };
  }

  const { data: demanda, error: demandaError } = await supabase
    .from("demandas")
    .select("titulo")
    .eq("id", demandaId)
    .single();

  if (demandaError || !demanda) {
    return { ...comentarioInitial, message: "Demanda não encontrada." };
  }

  const { data: comentario, error: insertError } = await supabase
    .from("demanda_comentarios")
    .insert({ demanda_id: demandaId, conteudo: conteudo.data })
    .select("id")
    .single();

  if (insertError || !comentario) {
    console.error("comentarDemanda: insert failed", insertError);
    return {
      ...comentarioInitial,
      message: "Não foi possível publicar o comentário.",
    };
  }

  // @mention emails — best effort: a send failure never fails the comment
  // (the comment is already persisted). Resolved server-side against the
  // same RLS-scoped profiles read the responsável select uses.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("ativo", true);

  const mencionados = resolverMencoes(conteudo.data, profiles ?? []);
  if (mencionados.length > 0) {
    const { data: autor } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const autorNome = autor ? displayName(autor) : "Um voluntário";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const link = `${siteUrl}/demandas/${demandaId}/editar`;
    const resend = new Resend(process.env.RESEND_API_KEY);

    for (const email of mencionados) {
      if (email === user.email) continue; // no self-mention email
      const { error: sendError } = await sendCommentEmail({
        resend,
        to: email,
        autorNome,
        demandaTitulo: demanda.titulo,
        comentario: conteudo.data,
        link,
      });
      if (sendError) {
        console.error("comentarDemanda: mention email failed for", email, sendError);
      }
    }
  }

  revalidatePath(`/demandas/${demandaId}/editar`);
  return { ok: true, message: "" };
}

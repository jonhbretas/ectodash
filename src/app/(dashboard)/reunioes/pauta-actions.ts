"use server";

// Pauta server actions — "pedir pauta" and the small lifecycle controls
// (mark discussed / reopen / delete). Every write goes through the pautas
// table's own RLS (0076): any authenticated volunteer can insert a pauta
// (self-authored), only the creator or a coordenador_geral can update or
// delete it. These actions are the UX layer; RLS is the real boundary.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CriarPautaState = {
  ok: boolean;
  message: string;
};

const criarPautaSchema = z.object({
  titulo: z.string().trim().min(1, "Descreva o assunto da pauta.").max(200),
  contexto: z.string().trim().max(3000).optional().or(z.literal("")),
});

export async function criarPauta(
  prevState: CriarPautaState,
  formData: FormData
): Promise<CriarPautaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const parsed = criarPautaSchema.safeParse({
    titulo: formData.get("titulo"),
    contexto: formData.get("contexto"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Descreva o assunto da pauta." };
  }

  // criado_por is never set from client input — the column default derives
  // it from the session (same anti-spoofing discipline as createDemanda).
  const { error } = await supabase.from("pautas").insert({
    titulo: parsed.data.titulo,
    contexto: parsed.data.contexto || null,
    origem: "manual",
    status: "pendente",
  });

  if (error) {
    console.error("criarPauta: insert failed", error);
    return {
      ok: false,
      message: "Não foi possível pedir a pauta agora. Tente novamente.",
    };
  }

  revalidatePath("/reunioes");
  return { ok: true, message: "Pauta adicionada para a próxima reunião." };
}

export type PautaAcaoResult = { ok: boolean; message?: string };

export async function marcarPautaDiscutida(
  pautaId: number,
  ataId: number
): Promise<PautaAcaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Pauta inválida." };
  }

  const aId = Number(ataId);
  if (!Number.isInteger(aId) || aId <= 0) {
    return { ok: false, message: "Escolha a ata da reunião." };
  }

  // status = 'discutida' e o vínculo com a ata andam juntos (CHECK 0077).
  const { error } = await supabase
    .from("pautas")
    .update({ status: "discutida", ata_discutida_id: aId })
    .eq("id", id);

  if (error) {
    console.error("marcarPautaDiscutida: update failed", error);
    return { ok: false, message: "Não foi possível atualizar a pauta." };
  }

  revalidatePath("/reunioes");
  revalidatePath(`/reunioes/${aId}`);
  return { ok: true };
}

export async function reabrirPauta(pautaId: number): Promise<PautaAcaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Pauta inválida." };
  }

  const { error } = await supabase
    .from("pautas")
    .update({ status: "pendente", ata_discutida_id: null })
    .eq("id", id);

  if (error) {
    console.error("reabrirPauta: update failed", error);
    return { ok: false, message: "Não foi possível reabrir a pauta." };
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

export async function excluirPauta(pautaId: number): Promise<PautaAcaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(pautaId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Pauta inválida." };
  }

  const { error } = await supabase.from("pautas").delete().eq("id", id);
  if (error) {
    console.error("excluirPauta: delete failed", error);
    return { ok: false, message: "Não foi possível excluir a pauta." };
  }

  revalidatePath("/reunioes");
  return { ok: true };
}

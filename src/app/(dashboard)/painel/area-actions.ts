"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AreaConfigState = { ok: boolean; message: string };

const nomeSchema = z.string().trim().min(1, "Dê um nome à área.").max(200);

export async function criarAreaInstitucional(
  prevState: AreaConfigState,
  formData: FormData
): Promise<AreaConfigState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const nome = nomeSchema.safeParse(formData.get("nome"));
  if (!nome.success) return { ok: false, message: "Dê um nome à área." };

  const areaMaeIdRaw = formData.get("area_mae_id");
  const areaMaeId = areaMaeIdRaw && areaMaeIdRaw !== "" ? Number(areaMaeIdRaw) : null;

  const { error } = await supabase.from("areas_institucionais").insert({
    nome: nome.data,
    area_mae_id: Number.isFinite(areaMaeId) ? areaMaeId : null,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Já existe uma área com esse nome." };
    return { ok: false, message: "Não foi possível criar a área." };
  }

  revalidatePath("/painel");
  return { ok: true, message: "Área criada." };
}

export async function editarAreaInstitucional(
  prevState: AreaConfigState,
  formData: FormData
): Promise<AreaConfigState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ok: false, message: "Área inválida." };

  const nome = nomeSchema.safeParse(formData.get("nome"));
  if (!nome.success) return { ok: false, message: "Dê um nome à área." };

  const areaMaeIdRaw = formData.get("area_mae_id");
  const areaMaeId = areaMaeIdRaw && areaMaeIdRaw !== "" ? Number(areaMaeIdRaw) : null;

  const { error } = await supabase.from("areas_institucionais").update({
    nome: nome.data,
    area_mae_id: Number.isFinite(areaMaeId) ? areaMaeId : null,
  }).eq("id", id);

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Já existe uma área com esse nome." };
    return { ok: false, message: "Não foi possível editar a área." };
  }

  revalidatePath("/painel");
  return { ok: true, message: "Área atualizada." };
}

export async function excluirAreaInstitucional(
  prevState: AreaConfigState,
  formData: FormData
): Promise<AreaConfigState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ok: false, message: "Área inválida." };

  const { error } = await supabase.from("areas_institucionais").delete().eq("id", id);

  if (error) return { ok: false, message: "Não foi possível excluir a área." };

  revalidatePath("/painel");
  return { ok: true, message: "Área excluída." };
}

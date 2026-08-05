"use server";

// Localidades da Dinâmica DIP — CRUD do cadastro padronizado (migration
// 0024), espelhando areas institucionais (area-actions.ts). RLS é o limite
// real: apenas coordenador_geral insere/altera/remove.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LocalidadeDipState = {
  ok: boolean;
  message: string;
};

const initial: LocalidadeDipState = { ok: false, message: "" };

const localidadeSchema = z.object({
  localidade: z
    .string()
    .trim()
    .min(1, "Dê um nome à localidade.")
    .max(100),
  pais: z.string().trim().min(1, "Informe o país.").max(100),
});

export async function criarLocalidadeDip(
  prevState: LocalidadeDipState,
  formData: FormData
): Promise<LocalidadeDipState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...initial, message: "Sessão expirada." };

  const parsed = localidadeSchema.safeParse({
    localidade: formData.get("localidade"),
    pais: formData.get("pais"),
  });
  if (!parsed.success) {
    return { ...initial, message: "Preencha localidade e país." };
  }

  const { error } = await supabase.from("dip_localidades").insert({
    localidade: parsed.data.localidade,
    pais: parsed.data.pais,
  });

  if (error) {
    console.error("criarLocalidadeDip: insert failed", error);
    return {
      ...initial,
      message:
        error.code === "23505"
          ? "Já existe uma localidade com esse nome."
          : "Não foi possível criar a localidade.",
    };
  }

  revalidatePath("/dips");
  return { ok: true, message: "Localidade cadastrada." };
}

export async function editarLocalidadeDip(
  prevState: LocalidadeDipState,
  formData: FormData
): Promise<LocalidadeDipState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...initial, message: "Sessão expirada." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ...initial, message: "Localidade inválida." };

  const parsed = localidadeSchema.safeParse({
    localidade: formData.get("localidade"),
    pais: formData.get("pais"),
  });
  if (!parsed.success) {
    return { ...initial, message: "Preencha localidade e país." };
  }

  const { error } = await supabase
    .from("dip_localidades")
    .update({
      localidade: parsed.data.localidade,
      pais: parsed.data.pais,
    })
    .eq("id", id);

  if (error) {
    console.error("editarLocalidadeDip: update failed", error);
    return {
      ...initial,
      message:
        error.code === "23505"
          ? "Já existe uma localidade com esse nome."
          : "Não foi possível salvar a localidade.",
    };
  }

  revalidatePath("/dips");
  return { ok: true, message: "Localidade atualizada." };
}

export async function excluirLocalidadeDip(
  prevState: LocalidadeDipState,
  formData: FormData
): Promise<LocalidadeDipState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...initial, message: "Sessão expirada." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ...initial, message: "Localidade inválida." };

  const { error } = await supabase
    .from("dip_localidades")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("excluirLocalidadeDip: delete failed", error);
    return { ...initial, message: "Não foi possível remover a localidade." };
  }

  revalidatePath("/dips");
  return { ok: true, message: "Localidade removida do cadastro." };
}

"use server";

// Localidades dos voluntários — CRUD do cadastro padronizado (migration
// 0025). RLS é o limite real: apenas coordenador_geral insere/altera/remove.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LocalidadeVoluntarioState = {
  ok: boolean;
  message: string;
};

const initial: LocalidadeVoluntarioState = { ok: false, message: "" };

const localidadeSchema = z.object({
  nome: z.string().trim().min(1, "Dê um nome à localidade.").max(100),
});

export async function criarLocalidadeVoluntario(
  prevState: LocalidadeVoluntarioState,
  formData: FormData
): Promise<LocalidadeVoluntarioState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...initial, message: "Sessão expirada." };

  const parsed = localidadeSchema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { ...initial, message: "Dê um nome à localidade." };
  }

  const { error } = await supabase
    .from("voluntario_localidades")
    .insert({ nome: parsed.data.nome });

  if (error) {
    console.error("criarLocalidadeVoluntario: insert failed", error);
    return {
      ...initial,
      message:
        error.code === "23505"
          ? "Já existe uma localidade com esse nome."
          : "Não foi possível criar a localidade.",
    };
  }

  revalidatePath("/voluntarios");
  revalidatePath("/voluntarios/localidades");
  return { ok: true, message: "Localidade cadastrada." };
}

export async function editarLocalidadeVoluntario(
  prevState: LocalidadeVoluntarioState,
  formData: FormData
): Promise<LocalidadeVoluntarioState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...initial, message: "Sessão expirada." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ...initial, message: "Localidade inválida." };

  const parsed = localidadeSchema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { ...initial, message: "Dê um nome à localidade." };
  }

  const { error } = await supabase
    .from("voluntario_localidades")
    .update({ nome: parsed.data.nome })
    .eq("id", id);

  if (error) {
    console.error("editarLocalidadeVoluntario: update failed", error);
    return {
      ...initial,
      message:
        error.code === "23505"
          ? "Já existe uma localidade com esse nome."
          : "Não foi possível salvar a localidade.",
    };
  }

  revalidatePath("/voluntarios");
  revalidatePath("/voluntarios/localidades");
  return { ok: true, message: "Localidade atualizada." };
}

export async function excluirLocalidadeVoluntario(
  prevState: LocalidadeVoluntarioState,
  formData: FormData
): Promise<LocalidadeVoluntarioState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...initial, message: "Sessão expirada." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ...initial, message: "Localidade inválida." };

  const { error } = await supabase
    .from("voluntario_localidades")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("excluirLocalidadeVoluntario: delete failed", error);
    return { ...initial, message: "Não foi possível remover a localidade." };
  }

  revalidatePath("/voluntarios");
  revalidatePath("/voluntarios/localidades");
  return { ok: true, message: "Localidade removida do cadastro." };
}

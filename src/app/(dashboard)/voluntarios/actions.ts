"use server";

// Volunteer management + self-service profile actions.
// Self path: atualizar_meu_perfil (full_name ONLY — enforced by the
// SECURITY DEFINER function, migration 0014).
// Coordinator path: atualizarVoluntario / alternarAtivoVoluntario — gated
// by the 0002 coordinator UPDATE policy (RLS is the real boundary; a
// non-coordinator's update silently affects zero rows).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PerfilState = { ok: boolean; message: string };
const perfilInitial: PerfilState = { ok: false, message: "" };

const nomeSchema = z
  .string()
  .trim()
  .min(2, "Digite o nome completo.")
  .max(200);

export async function atualizarMeuPerfil(
  prevState: PerfilState,
  formData: FormData
): Promise<PerfilState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...perfilInitial, message: "Sessão expirada." };
  }

  const nome = nomeSchema.safeParse(formData.get("full_name"));
  if (!nome.success) {
    return { ...perfilInitial, message: "Digite seu nome completo." };
  }

  // The SECURITY DEFINER function is the enforcement — it sets exactly
  // full_name for exactly the caller's row, no other column is reachable.
  const { data: ok, error } = await supabase.rpc("atualizar_meu_perfil", {
    novo_nome: nome.data,
  });

  if (error || !ok) {
    console.error("atualizarMeuPerfil: rpc failed", error);
    return { ...perfilInitial, message: "Não foi possível salvar o nome." };
  }

  revalidatePath("/perfil");
  revalidatePath("/");
  return { ok: true, message: "Perfil atualizado." };
}

const roleSchema = z.enum([
  "coordenador_geral",
  "lider_area",
  "voluntario_comum",
  "financeiro",
]);

const voluntarioSchema = z.object({
  full_name: nomeSchema,
  role: roleSchema,
  area_atuacao: z.string().trim().max(200).optional(),
  areas_lideradas: z.string().trim().max(2000).optional(),
});

// Coordinator-only (RLS). Replaces full_name, role, área de atuação and —
// for líderes — the set of led áreas (comma-separated input replaces the
// lider_areas rows wholesale, same replace semantics as the financial
// import).
export async function atualizarVoluntario(
  id: string,
  prevState: PerfilState,
  formData: FormData
): Promise<PerfilState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...perfilInitial, message: "Sessão expirada." };
  }

  const parsed = voluntarioSchema.safeParse({
    full_name: formData.get("full_name"),
    role: formData.get("role"),
    area_atuacao: formData.get("area_atuacao") ?? undefined,
    areas_lideradas: formData.get("areas_lideradas") ?? undefined,
  });

  if (!parsed.success) {
    return { ...perfilInitial, message: "Verifique os campos do formulário." };
  }

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .single();

  if (readError || !profile) {
    return { ...perfilInitial, message: "Voluntário não encontrado." };
  }

  // RLS: only a coordenador_geral's UPDATE policy matches this row — a
  // non-coordinator's update affects zero rows, detected below.
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      role: parsed.data.role,
      area_atuacao: parsed.data.area_atuacao || null,
    })
    .eq("id", id)
    .select("id");

  if (updateError || !updated || updated.length === 0) {
    console.error("atualizarVoluntario: update failed", updateError);
    return {
      ...perfilInitial,
      message:
        "Não foi possível editar o voluntário. Verifique suas permissões.",
    };
  }

  // Áreas lideradas: replace the lider_areas set wholesale for líderes;
  // cleared for any other role.
  const areas = (parsed.data.areas_lideradas ?? "")
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
  const finalAreas = parsed.data.role === "lider_area" ? areas : [];

  const { error: deleteError } = await supabase
    .from("lider_areas")
    .delete()
    .eq("lider_id", id);

  if (deleteError) {
    console.error("atualizarVoluntario: lider_areas delete failed", deleteError);
    return { ...perfilInitial, message: "Erro ao salvar as áreas lideradas." };
  }

  if (finalAreas.length > 0) {
    const { error: insertError } = await supabase.from("lider_areas").insert(
      finalAreas.map((area) => ({ lider_id: id, area }))
    );
    if (insertError) {
      console.error("atualizarVoluntario: lider_areas insert failed", insertError);
      return { ...perfilInitial, message: "Erro ao salvar as áreas lideradas." };
    }
  }

  revalidatePath("/voluntarios");
  revalidatePath(`/voluntarios/${id}`);
  revalidatePath(`/voluntarios/${id}/editar`);
  revalidatePath("/");
  return { ok: true, message: "Voluntário atualizado." };
}

// Soft delete / re-activate (ativo flag). Coordinator-only via RLS.
// useActionState shape: (id bound, prevState, formData) — ativo comes from
// the hidden form field.
export async function alternarAtivoVoluntario(
  id: string,
  prevState: PerfilState,
  formData: FormData
): Promise<PerfilState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...perfilInitial, message: "Sessão expirada." };
  }

  const ativo = formData.get("ativo") === "true";

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ ativo })
    .eq("id", id)
    .select("id");

  if (error || !updated || updated.length === 0) {
    console.error("alternarAtivoVoluntario: update failed", error);
    return {
      ...perfilInitial,
      message:
        "Não foi possível alterar o voluntário. Verifique suas permissões.",
    };
  }

  revalidatePath("/voluntarios");
  revalidatePath(`/voluntarios/${id}`);
  revalidatePath(`/voluntarios/${id}/editar`);
  return {
    ok: true,
    message: ativo ? "Voluntário reativado." : "Voluntário desativado.",
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type DipState = {
  ok: boolean;
  message: string;
};

const initial: DipState = { ok: false, message: "" };

const dataRegex = /^\d{4}-\d{2}-\d{2}$/;

const dipSchema = z.object({
  localidade: z.string().trim().min(1, "Localidade é obrigatória.").max(200),
  pais: z.string().trim().min(1, "País é obrigatório.").max(100),
  data: z
    .string()
    .regex(dataRegex, "Data inválida.")
    .optional()
    .or(z.literal("")),
  participantes: z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    z.union([z.number().int().min(0), z.null()])
  ),
  observacoes: z.string().trim().max(3000).optional(),
});

export async function criarDip(
  prevState: DipState,
  formData: FormData
): Promise<DipState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...initial, message: "Sessão expirada." };

  const parsed = dipSchema.safeParse({
    localidade: formData.get("localidade"),
    pais: formData.get("pais"),
    data: formData.get("data"),
    participantes: formData.get("participantes"),
    observacoes: formData.get("observacoes"),
  });
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Preencha os campos obrigatórios.";
    return { ...initial, message: msg };
  }

  const { error } = await supabase.from("dips").insert({
    localidade: parsed.data.localidade,
    pais: parsed.data.pais,
    data_dip: parsed.data.data || null,
    participantes: parsed.data.participantes,
    observacoes: parsed.data.observacoes || null,
  });

  if (error) {
    console.error("criarDip: insert failed", error);
    return { ...initial, message: "Não foi possível registrar a DIP." };
  }

  revalidatePath("/dips");
  revalidatePath("/dips/cadastro");
  return { ok: true, message: "DIP registrada com sucesso." };
}

// RLS (migration 0015) is the real boundary: only the creator of the record
// or a coordenador_geral can update/delete a DIP.
export async function atualizarDip(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  const parsed = dipSchema.safeParse({
    localidade: formData.get("localidade"),
    pais: formData.get("pais"),
    data: formData.get("data"),
    participantes: formData.get("participantes"),
    observacoes: formData.get("observacoes"),
  });
  if (!parsed.success) return;

  const { error } = await supabase
    .from("dips")
    .update({
      localidade: parsed.data.localidade,
      pais: parsed.data.pais,
      data_dip: parsed.data.data || null,
      participantes: parsed.data.participantes,
      observacoes: parsed.data.observacoes || null,
    })
    .eq("id", id);

  if (error) {
    console.error("atualizarDip: update failed", error);
    return;
  }

  revalidatePath("/dips");
  const ataId = Number(formData.get("ata_id"));
  if (Number.isFinite(ataId)) {
    revalidatePath(`/reunioes/${ataId}`);
  }
}

export async function excluirDip(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  const { error } = await supabase.from("dips").delete().eq("id", id);
  if (error) {
    console.error("excluirDip: delete failed", error);
    return;
  }

  revalidatePath("/dips");
  const ataId = Number(formData.get("ata_id"));
  if (Number.isFinite(ataId)) {
    revalidatePath(`/reunioes/${ataId}`);
  }
}

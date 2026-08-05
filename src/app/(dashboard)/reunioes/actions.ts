"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CriarAtaState = {
  ok: boolean;
  message: string;
};

// Ata fields validated like any other untrusted form input. data_reuniao
// is a plain yyyy-MM-dd string from the native date input; resumo is
// optional free text with a generous cap.
const ataSchema = z.object({
  titulo: z.string().trim().min(1, "Dê um título à ata.").max(200),
  data_reuniao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data válida."),
  resumo: z.string().trim().max(20000).optional().or(z.literal("")),
});

export async function criarAta(
  prevState: CriarAtaState,
  formData: FormData
): Promise<CriarAtaState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const parsed = ataSchema.safeParse({
    titulo: formData.get("titulo"),
    data_reuniao: formData.get("data_reuniao"),
    resumo: formData.get("resumo"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos destacados." };
  }

  // criado_por is never set from client input — the column default
  // derives it from the session, same anti-spoofing discipline as
  // createDemanda (RESEARCH.md Pitfall 4).
  const { data: novaAta, error } = await supabase
    .from("reunioes")
    .insert({
      titulo: parsed.data.titulo,
      data_reuniao: parsed.data.data_reuniao,
      resumo: parsed.data.resumo || null,
    })
    .select("id")
    .single();

  if (error || !novaAta) {
    console.error("criarAta: insert failed", error);
    return {
      ok: false,
      message:
        "Não foi possível salvar a ata agora. Verifique sua internet e tente de novo.",
    };
  }

  // Participantes vinculados ao roster (voluntarios.id) — batched insert,
  // each pair validated as a positive integer. RLS (migration 0023) is the
  // real boundary: only the ata creator or a coordenador_geral can attach.
  const voluntarioIds = (formData.getAll("voluntarioIds") as string[])
    .map((raw) => Number(raw))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (voluntarioIds.length > 0) {
    const { error: linkError } = await supabase
      .from("ata_participantes")
      .insert(voluntarioIds.map((voluntario_id) => ({ ata_id: novaAta.id, voluntario_id })));

    if (linkError) {
      console.error("criarAta: ata_participantes insert failed", linkError);
      return {
        ok: false,
        message:
          "A ata foi salva, mas não foi possível vincular os participantes. Tente editar depois.",
      };
    }
  }

  revalidatePath("/reunioes");
  return { ok: true, message: "Ata registrada com sucesso." };
}

export type AtaParticipanteResult = { ok: boolean; message?: string };

export async function addAtaParticipante(
  ataId: number,
  voluntarioId: string
): Promise<AtaParticipanteResult> {
  const supabase = await createClient();

  const id = Number(voluntarioId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Voluntário inválido." };
  }

  const { error } = await supabase
    .from("ata_participantes")
    .insert({ ata_id: ataId, voluntario_id: id });

  if (error) {
    console.error("addAtaParticipante: insert failed", error);
    return { ok: false, message: "Não foi possível vincular o participante." };
  }

  revalidatePath(`/reunioes/${ataId}`);
  revalidatePath("/reunioes");
  return { ok: true };
}

export async function removeAtaParticipante(
  ataId: number,
  voluntarioId: string
): Promise<AtaParticipanteResult> {
  const supabase = await createClient();

  const id = Number(voluntarioId);
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Voluntário inválido." };
  }

  const { error } = await supabase
    .from("ata_participantes")
    .delete()
    .eq("ata_id", ataId)
    .eq("voluntario_id", id);

  if (error) {
    console.error("removeAtaParticipante: delete failed", error);
    return { ok: false, message: "Não foi possível remover o participante." };
  }

  revalidatePath(`/reunioes/${ataId}`);
  revalidatePath("/reunioes");
  return { ok: true };
}

export async function excluirAta(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const rawId = formData.get("id");
  const id = Number(rawId);
  if (!Number.isFinite(id)) {
    return;
  }

  // RLS (migration 0007) is the real boundary: only the creator or a
  // coordenador_geral can delete. DIPs linked to the ata cascade away
  // (dips.ata_id on delete cascade, migration 0015).
  const { error } = await supabase.from("reunioes").delete().eq("id", id);
  if (error) {
    console.error("excluirAta: delete failed", error);
    return;
  }

  revalidatePath("/reunioes");
  revalidatePath("/dips");
}

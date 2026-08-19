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

export type EditarAtaResult = { ok: boolean; message: string };

// Reuses the same field rules as criarAta plus the structured ata sections
// (pontos_principais, deliberacoes) so the edit form validates like the
// create form — same anti-spoofing discipline (RLS 0007 gates the update).
const editarAtaSchema = z.object({
  titulo: z.string().trim().min(1, "Dê um título à ata.").max(200),
  data_reuniao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Escolha uma data válida."),
  resumo: z.string().trim().max(20000).optional().or(z.literal("")),
  pontos_principais: z.string().trim().max(20000).optional().or(z.literal("")),
  deliberacoes: z.string().trim().max(20000).optional().or(z.literal("")),
});

// Edits an existing ata (any past one) — fields plus the roster-linked
// participants in a single pass. Participant sync is a diff against the
// current ata_participantes rows: removed ids are deleted, new ids inserted.
// RLS (migrations 0007/0023) is the real boundary: only the ata creator or
// a coordenador_geral can update the ata and attach/remove participants.
export async function editarAta(formData: FormData): Promise<EditarAtaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sessão expirada. Faça login novamente." };
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) {
    return { ok: false, message: "Ata inválida." };
  }

  const parsed = editarAtaSchema.safeParse({
    titulo: formData.get("titulo"),
    data_reuniao: formData.get("data_reuniao"),
    resumo: formData.get("resumo"),
    pontos_principais: formData.get("pontos_principais"),
    deliberacoes: formData.get("deliberacoes"),
  });

  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos destacados." };
  }

  const voluntarioIds = (formData.getAll("voluntarioIds") as string[])
    .map((raw) => Number(raw))
    .filter((v) => Number.isInteger(v) && v > 0);

  const { error: updateError } = await supabase
    .from("reunioes")
    .update({
      titulo: parsed.data.titulo,
      data_reuniao: parsed.data.data_reuniao,
      resumo: parsed.data.resumo || null,
      pontos_principais: parsed.data.pontos_principais || null,
      deliberacoes: parsed.data.deliberacoes || null,
    })
    .eq("id", id);

  if (updateError) {
    console.error("editarAta: update failed", updateError);
    return { ok: false, message: "Não foi possível salvar as alterações." };
  }

  const { data: atuais } = await supabase
    .from("ata_participantes")
    .select("voluntario_id")
    .eq("ata_id", id);

  const atuaisSet = new Set((atuais ?? []).map((row) => row.voluntario_id));
  const desejadosSet = new Set(voluntarioIds);
  const remover = [...atuaisSet].filter((v) => !desejadosSet.has(v));
  const adicionar = voluntarioIds.filter((v) => !atuaisSet.has(v));

  if (remover.length > 0) {
    const { error: removeError } = await supabase
      .from("ata_participantes")
      .delete()
      .eq("ata_id", id)
      .in("voluntario_id", remover);

    if (removeError) {
      console.error("editarAta: participant remove failed", removeError);
      return { ok: false, message: "Ata salva, mas os participantes não puderam ser atualizados." };
    }
  }

  if (adicionar.length > 0) {
    const { error: addError } = await supabase
      .from("ata_participantes")
      .insert(adicionar.map((voluntario_id) => ({ ata_id: id, voluntario_id })));

    if (addError) {
      console.error("editarAta: participant insert failed", addError);
      return { ok: false, message: "Ata salva, mas os participantes não puderam ser atualizados." };
    }
  }

  revalidatePath(`/reunioes/${id}`);
  revalidatePath("/reunioes");
  return { ok: true, message: "Ata atualizada." };
}

export type AtaParticipanteResult = { ok: boolean; message?: string };

export async function addAtaParticipante(
  ataId: number,
  voluntarioId: string
): Promise<AtaParticipanteResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

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

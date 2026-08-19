"use server";

// src/app/(dashboard)/dicionario/dicionario-actions.ts
// CRUD do Dicionário (glossary_terms). Todo efeito colateral passa pelo
// gate de coordenador_geral — a RLS (0079) é a fronteira real.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCoordenadorGeral } from "@/lib/role-gates";

export type DicionarioState = { ok: boolean; message: string };

const termoSchema = z.object({
  term: z
    .string()
    .trim()
    .min(1, "Informe o termo (como aparece na transcrição).")
    .max(200),
  replacement: z
    .string()
    .trim()
    .min(1, "Informe o significado (como a IA deve entender).")
    .max(200),
  description: z.string().trim().max(500).optional(),
});

export async function criarTermoGlossario(
  prevState: DicionarioState,
  formData: FormData
): Promise<DicionarioState> {
  let gate;
  try {
    gate = await requireCoordenadorGeral();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Sem permissão." };
  }
  const supabase = gate.supabase;

  const parsed = termoSchema.safeParse({
    term: formData.get("term"),
    replacement: formData.get("replacement"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase.from("glossary_terms").insert({
    term: parsed.data.term,
    replacement: parsed.data.replacement,
    description: parsed.data.description || null,
  });

  if (error) {
    if (String(error.code) === "23505") {
      return { ok: false, message: "Este termo já está cadastrado." };
    }
    console.error("criarTermoGlossario: insert failed", error);
    return { ok: false, message: "Não foi possível cadastrar o termo." };
  }

  revalidatePath("/dicionario");
  return { ok: true, message: "Termo cadastrado." };
}

export async function atualizarTermoGlossario(
  prevState: DicionarioState,
  formData: FormData
): Promise<DicionarioState> {
  let gate;
  try {
    gate = await requireCoordenadorGeral();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Sem permissão." };
  }
  const supabase = gate.supabase;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Termo inválido." };
  }

  const parsed = termoSchema.safeParse({
    term: formData.get("term"),
    replacement: formData.get("replacement"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { error } = await supabase
    .from("glossary_terms")
    .update({
      term: parsed.data.term,
      replacement: parsed.data.replacement,
      description: parsed.data.description || null,
    })
    .eq("id", id);

  if (error) {
    if (String(error.code) === "23505") {
      return { ok: false, message: "Este termo já está cadastrado." };
    }
    console.error("atualizarTermoGlossario: update failed", error);
    return { ok: false, message: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/dicionario");
  return { ok: true, message: "Termo atualizado." };
}

export async function alternarTermoGlossario(
  prevState: DicionarioState,
  formData: FormData
): Promise<DicionarioState> {
  let gate;
  try {
    gate = await requireCoordenadorGeral();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Sem permissão." };
  }
  const supabase = gate.supabase;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Termo inválido." };
  }
  const ativoRaw = formData.get("active");
  const active = ativoRaw === "true" || ativoRaw === "1" || ativoRaw === "on";

  const { error } = await supabase
    .from("glossary_terms")
    .update({ active })
    .eq("id", id);

  if (error) {
    console.error("alternarTermoGlossario: update failed", error);
    return { ok: false, message: "Não foi possível atualizar o termo." };
  }

  revalidatePath("/dicionario");
  return { ok: true, message: active ? "Termo ativado." : "Termo desativado." };
}

export async function excluirTermoGlossario(
  prevState: DicionarioState,
  formData: FormData
): Promise<DicionarioState> {
  let gate;
  try {
    gate = await requireCoordenadorGeral();
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Sem permissão." };
  }
  const supabase = gate.supabase;

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Termo inválido." };
  }

  const { error } = await supabase.from("glossary_terms").delete().eq("id", id);

  if (error) {
    console.error("excluirTermoGlossario: delete failed", error);
    return { ok: false, message: "Não foi possível excluir o termo." };
  }

  revalidatePath("/dicionario");
  return { ok: true, message: "Termo excluído." };
}

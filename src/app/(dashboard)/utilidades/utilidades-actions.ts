"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type UtilidadeState = { ok: boolean; message: string };

const categorias = [
  "ata_fundacao", "estatuto", "logo", "ficha_proposicao",
  "grade_curricular", "links_uteis", "outro",
] as const;

const categoriaLabels: Record<string, string> = {
  "Ata de Fundação": "ata_fundacao",
  "Estatuto": "estatuto",
  "Logos e Identidade Visual": "logo",
  "Ficha de Proposição de Curso": "ficha_proposicao",
  "Grade Curricular — IC": "grade_curricular",
  "Links Úteis": "links_uteis",
  "Outros Documentos": "outro",
};

const tituloSchema = z.string().trim().min(1, "Dê um título.").max(200);
const categoriaSchema = z.string().trim().min(1, "Informe a categoria ou título da utilidade.").max(200);

export async function criarUtilidadeItem(
  prevState: UtilidadeState,
  formData: FormData
): Promise<UtilidadeState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const titulo = tituloSchema.safeParse(formData.get("titulo"));
  if (!titulo.success) return { ok: false, message: "Dê um título ao item." };

  const categoriaRaw = categoriaSchema.safeParse(formData.get("categoria"));
  if (!categoriaRaw.success) return { ok: false, message: "Informe a categoria ou título da utilidade." };
  const categoria = categoriaLabels[categoriaRaw.data] ?? categoriaRaw.data;

  const urlRaw = formData.get("url");
  const url = typeof urlRaw === "string" ? urlRaw.trim() : null;
  const descricaoRaw = formData.get("descricao");
  const descricao = typeof descricaoRaw === "string" ? descricaoRaw.trim() : null;

  const areaIdRaw = formData.get("area_id");
  const area_id = typeof areaIdRaw === "string" && areaIdRaw.trim() !== ""
    ? Number(areaIdRaw)
    : null;

  const tagsRaw = formData.get("tags");
  const tagsStr = typeof tagsRaw === "string" ? tagsRaw.trim() : "";
  const tags = tagsStr
    ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const { error } = await supabase.from("utilidades_itens").insert({
    titulo: titulo.data,
    descricao: descricao || null,
    categoria: categoria,
    url: url || null,
    area_id: area_id && Number.isFinite(area_id) ? area_id : null,
    tags,
  });

  if (error) return { ok: false, message: "Não foi possível salvar o item." };

  revalidatePath("/utilidades");
  return { ok: true, message: "Item adicionado." };
}

export async function excluirUtilidadeItem(
  prevState: UtilidadeState,
  formData: FormData
): Promise<UtilidadeState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ok: false, message: "Item inválido." };

  const { error } = await supabase.from("utilidades_itens").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir o item." };

  revalidatePath("/utilidades");
  return { ok: true, message: "Item removido." };
}

export async function excluirUtilidadeItemSimples(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) {
    await supabase.from("utilidades_itens").delete().eq("id", id);
  }
  revalidatePath("/utilidades");
}

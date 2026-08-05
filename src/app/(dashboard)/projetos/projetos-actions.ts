"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ProjetoState = { ok: boolean; message: string };

const nomeSchema = z.string().trim().min(1, "Dê um nome ao projeto.").max(200);
const descricaoSchema = z.string().trim().max(2000).optional();
const areaSchema = z.string().trim().max(200).optional();
const statusSchema = z.enum(["ativo", "concluido", "cancelado"]);

export async function criarProjeto(
  prevState: ProjetoState,
  formData: FormData
): Promise<ProjetoState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const nome = nomeSchema.safeParse(formData.get("nome"));
  if (!nome.success) return { ok: false, message: "Dê um nome ao projeto." };

  const descricaoRaw = formData.get("descricao");
  const descricao = descricaoSchema.safeParse(typeof descricaoRaw === "string" ? descricaoRaw : undefined);
  const areaRaw = formData.get("area");
  const area = areaSchema.safeParse(typeof areaRaw === "string" ? areaRaw : undefined);
  const statusRaw = formData.get("status");
  const status = statusSchema.safeParse(typeof statusRaw === "string" ? statusRaw : undefined);

  const { error } = await supabase.from("projetos").insert({
    nome: nome.data,
    descricao: descricao.success ? (descricao.data || null) : null,
    area: area.success ? (area.data || null) : null,
    status: status.success ? status.data : "ativo",
  });

  if (error) {
    return { ok: false, message: "Não foi possível criar o projeto." };
  }

  revalidatePath("/projetos");
  return { ok: true, message: "Projeto criado." };
}

export async function editarProjeto(
  prevState: ProjetoState,
  formData: FormData
): Promise<ProjetoState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ok: false, message: "Projeto inválido." };

  const nome = nomeSchema.safeParse(formData.get("nome"));
  if (!nome.success) return { ok: false, message: "Dê um nome ao projeto." };

  const descricaoRaw = formData.get("descricao");
  const descricao = descricaoSchema.safeParse(typeof descricaoRaw === "string" ? descricaoRaw : undefined);
  const areaRaw = formData.get("area");
  const area = areaSchema.safeParse(typeof areaRaw === "string" ? areaRaw : undefined);
  const statusRaw = formData.get("status");
  const status = statusSchema.safeParse(typeof statusRaw === "string" ? statusRaw : undefined);

  const { error } = await supabase.from("projetos").update({
    nome: nome.data,
    descricao: descricao.success ? (descricao.data || null) : null,
    area: area.success ? (area.data || null) : null,
    status: status.success ? status.data : "ativo",
  }).eq("id", id);

  if (error) {
    return { ok: false, message: "Não foi possível editar o projeto." };
  }

  revalidatePath("/projetos");
  return { ok: true, message: "Projeto atualizado." };
}

export async function excluirProjeto(
  prevState: ProjetoState,
  formData: FormData
): Promise<ProjetoState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada." };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ok: false, message: "Projeto inválido." };

  const { error } = await supabase.from("projetos").delete().eq("id", id);
  if (error) return { ok: false, message: "Não foi possível excluir o projeto." };

  revalidatePath("/projetos");
  return { ok: true, message: "Projeto excluído." };
}

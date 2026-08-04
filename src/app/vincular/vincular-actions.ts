"use server";

// Self-link server actions for /vincular — thin wrappers over migration
// 0017's SECURITY DEFINER functions. The functions are the enforcement:
// buscar_voluntarios only answers while the caller's vincular_pendente is
// set; vincular_meu_cadastro links exactly the caller's own row; and
// criar_meu_cadastro creates a fresh roster row for exactly the caller.
// Every function is scoped to auth.uid() — no other profile can be touched
// through this path.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type VincularState = { ok: boolean; message: string };
const initialState: VincularState = { ok: false, message: "" };

export type VoluntarioMatch = {
  cadastro_id: number;
  nome: string;
  unidade: string | null;
  funcao: string | null;
  area_atuacao: string | null;
};

const termoSchema = z.string().trim().max(100);

export async function buscarVoluntarios(
  prevState: VincularState,
  formData: FormData
): Promise<VincularState & { matches?: VoluntarioMatch[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...initialState, message: "Sessão expirada." };
  }

  const raw = formData.get("termo");
  const parsed = termoSchema.safeParse(raw ?? "");
  if (!parsed.success) {
    return { ...initialState, message: "Digite um nome para buscar." };
  }

  const { data, error } = await supabase.rpc("buscar_voluntarios", {
    termo: parsed.data,
  });

  if (error) {
    console.error("buscarVoluntarios: rpc failed", error);
    return { ...initialState, message: "Não foi possível buscar os nomes." };
  }

  return { ok: true, message: "", matches: (data ?? []) as VoluntarioMatch[] };
}

const idSchema = z.coerce.number().int().positive();

export async function vincularCadastro(
  prevState: VincularState,
  formData: FormData
): Promise<VincularState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...initialState, message: "Sessão expirada." };
  }

  const parsed = idSchema.safeParse(formData.get("cadastro_id"));
  if (!parsed.success) {
    return { ...initialState, message: "Cadastro inválido." };
  }

  const { data: ok, error } = await supabase.rpc("vincular_meu_cadastro", {
    cadastro_id: parsed.data,
  });

  if (error || !ok) {
    console.error("vincularCadastro: rpc failed", error);
    return {
      ...initialState,
      message:
        "Não foi possível vincular. Verifique se o cadastro já não foi vinculado a outra conta.",
    };
  }

  return { ok: true, message: "Cadastro vinculado. Bem-vindo(a)!" };
}

const nomeSchema = z.string().trim().min(2).max(200);

export async function criarCadastro(
  prevState: VincularState,
  formData: FormData
): Promise<VincularState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...initialState, message: "Sessão expirada." };
  }

  const parsed = nomeSchema.safeParse(formData.get("nome"));
  if (!parsed.success) {
    return { ...initialState, message: "Digite seu nome completo." };
  }

  const { data: ok, error } = await supabase.rpc("criar_meu_cadastro", {
    nome: parsed.data,
  });

  if (error || !ok) {
    console.error("criarCadastro: rpc failed", error);
    return { ...initialState, message: "Não foi possível criar o cadastro." };
  }

  return { ok: true, message: "Cadastro criado. Bem-vindo(a)!" };
}

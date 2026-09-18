"use server";

// Server actions da tela /painel/acessos (migration 0097): CRUD dos
// modelos de cargo + aplicação do modelo a uma pessoa (cria cargo 0043
// com os módulos do preset). Gate: coordenador_geral — a RLS também
// barra escrita de qualquer outro papel.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULOS_CONCEDIVEIS } from "@/lib/acesso";

export type ModeloState = { ok: boolean; message: string };
const initial: ModeloState = { ok: false, message: "" };

const MODULOS_VALIDOS = [
  "demandas",
  "reunioes",
  "dips",
  "voluntarios",
  "eventos",
  "projetos",
  "pesquisas",
  "proep",
  "analise",
  "analisar",
  "vendas",
  "financeiro",
  "utilidades",
  "marketing",
] as const;

const NIVEIS_VALIDOS = [
  "coordenador_area",
  "coordenador_geral_area",
  "coordenador_localidade",
] as const;

async function exigeCoordenadorGeral() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, erro: "Sessão expirada." as const };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "coordenador_geral")
    return { supabase, erro: "Acesso exclusivo do coordenador geral." as const };
  return { supabase, erro: null };
}

const modeloSchema = z.object({
  nome: z.string().trim().min(2, "Dê um nome ao modelo.").max(120),
  descricao: z.string().trim().max(500).optional(),
  nivel: z.enum(NIVEIS_VALIDOS),
  areaId: z.string().trim().optional(),
  modulos: z.array(z.enum(MODULOS_VALIDOS)).optional(),
});

function parseModulos(formData: FormData): string[] {
  const raw = formData.get("modulos");
  if (typeof raw !== "string" || !raw) return [];
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter((m) =>
      (MODULOS_VALIDOS as readonly string[]).includes(m)
    );
}

export async function criarModelo(
  prevState: ModeloState,
  formData: FormData
): Promise<ModeloState> {
  const { supabase, erro } = await exigeCoordenadorGeral();
  if (erro) return { ...initial, message: erro };

  const parsed = modeloSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") ?? undefined,
    nivel: formData.get("nivel"),
    areaId: formData.get("area_id") ?? undefined,
  });
  if (!parsed.success) return { ...initial, message: "Confira os campos do modelo." };

  const areaId =
    parsed.data.areaId && parsed.data.areaId !== ""
      ? Number(parsed.data.areaId)
      : null;

  const { error } = await supabase.from("cargo_modelos").insert({
    nome: parsed.data.nome,
    descricao: parsed.data.descricao ?? "",
    nivel: parsed.data.nivel,
    area_id: Number.isFinite(areaId) ? areaId : null,
    modulos: parseModulos(formData),
  });
  if (error) {
    if (error.code === "23505")
      return { ...initial, message: "Já existe um modelo com esse nome." };
    console.error("criarModelo: insert failed", error);
    return { ...initial, message: "Não foi possível criar o modelo." };
  }

  revalidatePath("/painel/acessos");
  return { ok: true, message: "Modelo criado." };
}

export async function atualizarModelo(
  prevState: ModeloState,
  formData: FormData
): Promise<ModeloState> {
  const { supabase, erro } = await exigeCoordenadorGeral();
  if (erro) return { ...initial, message: erro };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ...initial, message: "Modelo inválido." };

  const parsed = modeloSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") ?? undefined,
    nivel: formData.get("nivel"),
    areaId: formData.get("area_id") ?? undefined,
  });
  if (!parsed.success) return { ...initial, message: "Confira os campos do modelo." };

  const areaId =
    parsed.data.areaId && parsed.data.areaId !== ""
      ? Number(parsed.data.areaId)
      : null;

  const { error } = await supabase
    .from("cargo_modelos")
    .update({
      nome: parsed.data.nome,
      descricao: parsed.data.descricao ?? "",
      nivel: parsed.data.nivel,
      area_id: Number.isFinite(areaId) ? areaId : null,
      modulos: parseModulos(formData),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    if (error.code === "23505")
      return { ...initial, message: "Já existe um modelo com esse nome." };
    console.error("atualizarModelo: update failed", error);
    return { ...initial, message: "Não foi possível salvar o modelo." };
  }

  revalidatePath("/painel/acessos");
  return { ok: true, message: "Modelo atualizado." };
}

export async function excluirModelo(
  prevState: ModeloState,
  formData: FormData
): Promise<ModeloState> {
  const { supabase, erro } = await exigeCoordenadorGeral();
  if (erro) return { ...initial, message: erro };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { ...initial, message: "Modelo inválido." };

  const { error } = await supabase.from("cargo_modelos").delete().eq("id", id);
  if (error) {
    console.error("excluirModelo: delete failed", error);
    return { ...initial, message: "Não foi possível excluir o modelo." };
  }

  revalidatePath("/painel/acessos");
  return { ok: true, message: "Modelo excluído." };
}

// Aplica o preset a uma pessoa: cria um cargo (0043) com nível/área e os
// módulos do modelo. A RLS de cargos (pode_conceder_cargo) é o limite
// real — como o chamador é coordenador_geral, sempre passa.
export async function aplicarModelo(
  modeloId: number,
  profileId: string,
  areaIdEscolhida?: number | null
): Promise<ModeloState> {
  const { supabase, erro } = await exigeCoordenadorGeral();
  if (erro) return { ...initial, message: erro };

  if (!profileId) return { ...initial, message: "Escolha a pessoa." };

  const { data: modelo } = await supabase
    .from("cargo_modelos")
    .select("nivel, area_id, modulos")
    .eq("id", modeloId)
    .single();
  if (!modelo) return { ...initial, message: "Modelo não encontrado." };

  const nivel = String(modelo.nivel);
  // Modelo de localidade: aplicar pelo perfil do voluntário (precisa da
  // localidade, que esta tela não escolhe).
  if (nivel === "coordenador_localidade") {
    return {
      ...initial,
      message: "Este modelo é de localidade — aplique pelo perfil do voluntário.",
    };
  }
  // Área = a do modelo, ou a escolhida na hora de aplicar (presets
  // funcionais como Eventos/Comunicação não têm área fixa).
  const areaId =
    (modelo.area_id as number | null) ??
    (areaIdEscolhida && Number.isFinite(areaIdEscolhida) ? areaIdEscolhida : null);
  if (areaId === null) {
    return {
      ...initial,
      message: "Escolha a área para aplicar este modelo.",
    };
  }

  const { error: insErr } = await supabase.from("cargos").insert({
    profile_id: profileId,
    nivel,
    area_id: areaId,
    localidade_id: null,
  });
  if (insErr) {
    console.error("aplicarModelo: insert cargo failed", insErr);
    return { ...initial, message: "Não foi possível aplicar (cargo duplicado ou sem permissão)." };
  }

  const { data: cargo } = await supabase
    .from("cargos")
    .select("id")
    .eq("profile_id", profileId)
    .order("id", { ascending: false })
    .limit(1)
    .single();

  const modulos = (modelo.modulos ?? []) as string[];
  if (cargo && modulos.length > 0) {
    const { error: modErr } = await supabase
      .from("cargo_modulos")
      .insert(modulos.map((modulo) => ({ cargo_id: cargo.id, modulo })));
    if (modErr) {
      console.error("aplicarModelo: modules failed", modErr);
      return { ...initial, message: "Cargo criado, mas falha ao salvar os módulos." };
    }
  }

  revalidatePath("/painel/acessos");
  revalidatePath("/voluntarios");
  return { ok: true, message: "Modelo aplicado — cargo criado para a pessoa." };
}

// ── Kill switch global de módulos (0105) ───────────────────────────
// Liga/desliga um módulo p/ todos, menos o coordenador_geral (que
// mantém acesso p/ diagnosticar e reativar). Escrita via service-role
// porque system_module_flags não tem write policy p/ authenticated.
const moduloFlagSchema = z.object({
  modulo: z.enum(MODULOS_CONCEDIVEIS),
  ativo: z.boolean(),
});

export async function alternarModulo(
  modulo: string,
  ativo: boolean
): Promise<ModeloState> {
  const parsed = moduloFlagSchema.safeParse({ modulo, ativo });
  if (!parsed.success) return { ...initial, message: "Módulo inválido." };

  const { erro, userId } = await (async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { erro: "Sessão expirada." as const, userId: null };
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "coordenador_geral")
      return { erro: "Acesso exclusivo do coordenador geral." as const, userId: null };
    return { erro: null, userId: user.id };
  })();
  if (erro) return { ...initial, message: erro };

  const admin = createAdminClient();
  const { error } = await admin.from("system_module_flags").upsert(
    {
      modulo: parsed.data.modulo,
      ativo: parsed.data.ativo,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "modulo" }
  );
  if (error) {
    console.error("alternarModulo: upsert failed", error);
    return { ...initial, message: "Não foi possível salvar." };
  }

  revalidatePath("/painel/acessos");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: parsed.data.ativo ? "Módulo ativado." : "Módulo desativado p/ todos (menos você).",
  };
}

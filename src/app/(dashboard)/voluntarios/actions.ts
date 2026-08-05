"use server";

// Volunteer management + self-service profile actions.
// Self path: atualizarMeuPerfil (full_name ONLY — enforced by the
// SECURITY DEFINER function, migration 0014).
// Roster path: criarVoluntario / atualizarVoluntario — thin wrappers over
// migration 0017's SECURITY DEFINER functions (criar_voluntario /
// atualizar_voluntario), the ONLY write paths to public.voluntarios. The
// functions enforce the manager gate (coordenador_geral | voluntariado |
// coordenador_area scoped to their own áreas), never let a non-geral caller
// assign roles, and sync linked accounts' profiles when a coordenador_geral
// edits role/áreas.
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

const papelSchema = z.enum([
  "coordenador_geral",
  "coordenador_area",
  "voluntario_comum",
  "financeiro",
  "voluntariado",
]);

const dataIsoSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

const campoTexto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .optional();

// Shared field set for create and edit — every field optional except nome.
// Empty strings become null before reaching the RPC (the functions store
// nulls, never empty strings).
const voluntarioDadosSchema = z.object({
  nome: nomeSchema,
  codigo_pf: campoTexto(30),
  unidade: campoTexto(120),
  org_depto: campoTexto(200),
  funcao: campoTexto(200),
  data_inicio: dataIsoSchema.nullish(),
  data_saida: dataIsoSchema.nullish(),
  obs: campoTexto(2000),
  area_atuacao: campoTexto(200),
  papel: papelSchema.optional(),
  areas_lideradas: campoTexto(2000),
});

type VoluntarioDados = z.infer<typeof voluntarioDadosSchema>;

function parseDados(formData: FormData): VoluntarioDados | null {
  const parsed = voluntarioDadosSchema.safeParse({
    nome: formData.get("nome"),
    codigo_pf: formData.get("codigo_pf") ?? undefined,
    unidade: formData.get("unidade") ?? undefined,
    org_depto: formData.get("org_depto") ?? undefined,
    funcao: formData.get("funcao") ?? undefined,
    data_inicio: formData.get("data_inicio") ?? undefined,
    data_saida: formData.get("data_saida") ?? undefined,
    obs: formData.get("obs") ?? undefined,
    area_atuacao: formData.get("area_atuacao") ?? undefined,
    papel: formData.get("papel") ?? undefined,
    areas_lideradas: formData.get("areas_lideradas") ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}

function areasArray(areasTexto: string | null | undefined): string[] {
  return (areasTexto ?? "")
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}

export async function criarVoluntario(
  prevState: PerfilState,
  formData: FormData
): Promise<PerfilState & { novoId?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...perfilInitial, message: "Sessão expirada." };
  }

  const dados = parseDados(formData);
  if (!dados) {
    return { ...perfilInitial, message: "Verifique os campos do formulário." };
  }

  // The SECURITY DEFINER function decides whether this caller may create a
  // row at all (and, for a coordenador_area caller, pins the área to theirs
  // and forces voluntario_comum).
  const { data: novoId, error } = await supabase.rpc("criar_voluntario", {
    p_nome: dados.nome,
    p_codigo_pf: dados.codigo_pf ?? null,
    p_unidade: dados.unidade ?? null,
    p_org_depto: dados.org_depto ?? null,
    p_funcao: dados.funcao ?? null,
    p_data_inicio: dados.data_inicio ?? null,
    p_data_saida: dados.data_saida ?? null,
    p_obs: dados.obs ?? null,
    p_area_atuacao: dados.area_atuacao ?? null,
    p_papel: dados.papel ?? null,
    p_areas_lideradas: areasArray(dados.areas_lideradas),
  });

  if (error || !novoId) {
    console.error("criarVoluntario: rpc failed", error);
    return {
      ...perfilInitial,
      message:
        "Não foi possível cadastrar o voluntário. Verifique suas permissões.",
    };
  }

  revalidatePath("/voluntarios");
  return { ok: true, message: "Voluntário cadastrado.", novoId };
}

export async function atualizarVoluntario(
  id: number,
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

  const dados = parseDados(formData);
  if (!dados) {
    return { ...perfilInitial, message: "Verifique os campos do formulário." };
  }

  const ativo = formData.get("ativo") === "true";

  const { data: ok, error } = await supabase.rpc("atualizar_voluntario", {
    p_cadastro_id: id,
    p_nome: dados.nome,
    p_codigo_pf: dados.codigo_pf ?? null,
    p_unidade: dados.unidade ?? null,
    p_org_depto: dados.org_depto ?? null,
    p_funcao: dados.funcao ?? null,
    p_data_inicio: dados.data_inicio ?? null,
    p_data_saida: dados.data_saida ?? null,
    p_obs: dados.obs ?? null,
    p_area_atuacao: dados.area_atuacao ?? null,
    p_papel: dados.papel ?? null,
    p_areas_lideradas: areasArray(dados.areas_lideradas),
    p_ativo: ativo,
  });

  if (error || !ok) {
    console.error("atualizarVoluntario: rpc failed", error);
    return {
      ...perfilInitial,
      message:
        "Não foi possível editar o voluntário. Verifique suas permissões.",
    };
  }

  revalidatePath("/voluntarios");
  revalidatePath(`/voluntarios/${id}`);
  revalidatePath(`/voluntarios/${id}/editar`);
  revalidatePath("/");
  return { ok: true, message: "Voluntário atualizado." };
}

export type BulkState = { ok: boolean; message: string; processados: number };

export async function atualizarVoluntariosEmMassa(
  prevState: BulkState,
  formData: FormData
): Promise<BulkState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada.", processados: 0 };

  const idsRaw = formData.get("ids");
  if (typeof idsRaw !== "string" || !idsRaw.trim()) {
    return { ok: false, message: "Nenhum voluntário selecionado.", processados: 0 };
  }

  const ids = idsRaw.split(",").map(Number).filter((n) => Number.isFinite(n));
  if (ids.length === 0) {
    return { ok: false, message: "Nenhum voluntário selecionado.", processados: 0 };
  }

  const acao = formData.get("acao");

  if (acao === "desativar") {
    let processados = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("atualizar_voluntario", {
        p_cadastro_id: id,
        p_nome: undefined,
        p_ativo: false,
      });
      if (!error) processados++;
    }
    revalidatePath("/voluntarios");
    return { ok: true, message: `${processados} voluntário(s) desativado(s).`, processados };
  }

  if (acao === "ativar") {
    let processados = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("atualizar_voluntario", {
        p_cadastro_id: id,
        p_nome: undefined,
        p_ativo: true,
      });
      if (!error) processados++;
    }
    revalidatePath("/voluntarios");
    return { ok: true, message: `${processados} voluntário(s) ativado(s).`, processados };
  }

  if (acao === "migrar_area") {
    const novaArea = formData.get("nova_area");
    if (typeof novaArea !== "string" || !novaArea.trim()) {
      return { ok: false, message: "Escolha a nova área.", processados: 0 };
    }

    let processados = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("atualizar_voluntario", {
        p_cadastro_id: id,
        p_nome: undefined,
        p_area_atuacao: novaArea.trim(),
      });
      if (!error) processados++;
    }
    revalidatePath("/voluntarios");
    return { ok: true, message: `${processados} voluntário(s) migrados para "${novaArea.trim()}".`, processados };
  }

  return { ok: false, message: "Ação desconhecida.", processados: 0 };
}

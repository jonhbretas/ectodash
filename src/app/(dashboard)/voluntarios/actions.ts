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
import { ATIVIDADES_VOLUNTARIO } from "@/lib/atividades-voluntario";

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
  telefone1: campoTexto(30),
  telefone2: campoTexto(30),
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
    telefone1: formData.get("telefone1") ?? undefined,
    telefone2: formData.get("telefone2") ?? undefined,
  });
  return parsed.success ? parsed.data : null;
}

function areasArray(areasTexto: string | null | undefined): string[] {
  return (areasTexto ?? "")
    .split(",")
    .map((area) => area.trim())
    .filter(Boolean);
}

// Áreas extras (migration 0027) vêm como JSON no campo "areas".
function areasExtrasDoForm(formData: FormData): string[] {
  const raw = formData.get("areas");
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((a): a is string => typeof a === "string")
      .map((a) => a.trim())
      .filter((a) => a.length > 0 && a.length <= 100)
      .slice(0, 20);
  } catch {
    return [];
  }
}

// Substitui as áreas extras do voluntário (delete + insert) — RLS 0027 é o
// limite real (gestores do roster).
async function salvarAreasExtras(
  supabase: Awaited<ReturnType<typeof createClient>>,
  voluntarioId: number,
  areas: string[]
): Promise<void> {
  const { error: delError } = await supabase
    .from("voluntario_areas")
    .delete()
    .eq("voluntario_id", voluntarioId);
  if (delError) {
    console.error("salvarAreasExtras: delete failed", delError);
    return;
  }
  if (areas.length === 0) return;
  const { error: insError } = await supabase
    .from("voluntario_areas")
    .insert(areas.map((area) => ({ voluntario_id: voluntarioId, area })));
  if (insError) {
    console.error("salvarAreasExtras: insert failed", insError);
  }
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
    p_telefone1: dados.telefone1 ?? null,
    p_telefone2: dados.telefone2 ?? null,
  });

  if (error || !novoId) {
    console.error("criarVoluntario: rpc failed", error);
    return {
      ...perfilInitial,
      message:
        "Não foi possível cadastrar o voluntário. Verifique suas permissões.",
    };
  }

  await salvarAreasExtras(supabase, novoId, areasExtrasDoForm(formData));

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
    p_telefone1: dados.telefone1 ?? null,
    p_telefone2: dados.telefone2 ?? null,
  });

  if (error || !ok) {
    console.error("atualizarVoluntario: rpc failed", error);
    return {
      ...perfilInitial,
      message:
        "Não foi possível editar o voluntário. Verifique suas permissões.",
    };
  }

  await salvarAreasExtras(supabase, id, areasExtrasDoForm(formData));

  revalidatePath("/voluntarios");
  revalidatePath(`/voluntarios/${id}`);
  revalidatePath(`/voluntarios/${id}/editar`);
  revalidatePath("/");
  return { ok: true, message: "Voluntário atualizado." };
}

export type BulkState = { ok: boolean; message: string; processados: number };

type VoluntarioBulkRow = {
  id: number;
  nome: string;
  codigo_pf: string | null;
  unidade: string | null;
  org_depto: string | null;
  funcao: string | null;
  data_inicio: string | null;
  data_saida: string | null;
  obs: string | null;
  area_atuacao: string | null;
  role: string | null;
  ativo: boolean;
  areas_lideradas: string[] | null;
  telefone1: string | null;
  telefone2: string | null;
};

// atualizar_voluntario() sobrescreve TODOS os campos (nome = trim(p_nome),
// ativo = p_ativo, ...) — parâmetro não passado vira NULL e quebra as
// constraints (o bug do "0 voluntários migrados"). A ação em massa então
// repassa os valores ATUAIS de cada voluntário, alterando apenas o campo
// da ação escolhida. O retorno booleano da RPC (false = sem permissão /
// não encontrado) é o que define "processado", não a ausência de erro.
function paramsDaAcao(
  row: VoluntarioBulkRow,
  acao: string,
  novaArea?: string
) {
  return {
    p_cadastro_id: row.id,
    p_nome: row.nome,
    p_codigo_pf: row.codigo_pf,
    p_unidade: row.unidade,
    p_org_depto: row.org_depto,
    p_funcao: row.funcao,
    p_data_inicio: row.data_inicio,
    p_data_saida: row.data_saida,
    p_obs: row.obs,
    p_area_atuacao: acao === "migrar_area" ? (novaArea ?? row.area_atuacao) : row.area_atuacao,
    p_papel: row.role,
    p_areas_lideradas: row.areas_lideradas ?? [],
    p_ativo:
      acao === "ativar" ? true : acao === "desativar" ? false : row.ativo,
    p_telefone1: row.telefone1,
    p_telefone2: row.telefone2,
  };
}

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

  let novaArea: string | undefined;
  if (acao === "migrar_area") {
    const raw = formData.get("nova_area");
    if (typeof raw !== "string" || !raw.trim()) {
      return { ok: false, message: "Escolha a nova área.", processados: 0 };
    }
    novaArea = raw.trim();
  }

  if (acao !== "ativar" && acao !== "desativar" && acao !== "migrar_area") {
    return { ok: false, message: "Ação desconhecida.", processados: 0 };
  }

  const { data: rows } = await supabase
    .from("voluntarios")
    .select(
      "id, nome, codigo_pf, unidade, org_depto, funcao, data_inicio, data_saida, obs, area_atuacao, role, ativo, areas_lideradas, telefone1, telefone2"
    )
    .in("id", ids);

  const porId = new Map((rows ?? []).map((row) => [row.id, row]));

  let processados = 0;
  let negados = 0;
  for (const id of ids) {
    const row = porId.get(id) as VoluntarioBulkRow | undefined;
    if (!row) continue;
    const { data, error } = await supabase.rpc(
      "atualizar_voluntario",
      paramsDaAcao(row, acao, novaArea)
    );
    if (error) {
      console.error("atualizarVoluntariosEmMassa: rpc failed", error, { id });
      continue;
    }
    if (data === true) processados++;
    else negados++;
  }

  revalidatePath("/voluntarios");
  revalidatePath("/");
  revalidatePath("/painel");

  const acaoLabel =
    acao === "ativar" ? "ativado(s)" : acao === "desativar" ? "desativado(s)" : `migrados para "${novaArea}"`;
  const negadosLabel =
    negados > 0
      ? ` · ${negados} sem permissão de edição`
      : "";
  return {
    ok: true,
    message: `${processados} voluntário(s) ${acaoLabel}.${negadosLabel}`,
    processados,
  };
}

// ---------------------------------------------------------------------------
// Situacao de trabalho (ativo/ocioso) + atividades de conscienciologia
// (migration 0026)

// ---------------------------------------------------------------------------
// Merge de cadastros repetidos (migration 0028)

export type MergeState = { ok: boolean; message: string };
const mergeInitial: MergeState = { ok: false, message: "" };

const MERGE_MENSAGENS: Record<string, string> = {
  ok: "Cadastro vinculado ao perfil com sucesso (merge concluído).",
  cadastro_nao_encontrado: "Cadastro não encontrado.",
  perfil_nao_encontrado: "Perfil não encontrado.",
  cadastro_ja_vinculado:
    "Este cadastro já está vinculado a outra conta. Não foi possível mesclar.",
  sem_permissao:
    "Você não tem permissão para mesclar cadastros.",
};

export async function vincularCadastroPerdido(
  cadastroId: number,
  profileId: string
): Promise<MergeState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...mergeInitial, message: "Sessão expirada." };

  if (!Number.isFinite(cadastroId)) {
    return { ...mergeInitial, message: "Cadastro inválido." };
  }

  const { data, error } = await supabase.rpc("mesclar_cadastro_voluntario", {
    p_cadastro_id: cadastroId,
    p_profile_id: profileId,
  });

  if (error) {
    console.error("vincularCadastroPerdido: rpc failed", error);
    return {
      ...mergeInitial,
      message: "Não foi possível mesclar agora. Tente novamente.",
    };
  }

  const resultado = typeof data === "string" ? data : "erro";
  if (resultado === "ok") {
    revalidatePath("/voluntarios");
    revalidatePath("/painel");
  }

  return {
    ok: resultado === "ok",
    message: MERGE_MENSAGENS[resultado] ?? "Não foi possível mesclar agora.",
  };
}


export type SituacaoState = { ok: boolean; message: string };
const situacaoInitial: SituacaoState = { ok: false, message: "" };

export async function atualizarSituacaoVoluntario(
  id: number,
  situacao: string
): Promise<SituacaoState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...situacaoInitial, message: "Sessão expirada." };

  if (!Number.isFinite(id)) return { ...situacaoInitial, message: "Voluntário inválido." };
  if (situacao !== "ativo" && situacao !== "ocioso") {
    return { ...situacaoInitial, message: "Situação inválida." };
  }

  const { data, error } = await supabase.rpc("atualizar_situacao_voluntario", {
    p_cadastro_id: id,
    p_situacao: situacao,
  });

  if (error || data !== true) {
    console.error("atualizarSituacaoVoluntario: rpc failed", error);
    return {
      ...situacaoInitial,
      message: "Você não tem permissão para alterar a situação deste voluntário.",
    };
  }

  revalidatePath("/voluntarios/" + id);
  revalidatePath("/voluntarios");
  revalidatePath("/painel");
  return { ok: true, message: situacao === "ocioso" ? "Voluntário marcado como ocioso." : "Voluntário marcado como ativo." };
}

export type AtividadesState = { ok: boolean; message: string };
const atividadesInitial: AtividadesState = { ok: false, message: "" };

const atividadesSchema = z.object({
  atividades: z.array(
    z.enum(ATIVIDADES_VOLUNTARIO.map((a) => a.value) as [string, ...string[]])
  ).max(20),
});

// Self-service: cada voluntário grava as próprias atividades (RLS 0026
// permite o próprio cadastro ou coordenadores). Diff simples: apaga o que
// saiu, insere o que entrou.
export async function salvarAtividadesVoluntario(
  voluntarioId: number,
  atividades: string[]
): Promise<AtividadesState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ...atividadesInitial, message: "Sessão expirada." };

  if (!Number.isFinite(voluntarioId)) {
    return { ...atividadesInitial, message: "Voluntário inválido." };
  }

  const parsed = atividadesSchema.safeParse({ atividades });
  if (!parsed.success) {
    return { ...atividadesInitial, message: "Atividades inválidas." };
  }
  const desejadas = parsed.data.atividades;

  const { data: atuais } = await supabase
    .from("voluntario_atividades")
    .select("atividade")
    .eq("voluntario_id", voluntarioId);
  const atuaisSet = new Set((atuais ?? []).map((a) => a.atividade));

  const paraRemover = [...atuaisSet].filter((a) => !desejadas.includes(a));
  const paraInserir = desejadas.filter((a) => !atuaisSet.has(a));

  if (paraRemover.length > 0) {
    const { error } = await supabase
      .from("voluntario_atividades")
      .delete()
      .eq("voluntario_id", voluntarioId)
      .in("atividade", paraRemover);
    if (error) {
      console.error("salvarAtividadesVoluntario: delete failed", error);
      return { ...atividadesInitial, message: "Não foi possível salvar as atividades." };
    }
  }

  if (paraInserir.length > 0) {
    const { error } = await supabase
      .from("voluntario_atividades")
      .insert(paraInserir.map((atividade) => ({ voluntario_id: voluntarioId, atividade })));
    if (error) {
      console.error("salvarAtividadesVoluntario: insert failed", error);
      return { ...atividadesInitial, message: "Não foi possível salvar as atividades." };
    }
  }

  revalidatePath("/voluntarios/" + voluntarioId);
  revalidatePath("/perfil");
  return { ok: true, message: "Atividades atualizadas." };
}

// ---------------------------------------------------------------------------
// Merge de cadastros repetidos (migration 0028)


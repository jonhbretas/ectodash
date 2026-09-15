"use server";

// src/app/(dashboard)/ouvidoria/ouvidoria-actions.ts
// Server actions da Ouvidoria: todo acesso ao banco passa pelas funções
// SECURITY DEFINER da migration 0095 (a tabela ouvidoria_relatos não tem
// nenhuma policy direta, então author_id nunca vaza pela Data API).
import { revalidatePath } from "next/cache";
import { requireUsuario } from "@/lib/role-gates";

const CATEGORIAS = [
  "coordenacao_geral",
  "coordenacao_diaria",
  "convivencia_voluntarios",
  "vivencia_pessoal",
  "outro",
] as const;

const STATUS_RELATO = ["novo", "em_analise", "encaminhado", "concluido"] as const;

export type ActionResult = { ok: boolean; error?: string };

function erro(e: unknown, fallback: string): ActionResult {
  const msg = e instanceof Error ? e.message : fallback;
  return { ok: false, error: msg };
}

export async function enviarRelato(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUsuario();
    const categoria = String(formData.get("categoria") ?? "");
    const sentimentoRaw = String(formData.get("sentimento") ?? "").trim();
    const mensagem = String(formData.get("mensagem") ?? "");
    const confirma = formData.get("confirma_respeitoso") === "on";

    if (!CATEGORIAS.includes(categoria as (typeof CATEGORIAS)[number])) {
      return { ok: false, error: "Escolha o tema do relato." };
    }
    if (!confirma) {
      return {
        ok: false,
        error: "Confirme que o relato é respeitoso e fala sobre como você se sente.",
      };
    }

    const { error } = await supabase.rpc("enviar_relato_ouvidoria", {
      p_categoria: categoria,
      p_sentimento: sentimentoRaw || null,
      p_mensagem: mensagem,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/ouvidoria");
    return { ok: true };
  } catch (e) {
    return erro(e, "Não foi possível enviar. Tente de novo.");
  }
}

export async function abrirCiclo(cicloId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireUsuario();
    const { error } = await supabase.rpc("abrir_ciclo_ouvidoria", {
      p_ciclo_id: cicloId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/ouvidoria");
    return { ok: true };
  } catch (e) {
    return erro(e, "Não foi possível abrir o ciclo.");
  }
}

export async function concluirCiclo(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUsuario();
    const cicloId = String(formData.get("ciclo_id") ?? "");
    const resumo = String(formData.get("resumo") ?? "");
    const encaminhamentos = String(formData.get("encaminhamentos") ?? "");
    if (!cicloId) return { ok: false, error: "Ciclo inválido." };
    const { error } = await supabase.rpc("concluir_ciclo_ouvidoria", {
      p_ciclo_id: cicloId,
      p_resumo: resumo || null,
      p_encaminhamentos: encaminhamentos || null,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/ouvidoria");
    return { ok: true };
  } catch (e) {
    return erro(e, "Não foi possível concluir o ciclo.");
  }
}

export async function atualizarRelato(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const { supabase } = await requireUsuario();
    const relatoId = String(formData.get("relato_id") ?? "");
    const status = String(formData.get("status") ?? "");
    const nota = String(formData.get("nota") ?? "");
    if (!relatoId) return { ok: false, error: "Relato inválido." };
    if (!STATUS_RELATO.includes(status as (typeof STATUS_RELATO)[number])) {
      return { ok: false, error: "Status inválido." };
    }
    const { error } = await supabase.rpc("atualizar_relato_colegiado", {
      p_relato_id: relatoId,
      p_status: status,
      p_nota: nota || null,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/ouvidoria");
    return { ok: true };
  } catch (e) {
    return erro(e, "Não foi possível atualizar o relato.");
  }
}

export type RevelacaoResult = ActionResult & {
  autor?: { autor_id: string; full_name: string | null; email: string | null };
};

export async function revelarIdentidade(
  relatoId: string,
  motivo: string
): Promise<RevelacaoResult> {
  try {
    const { supabase } = await requireUsuario();
    if (!relatoId) return { ok: false, error: "Relato inválido." };
    const { data, error } = await supabase.rpc("revelar_identidade_relato", {
      p_relato_id: relatoId,
      p_motivo: motivo,
    });
    if (error) return { ok: false, error: error.message };
    const linha = Array.isArray(data) ? data[0] : null;
    revalidatePath("/ouvidoria");
    return {
      ok: true,
      autor: linha
        ? {
            autor_id: String(linha.autor_id),
            full_name: (linha.full_name as string | null) ?? null,
            email: (linha.email as string | null) ?? null,
          }
        : undefined,
    };
  } catch (e) {
    return erro(e, "Não foi possível revelar a identidade.");
  }
}

export type RelatoAnonimo = {
  id: string;
  categoria: string;
  sentimento: string | null;
  mensagem: string;
  status: string;
  created_at: string;
  nota_colegiado: string | null;
  identidade_revelada: boolean;
};

export async function listarRelatosAnonimos(
  cicloId: string
): Promise<{ ok: boolean; error?: string; relatos?: RelatoAnonimo[] }> {
  try {
    const { supabase } = await requireUsuario();
    const { data, error } = await supabase.rpc("listar_relatos_anonimos", {
      p_ciclo_id: cicloId,
    });
    if (error) return { ok: false, error: error.message };
    const relatos: RelatoAnonimo[] = ((data ?? []) as Array<Record<string, unknown>>).map(
      (r) => ({
        id: String(r.id),
        categoria: String(r.categoria),
        sentimento: (r.sentimento as string | null) ?? null,
        mensagem: String(r.mensagem),
        status: String(r.status),
        created_at: String(r.created_at),
        nota_colegiado: (r.nota_colegiado as string | null) ?? null,
        identidade_revelada: Boolean(r.identidade_revelada),
      })
    );
    return { ok: true, relatos };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao carregar relatos.";
    return { ok: false, error: msg };
  }
}

export type QuebraRow = {
  id: number;
  relato_id: string;
  motivo: string;
  created_at: string;
  revelado_por_nome: string | null;
  autor_nome: string | null;
};

export async function listarQuebras(): Promise<{
  ok: boolean;
  error?: string;
  quebras?: QuebraRow[];
}> {
  try {
    const { supabase } = await requireUsuario();
    const { data, error } = await supabase.rpc("listar_quebras_ouvidoria");
    if (error) return { ok: false, error: error.message };
    const quebras: QuebraRow[] = ((data ?? []) as Array<Record<string, unknown>>).map(
      (q) => ({
        id: Number(q.id),
        relato_id: String(q.relato_id),
        motivo: String(q.motivo),
        created_at: String(q.created_at),
        revelado_por_nome: (q.revelado_por_nome as string | null) ?? null,
        autor_nome: (q.autor_nome as string | null) ?? null,
      })
    );
    return { ok: true, quebras };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao carregar quebras.";
    return { ok: false, error: msg };
  }
}

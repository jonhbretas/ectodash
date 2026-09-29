"use server";

// src/app/(dashboard)/ouvidoria/ouvidoria-actions.ts
// Server actions da Ouvidoria IDENTIFICADA: todo acesso ao banco passa
// pelas funções SECURITY DEFINER da migration 0095 (+ 0109, que expõe a
// autoria ao colegiado). A tabela ouvidoria_relatos não tem nenhuma
// policy direta — a identidade do autor é visível ao colegiado gestor,
// sem anonimato, para evitar uso anti cosmoético do canal.
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

export type RelatoIdentificado = {
  id: string;
  categoria: string;
  sentimento: string | null;
  mensagem: string;
  status: string;
  created_at: string;
  nota_colegiado: string | null;
  autor_id: string | null;
  autor_nome: string | null;
  autor_email: string | null;
};

/** Alias legado — a listagem agora é identificada (0109). */
export type RelatoAnonimo = RelatoIdentificado;

export async function listarRelatos(
  cicloId: string
): Promise<{ ok: boolean; error?: string; relatos?: RelatoIdentificado[] }> {
  try {
    const { supabase } = await requireUsuario();
    const { data, error } = await supabase.rpc("listar_relatos_ouvidoria", {
      p_ciclo_id: cicloId,
    });
    if (error) return { ok: false, error: error.message };
    const relatos: RelatoIdentificado[] = (
      (data ?? []) as Array<Record<string, unknown>>
    ).map((r) => ({
      id: String(r.id),
      categoria: String(r.categoria),
      sentimento: (r.sentimento as string | null) ?? null,
      mensagem: String(r.mensagem),
      status: String(r.status),
      created_at: String(r.created_at),
      nota_colegiado: (r.nota_colegiado as string | null) ?? null,
      autor_id: (r.autor_id as string | null) ?? null,
      autor_nome: (r.autor_nome as string | null) ?? null,
      autor_email: (r.autor_email as string | null) ?? null,
    }));
    return { ok: true, relatos };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao carregar relatos.";
    return { ok: false, error: msg };
  }
}

/** Alias legado — delega para listarRelatos (resultado já identificado). */
export async function listarRelatosAnonimos(
  cicloId: string
): Promise<{ ok: boolean; error?: string; relatos?: RelatoIdentificado[] }> {
  return listarRelatos(cicloId);
}

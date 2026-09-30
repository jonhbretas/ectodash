"use server";

// src/app/(dashboard)/financeiro/propostas/actions.ts
// CRUD das propostas financeiras. Gate real: requireFinanceiro() +
// policies RLS da 0110 (financeiro/coordenador_geral). Marcar como pago
// grava pago_em com a data de hoje; desmarcar limpa pago_em.
import { revalidatePath } from "next/cache";
import { requireFinanceiro } from "@/lib/role-gates";
import {
  brlParaNumero,
  hojeISO,
  propostaSchema,
  type PropostaFormValues,
} from "./proposta-schema";

export type PropostaActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Partial<Record<keyof PropostaFormValues, string>>;
};

const initialState: PropostaActionState = { ok: false, message: "" };

function validar(formData: FormData) {
  return propostaSchema.safeParse({
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    titulo: String(formData.get("titulo") ?? ""),
    contraparte: String(formData.get("contraparte") ?? ""),
    descricao: String(formData.get("descricao") ?? ""),
    valor: String(formData.get("valor") ?? ""),
    metodo: String(formData.get("metodo") ?? ""),
    prazo: String(formData.get("prazo") ?? ""),
    status: String(formData.get("status") ?? "") || undefined,
    sheet_url: String(formData.get("sheet_url") ?? ""),
    observacoes: String(formData.get("observacoes") ?? ""),
  });
}

function errosDoZod(
  fieldErrors: Record<string, string[] | undefined>
): PropostaActionState["fieldErrors"] {
  const out: PropostaActionState["fieldErrors"] = {};
  for (const [campo, msgs] of Object.entries(fieldErrors)) {
    if (msgs?.[0]) out[campo as keyof PropostaFormValues] = msgs[0];
  }
  return out;
}

export async function criarProposta(
  _prev: PropostaActionState,
  formData: FormData
): Promise<PropostaActionState> {
  try {
    const { supabase, user } = await requireFinanceiro();
    const parsed = validar(formData);
    if (!parsed.success) {
      return {
        ...initialState,
        message: "Confira os campos destacados.",
        fieldErrors: errosDoZod(parsed.error.flatten().fieldErrors),
      };
    }
    const v = parsed.data;
    const { error } = await supabase.from("propostas_financeiras").insert({
      titulo: v.titulo,
      contraparte: v.contraparte ?? null,
      descricao: v.descricao ?? null,
      valor: brlParaNumero(v.valor),
      metodo: v.metodo,
      prazo: v.prazo ?? null,
      sheet_url: v.sheet_url ?? null,
      observacoes: v.observacoes ?? null,
      created_by: user.id,
    });
    if (error) {
      console.error("criarProposta: insert failed", error);
      return { ...initialState, message: "Não foi possível salvar. Tente de novo." };
    }
    revalidatePath("/financeiro/propostas");
    return { ok: true, message: "Proposta registrada." };
  } catch (e) {
    return { ...initialState, message: e instanceof Error ? e.message : "Sem permissão." };
  }
}

export async function atualizarProposta(
  _prev: PropostaActionState,
  formData: FormData
): Promise<PropostaActionState> {
  try {
    const { supabase } = await requireFinanceiro();
    const parsed = validar(formData);
    if (!parsed.success || !parsed.data.id) {
      return {
        ...initialState,
        message: !parsed.success
          ? "Confira os campos destacados."
          : "Proposta inválida.",
        fieldErrors: !parsed.success
          ? errosDoZod(parsed.error.flatten().fieldErrors)
          : undefined,
      };
    }
    const v = parsed.data;
    const { error } = await supabase
      .from("propostas_financeiras")
      .update({
        titulo: v.titulo,
        contraparte: v.contraparte ?? null,
        descricao: v.descricao ?? null,
        valor: brlParaNumero(v.valor),
        metodo: v.metodo,
        prazo: v.prazo ?? null,
        status: v.status ?? undefined,
        sheet_url: v.sheet_url ?? null,
        observacoes: v.observacoes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(v.id));
    if (error) {
      console.error("atualizarProposta: update failed", error);
      return { ...initialState, message: "Não foi possível salvar. Tente de novo." };
    }
    revalidatePath("/financeiro/propostas");
    return { ok: true, message: "Proposta atualizada." };
  } catch (e) {
    return { ...initialState, message: e instanceof Error ? e.message : "Sem permissão." };
  }
}

// Alterna pago ↔ pendente. Pago grava pago_em=hoje; voltar a pendente
// limpa pago_em. Cancelado não passa por aqui (só pela edição).
export async function alternarPago(
  id: number,
  pago: boolean
): Promise<{ ok: boolean; message: string }> {
  try {
    const { supabase } = await requireFinanceiro();
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, message: "Proposta inválida." };
    }
    const { error } = await supabase
      .from("propostas_financeiras")
      .update({
        status: pago ? "pago" : "pendente",
        pago_em: pago ? hojeISO() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      console.error("alternarPago: update failed", error);
      return { ok: false, message: "Não foi possível atualizar. Tente de novo." };
    }
    revalidatePath("/financeiro/propostas");
    return { ok: true, message: pago ? "Marcada como paga." : "Voltou para pendente." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sem permissão." };
  }
}

export async function excluirProposta(
  id: number
): Promise<{ ok: boolean; message: string }> {
  try {
    const { supabase } = await requireFinanceiro();
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, message: "Proposta inválida." };
    }
    const { error } = await supabase
      .from("propostas_financeiras")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("excluirProposta: delete failed", error);
      return { ok: false, message: "Não foi possível excluir. Tente de novo." };
    }
    revalidatePath("/financeiro/propostas");
    return { ok: true, message: "Proposta excluída." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sem permissão." };
  }
}

"use server";

// src/app/(dashboard)/financeiro/pagar/actions.ts
// CRUD das contas que a Ectolab precisa pagar. Gate real:
// requireFinanceiro() + RLS da 0112 (financeiro/coordenador_geral).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireFinanceiro } from "@/lib/role-gates";
import { brlParaNumero, hojeISO } from "../propostas/proposta-schema";

const pagarSchema = z.object({
  id: z.string().regex(/^\d+$/, "Conta inválida").optional(),
  titulo: z.string().trim().min(3, "Dê um título com ao menos 3 letras").max(200),
  fornecedor: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  valor: z
    .string()
    .trim()
    .min(1, "Informe o valor")
    .refine((v) => {
      const n = Number(v.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) && n >= 0;
    }, "Valor inválido — use números (ex.: 1.234,56)"),
  vencimento: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "Vencimento inválido"),
  metodo: z.enum([
    "pix",
    "transferencia",
    "boleto",
    "cartao_credito",
    "cartao_debito",
    "dinheiro",
    "outro",
  ]),
  status: z.enum(["pendente", "pago", "cancelado"]).optional(),
  observacoes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type PagarActionState = { ok: boolean; message: string };

const INICIAL: PagarActionState = { ok: false, message: "" };

function validar(formData: FormData) {
  return pagarSchema.safeParse({
    id: formData.get("id") ? String(formData.get("id")) : undefined,
    titulo: String(formData.get("titulo") ?? ""),
    fornecedor: String(formData.get("fornecedor") ?? ""),
    valor: String(formData.get("valor") ?? ""),
    vencimento: String(formData.get("vencimento") ?? ""),
    metodo: String(formData.get("metodo") ?? ""),
    status: String(formData.get("status") ?? "") || undefined,
    observacoes: String(formData.get("observacoes") ?? ""),
  });
}

export async function criarConta(
  _prev: PagarActionState,
  formData: FormData
): Promise<PagarActionState> {
  try {
    const { supabase, user } = await requireFinanceiro();
    const parsed = validar(formData);
    if (!parsed.success) {
      return { ...INICIAL, message: "Confira os campos (título, valor e método)." };
    }
    const v = parsed.data;
    const { error } = await supabase.from("pagamentos_ectolab").insert({
      titulo: v.titulo,
      fornecedor: v.fornecedor ?? null,
      valor: brlParaNumero(v.valor),
      vencimento: v.vencimento ?? null,
      metodo: v.metodo,
      observacoes: v.observacoes ?? null,
      created_by: user.id,
    });
    if (error) {
      console.error("criarConta: insert failed", error);
      return { ...INICIAL, message: "Não foi possível salvar. Tente de novo." };
    }
    revalidatePath("/financeiro/pagar");
    return { ok: true, message: "Conta registrada." };
  } catch (e) {
    return { ...INICIAL, message: e instanceof Error ? e.message : "Sem permissão." };
  }
}

export async function atualizarConta(
  _prev: PagarActionState,
  formData: FormData
): Promise<PagarActionState> {
  try {
    const { supabase } = await requireFinanceiro();
    const parsed = validar(formData);
    if (!parsed.success || !parsed.data.id) {
      return { ...INICIAL, message: "Confira os campos." };
    }
    const v = parsed.data;
    const { error } = await supabase
      .from("pagamentos_ectolab")
      .update({
        titulo: v.titulo,
        fornecedor: v.fornecedor ?? null,
        valor: brlParaNumero(v.valor),
        vencimento: v.vencimento ?? null,
        metodo: v.metodo,
        status: v.status ?? undefined,
        observacoes: v.observacoes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", Number(v.id));
    if (error) {
      console.error("atualizarConta: update failed", error);
      return { ...INICIAL, message: "Não foi possível salvar. Tente de novo." };
    }
    revalidatePath("/financeiro/pagar");
    return { ok: true, message: "Conta atualizada." };
  } catch (e) {
    return { ...INICIAL, message: e instanceof Error ? e.message : "Sem permissão." };
  }
}

export async function alternarContaPaga(
  id: number,
  pago: boolean
): Promise<{ ok: boolean; message: string }> {
  try {
    const { supabase } = await requireFinanceiro();
    if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Conta inválida." };
    const { error } = await supabase
      .from("pagamentos_ectolab")
      .update({
        status: pago ? "pago" : "pendente",
        pago_em: pago ? hojeISO() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      console.error("alternarContaPaga failed", error);
      return { ok: false, message: "Não foi possível atualizar." };
    }
    revalidatePath("/financeiro/pagar");
    return { ok: true, message: pago ? "Conta marcada como paga." : "Voltou para pendente." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sem permissão." };
  }
}

export async function excluirConta(id: number): Promise<{ ok: boolean; message: string }> {
  try {
    const { supabase } = await requireFinanceiro();
    if (!Number.isInteger(id) || id <= 0) return { ok: false, message: "Conta inválida." };
    const { error } = await supabase.from("pagamentos_ectolab").delete().eq("id", id);
    if (error) {
      console.error("excluirConta failed", error);
      return { ok: false, message: "Não foi possível excluir." };
    }
    revalidatePath("/financeiro/pagar");
    return { ok: true, message: "Conta excluída." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Sem permissão." };
  }
}

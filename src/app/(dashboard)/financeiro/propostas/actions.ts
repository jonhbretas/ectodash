"use server";

// src/app/(dashboard)/financeiro/propostas/actions.ts
// CRUD das propostas financeiras (foco no aluno) + sincronização com o
// Google Planilhas nos dois sentidos:
//   - PULL (sincronizarPlanilha): lê a aba e substitui SÓ as linhas de
//     origem 'planilha' (o digitado no sistema nunca é apagado pelo sync).
//   - PUSH (exportarParaPlanilha): sobrescreve a aba com o estado atual.
// Gate real: requireFinanceiro() + policies RLS da 0110 (financeiro/
// coordenador_geral). Config via env: PROPOSTAS_SHEET_ID (obrigatório
// p/ sync) e PROPOSTAS_SHEET_ABA (default "Propostas").
import { revalidatePath } from "next/cache";
import { requireFinanceiro } from "@/lib/role-gates";
import { createSheetsClient, createSheetsWriteClient } from "@/lib/sheets/client";
import {
  CABECALHO_EXPORT,
  parseLinhasPropostas,
} from "@/lib/propostas/parse-sheet";
import {
  brlParaNumero,
  gerarTitulo,
  hojeISO,
  propostaSchema,
  STATUS_LABELS,
  METODO_LABELS,
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
    aluno_nome: String(formData.get("aluno_nome") ?? ""),
    aluno_email: String(formData.get("aluno_email") ?? ""),
    curso_atividade: String(formData.get("curso_atividade") ?? ""),
    evento_id: String(formData.get("evento_id") ?? ""),
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
      titulo: gerarTitulo(v.curso_atividade, v.aluno_nome),
      aluno_nome: v.aluno_nome,
      aluno_email: v.aluno_email ?? null,
      curso_atividade: v.curso_atividade,
      evento_id: v.evento_id ? Number(v.evento_id) : null,
      descricao: v.descricao ?? null,
      valor: brlParaNumero(v.valor),
      metodo: v.metodo,
      prazo: v.prazo ?? null,
      sheet_url: v.sheet_url ?? null,
      observacoes: v.observacoes ?? null,
      origem: "sistema",
      created_by: user.id,
    });
    if (error) {
      console.error("criarProposta: insert failed", error);
      return { ...initialState, message: "Não foi possível salvar. Tente de novo." };
    }
    revalidatePath("/financeiro/propostas");
    return { ok: true, message: `Proposta de ${v.aluno_nome} registrada.` };
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
        titulo: gerarTitulo(v.curso_atividade, v.aluno_nome),
        aluno_nome: v.aluno_nome,
        aluno_email: v.aluno_email ?? null,
        curso_atividade: v.curso_atividade,
        evento_id: v.evento_id ? Number(v.evento_id) : null,
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

// ---------------------------------------------------------------------------
// Sync com o Google Planilhas
// ---------------------------------------------------------------------------

function sheetConfig(): { id: string; aba: string } {
  const id = process.env.PROPOSTAS_SHEET_ID ?? "";
  if (!id) {
    throw new Error(
      "Planilha não configurada: defina PROPOSTAS_SHEET_ID (ID da planilha) nas variáveis de ambiente."
    );
  }
  return { id, aba: process.env.PROPOSTAS_SHEET_ABA ?? "Propostas" };
}

// PULL: planilha → sistema. Substitui só origem='planilha'; o que foi
// digitado no app (origem='sistema') é preservado.
export async function sincronizarPlanilha(): Promise<{ ok: boolean; message: string }> {
  try {
    const { supabase, user } = await requireFinanceiro();
    const { id, aba } = sheetConfig();
    const { client } = createSheetsClient();

    const res = await client.spreadsheets.values.get({
      spreadsheetId: id,
      range: `${aba}!A1:H1000`,
    });
    const values = ((res.data.values ?? []) as string[][]).map((r) =>
      r.map((c) => String(c ?? ""))
    );
    if (values.length <= 1) {
      return { ok: true, message: "Planilha vazia (só cabeçalho) — nada para puxar." };
    }
    const { linhas, ignoradas } = parseLinhasPropostas(values);
    const agora = new Date().toISOString();

    const { error: delError } = await supabase
      .from("propostas_financeiras")
      .delete()
      .eq("origem", "planilha");
    if (delError) {
      console.error("sincronizarPlanilha: delete failed", delError);
      return { ok: false, message: "Não foi possível limpar as linhas antigas da planilha." };
    }

    if (linhas.length > 0) {
      const { error: insError } = await supabase.from("propostas_financeiras").insert(
        linhas.map((l) => ({
          titulo: gerarTitulo(l.curso, l.aluno),
          aluno_nome: l.aluno,
          aluno_email: l.email,
          curso_atividade: l.curso,
          valor: l.valor,
          metodo: l.metodo,
          prazo: l.prazo,
          status: l.pago ? "pago" : "pendente",
          pago_em: l.pago ? hojeISO() : null,
          observacoes: l.observacoes,
          origem: "planilha",
          sheet_row: `${aba}!${l.sheetRow}`,
          sincronizado_em: agora,
          created_by: user.id,
        }))
      );
      if (insError) {
        console.error("sincronizarPlanilha: insert failed", insError);
        return { ok: false, message: "Falha ao salvar as linhas da planilha." };
      }
    }

    revalidatePath("/financeiro/propostas");
    const detalhe = ignoradas > 0 ? ` (${ignoradas} linha(s) ignoradas por falta de aluno/curso/valor)` : "";
    return { ok: true, message: `${linhas.length} proposta(s) puxadas da planilha.${detalhe}` };
  } catch (e) {
    console.error("sincronizarPlanilha failed", e);
    return { ok: false, message: e instanceof Error ? e.message : "Falha na sincronização." };
  }
}

// PUSH: sistema → planilha. Sobrescreve a aba com o estado atual
// (cabeçalho + todas as propostas não canceladas). Exige a planilha
// compartilhada com a service account como Editor.
export async function exportarParaPlanilha(): Promise<{ ok: boolean; message: string }> {
  try {
    const { supabase } = await requireFinanceiro();
    const { id, aba } = sheetConfig();
    const { client } = createSheetsWriteClient();

    const { data, error } = await supabase
      .from("propostas_financeiras")
      .select("aluno_nome, aluno_email, curso_atividade, valor, metodo, prazo, status, observacoes")
      .neq("status", "cancelado")
      .order("aluno_nome", { ascending: true });
    if (error) {
      console.error("exportarParaPlanilha: select failed", error);
      return { ok: false, message: "Não foi possível ler as propostas." };
    }

    const linhas = (data ?? []).map((r) => [
      String(r.aluno_nome),
      String(r.aluno_email ?? ""),
      String(r.curso_atividade),
      Number(r.valor).toFixed(2).replace(".", ","),
      METODO_LABELS[r.metodo as keyof typeof METODO_LABELS] ?? String(r.metodo),
      r.prazo ? String(r.prazo).split("-").reverse().join("/") : "",
      (r.status as string) === "pago" ? "pago" : "",
      String(r.observacoes ?? ""),
    ]);

    await client.spreadsheets.values.clear({
      spreadsheetId: id,
      range: `${aba}!A:H`,
    });
    await client.spreadsheets.values.update({
      spreadsheetId: id,
      range: `${aba}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [CABECALHO_EXPORT, ...linhas] },
    });

    // Marca o momento do push (auditoria leve, sem tocar nos dados).
    await supabase
      .from("propostas_financeiras")
      .update({ sincronizado_em: new Date().toISOString() })
      .eq("origem", "sistema");

    revalidatePath("/financeiro/propostas");
    return { ok: true, message: `${linhas.length} proposta(s) gravadas na planilha (${STATUS_LABELS.pago.toLowerCase()} incluídos).` };
  } catch (e) {
    console.error("exportarParaPlanilha failed", e);
    return { ok: false, message: e instanceof Error ? e.message : "Falha na exportação." };
  }
}

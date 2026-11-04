import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceiro } from "@/lib/role-gates";
import { generateMonthlyReport } from "@/lib/financeiro/ai-report";
import { parseFinancialDate } from "@/lib/financeiro/values";

export const maxDuration = 180;
const noteSchema = z.object({ number: z.string().trim().min(1).max(100), issuer: z.string().trim().min(1).max(300), issuerDocument: z.string().trim().min(11).max(30), issueDate: z.string().refine((date) => parseFinancialDate(date) === date), total: z.number().finite().nonnegative(), recipient: z.string().max(300).nullable(), recipientDocument: z.string().max(30).nullable(), accessKey: z.string().max(100).nullable() });
const schema = z.object({ competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), action: z.enum(["analyze", "close", "merge", "reviewNote"]),
  reportId: z.uuid().optional(), exceptionId: z.uuid().optional(), ledgerId: z.uuid().optional(), documentsComplete: z.boolean().optional(), importId: z.uuid().optional(), note: noteSchema.optional() });

export async function POST(request: Request) {
  let ctx;
  try { ctx = await requireFinanceiro(); } catch { return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 }); }
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Informe uma competência e ação válidas." }, { status: 400 });
  const body = input.data;
  try {
    if (body.action === "reviewNote") {
      if (!body.importId || !body.note || body.documentsComplete !== true) return NextResponse.json({ error: "Preencha os campos da nota e confirme a conferência do original." }, { status: 400 });
      const { error } = await ctx.supabase.rpc("finance_ai_review_note", { p_import: body.importId, p_month: `${body.competencia}-01`, p_fields: body.note });
      if (error) return NextResponse.json({ error: "Não foi possível salvar a nota. Confira o documento e o estado do mês." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "merge") {
      if (!body.exceptionId || !body.ledgerId) return NextResponse.json({ error: "Selecione um candidato para mesclagem." }, { status: 400 });
      const { error } = await ctx.supabase.rpc("finance_ai_merge_duplicate", { p_exception: body.exceptionId, p_ledger: body.ledgerId });
      if (error) return NextResponse.json({ error: "Não foi possível mesclar. Confira se o candidato e o período continuam disponíveis." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "close") {
      if (!body.reportId || body.documentsComplete !== true) return NextResponse.json({ error: "Confirme o envio de todos os documentos antes de fechar." }, { status: 400 });
      const { data: report, error: readError } = await ctx.supabase.from("finance_ai_reports").select("competencia").eq("id", body.reportId).single();
      if (readError || report?.competencia !== `${body.competencia}-01`) return NextResponse.json({ error: "Relatório e competência não correspondem." }, { status: 409 });
      const { error } = await ctx.supabase.rpc("finance_ai_close", { p_report: body.reportId, p_documents_complete: body.documentsComplete });
      if (error) return NextResponse.json({ error: error.message }, { status: 409 });
      return NextResponse.json({ ok: true, closed: true });
    }
    return NextResponse.json(await generateMonthlyReport(ctx.supabase, ctx.user.id, body.competencia, true));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na análise financeira. Tente novamente." }, { status: 503 });
  }
}

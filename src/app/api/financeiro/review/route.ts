import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceiro } from "@/lib/role-gates";
import { reviewedValues } from "@/lib/financeiro/review";
import { parseFinancialDate } from "@/lib/financeiro/values";
import type { FinancialType } from "@/lib/financeiro/automation";

export async function PATCH(request: Request) {
  try { await requireFinanceiro(); } catch { return NextResponse.json({ error: "Sem acesso." }, { status: 403 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { exceptionId?: string; ledgerId?: string | null; date?: string; description?: string; amount?: number; type?: string; resolveOnly?: boolean; direction?: "entrada" | "saida" } | null;
  const types = ["RECEITA_FATURADA", "RECEITA_RECEBIDA", "DESPESA", "TRANSFERENCIA_INTERNA", "APLICACAO", "RESGATE", "RENDIMENTO_FINANCEIRO", "ESTORNO", "CHARGEBACK", "TARIFA", "AJUSTE", "SALDO_INICIAL", "SALDO_FINAL"];
  if (!body?.exceptionId) return NextResponse.json({ error: "Conferência não encontrada." }, { status: 400 });
  const { data: exception } = await supabase.from("finance_exceptions").select("id,import_id,ledger_ids,status,problem,alternatives").eq("id", body.exceptionId).single();
  if (!exception) return NextResponse.json({ error: "Conferência não encontrada." }, { status: 404 });
  if (Array.isArray(exception.alternatives) && exception.alternatives.some((item: { kind?: string }) => item.kind === "POSSIBLE_DUPLICATE")) return NextResponse.json({ error: "Abra Financeiro com IA e escolha a mesclagem com o lançamento existente." }, { status: 409 });
  const { data: imported, error: importError } = exception.import_id
    ? await supabase.from("finance_imports").select("file_name,metadata").eq("id", exception.import_id).single()
    : { data: null, error: null };
  if (importError) return NextResponse.json({ error: "Não foi possível validar a importação." }, { status: 503 });
  const months = [imported?.metadata?.competencia, typeof body.date === "string" ? body.date.slice(0, 7) : null].filter((month): month is string => typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)).map((month) => `${month}-01`);
  if (months.length) {
    const { data: closed, error } = await supabase.from("finance_periods").select("id").in("competencia", months).eq("status", "FECHADO");
    if (error) return NextResponse.json({ error: "Não foi possível validar o fechamento." }, { status: 503 });
    if (closed?.length) return NextResponse.json({ error: "Este período já foi fechado e está bloqueado para conferência." }, { status: 409 });
  }
  if (body.resolveOnly) {
    if (exception.status !== "OPEN" || (exception.ledger_ids ?? []).length || !exception.problem.startsWith("Período fora da competência")) return NextResponse.json({ error: "Esta conferência exige revisão de um lançamento." }, { status: 409 });
    const { error } = await supabase.from("finance_exceptions").update({ status: "RESOLVED", resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", exception.id);
    if (error) return NextResponse.json({ error: "Não foi possível registrar a conferência." }, { status: 400 });
    const { error: auditError } = await supabase.from("finance_audit_log").insert({ import_id: exception.import_id, action: "PERIOD_CONFIRMED", after_data: { exception_id: exception.id }, actor: user.id });
    if (auditError) return NextResponse.json({ error: "Competência confirmada, mas houve falha no histórico. Recarregue antes de continuar." }, { status: 503 });
    return NextResponse.json({ ok: true });
  }
  if (typeof body.date !== "string" || parseFinancialDate(body.date) !== body.date || typeof body.description !== "string" || !body.description.trim() || !Number.isFinite(body.amount) || Number(body.amount) < 0 || !types.includes(body.type || "") || (body.direction !== undefined && !["entrada", "saida"].includes(body.direction))) return NextResponse.json({ error: "Preencha data, descrição, tipo e valor válido." }, { status: 400 });
  const entryType = body.type as string;
  if (exception.status !== "OPEN" || (body.ledgerId && !(exception.ledger_ids ?? []).includes(body.ledgerId))) return NextResponse.json({ error: "Este lançamento não pertence a uma conferência aberta." }, { status: 409 });
  if (!body.ledgerId && exception.ledger_ids?.length) return NextResponse.json({ error: "Selecione o lançamento existente para corrigir; não é permitido duplicá-lo." }, { status: 409 });
  let oldRow: Record<string, unknown> = {};
  let ledgerId = body.ledgerId;
  if (ledgerId) {
    const { data, error: readError } = await supabase.from("finance_ledger").select("*").eq("id", ledgerId).single();
    if (readError || !data) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    oldRow = data;
    if (data.reconciliation_status === "CONCILIADO" || data.reconciliation_status === "PARCIALMENTE_CONCILIADO") return NextResponse.json({ error: "Desfaça a conciliação antes de alterar este lançamento." }, { status: 409 });
    const { data: closed, error: periodError } = await supabase.from("finance_periods").select("id").eq("competencia", `${data.movement_date.slice(0, 7)}-01`).eq("status", "FECHADO");
    if (periodError) return NextResponse.json({ error: "Não foi possível validar o período original." }, { status: 503 });
    if (closed?.length) return NextResponse.json({ error: "O período original já foi fechado." }, { status: 409 });
  } else {
    if (!exception.import_id) return NextResponse.json({ error: "Importação de origem não encontrada." }, { status: 400 });
    const desc = body.description.trim(); const amount = Number(body.amount);
    let values;
    try { values = reviewedValues(entryType as FinancialType, amount, desc, {}, body.direction); }
    catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
    ledgerId = crypto.randomUUID();
    const { error } = await supabase.from("finance_ledger").insert({ id: ledgerId, import_id: exception.import_id, file_name: imported?.file_name ?? "Conferência manual", source_line: 0, line_hash: `manual-${ledgerId}`, movement_date: body.date, ...values, created_by: user.id });
    if (error) return NextResponse.json({ error: "Não foi possível criar o lançamento manual." }, { status: 400 });
    oldRow = {};
  }
  const amount = Number(body.amount);
  const desc = body.description.trim();
  let changes;
  try { changes = { movement_date: body.date, ...reviewedValues(entryType as FinancialType, amount, desc, oldRow, body.direction) }; }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  if (body.ledgerId) {
    const { error: updateError } = await supabase.from("finance_ledger").update(changes).eq("id", body.ledgerId);
    if (updateError) return NextResponse.json({ error: "Não foi possível salvar a correção." }, { status: 400 });
  }
  const remaining = (exception.ledger_ids ?? []).filter((id: string) => id !== ledgerId);
  const { error: resolutionError } = await supabase.from("finance_exceptions").update(remaining.length
    ? { ledger_ids: remaining }
    : { status: "RESOLVED", resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", body.exceptionId).eq("status", "OPEN");
  if (resolutionError) return NextResponse.json({ error: "Lançamento salvo, mas a pendência não foi encerrada. Recarregue e confira antes de tentar novamente." }, { status: 503 });
  const { error: auditError } = await supabase.from("finance_audit_log").insert({ ledger_id: ledgerId, import_id: exception.import_id, action: "MANUAL_REVIEW", before_data: oldRow, after_data: changes, actor: user.id });
  if (auditError) return NextResponse.json({ error: "Conferência salva, mas houve falha no histórico. Recarregue antes de continuar." }, { status: 503 });
  return NextResponse.json({ ok: true });
}

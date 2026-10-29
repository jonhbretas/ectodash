import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceiro } from "@/lib/role-gates";

export async function PATCH(request: Request) {
  try { await requireFinanceiro(); } catch { return NextResponse.json({ error: "Sem acesso." }, { status: 403 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { exceptionId?: string; ledgerId?: string | null; date?: string; description?: string; amount?: number; type?: string } | null;
  const types = ["RECEITA_FATURADA", "RECEITA_RECEBIDA", "DESPESA", "TRANSFERENCIA_INTERNA", "APLICACAO", "RESGATE", "RENDIMENTO_FINANCEIRO", "ESTORNO", "CHARGEBACK", "TARIFA", "AJUSTE", "SALDO_INICIAL", "SALDO_FINAL"];
  if (!body?.exceptionId || !body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !body.description?.trim() || !Number.isFinite(body.amount) || Number(body.amount) < 0 || !types.includes(body.type || "")) return NextResponse.json({ error: "Preencha data, descrição, tipo e valor válido." }, { status: 400 });
  const entryType = body.type as string;
  const { data: exception } = await supabase.from("finance_exceptions").select("id,import_id,ledger_ids,status").eq("id", body.exceptionId).single();
  if (!exception) return NextResponse.json({ error: "Conferência não encontrada." }, { status: 404 });
  if (exception.status !== "OPEN" || (body.ledgerId && !(exception.ledger_ids ?? []).includes(body.ledgerId))) return NextResponse.json({ error: "Este lançamento não pertence a uma conferência aberta." }, { status: 409 });
  let oldRow: Record<string, unknown> = {};
  let ledgerId = body.ledgerId;
  if (ledgerId) {
    const { data, error: readError } = await supabase.from("finance_ledger").select("*").eq("id", ledgerId).single();
    if (readError || !data) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    oldRow = data;
  } else {
    if (!exception.import_id) return NextResponse.json({ error: "Importação de origem não encontrada." }, { status: 400 });
    const { data: imported } = await supabase.from("finance_imports").select("file_name").eq("id", exception.import_id).single();
    const desc = body.description.trim(); const amount = Number(body.amount);
    ledgerId = crypto.randomUUID();
    const { error } = await supabase.from("finance_ledger").insert({ id: ledgerId, import_id: exception.import_id, file_name: imported?.file_name ?? "Conferência manual", source_line: 0, line_hash: `manual-${ledgerId}`, movement_date: body.date, type: entryType, original_description: desc, normalized_description: desc.toLocaleUpperCase("pt-BR"), gross_amount: amount, net_amount: amount, inflow: entryType.startsWith("RECEITA") ? amount : 0, outflow: ["DESPESA", "TARIFA"].includes(entryType) ? amount : 0, reconciliation_status: "PENDENTE", confidence: 1, classification_explanation: "Lançamento preenchido manualmente na conferência.", created_by: user.id });
    if (error) return NextResponse.json({ error: "Não foi possível criar o lançamento manual." }, { status: 400 });
    oldRow = {};
  }
  const amount = Number(body.amount);
  const desc = body.description.trim();
  const changes = { movement_date: body.date, type: entryType, original_description: desc, normalized_description: desc.toLocaleUpperCase("pt-BR"), gross_amount: amount, net_amount: amount, inflow: entryType.startsWith("RECEITA") ? amount : 0, outflow: ["DESPESA", "TARIFA"].includes(entryType) ? amount : 0, reconciliation_status: "PENDENTE", confidence: 1, classification_explanation: "Conferido manualmente." };
  if (body.ledgerId) {
    const { error: updateError } = await supabase.from("finance_ledger").update(changes).eq("id", body.ledgerId);
    if (updateError) return NextResponse.json({ error: "Não foi possível salvar a correção." }, { status: 400 });
  }
  await supabase.from("finance_exceptions").update({ status: "RESOLVED", resolved_by: user.id, resolved_at: new Date().toISOString() }).eq("id", body.exceptionId);
  await supabase.from("finance_audit_log").insert({ ledger_id: ledgerId, import_id: exception.import_id, action: "MANUAL_REVIEW", before_data: oldRow, after_data: changes, actor: user.id });
  return NextResponse.json({ ok: true });
}

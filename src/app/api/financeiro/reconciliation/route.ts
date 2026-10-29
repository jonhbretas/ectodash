import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceiro } from "@/lib/role-gates";

export async function POST(request: Request) {
  try { await requireFinanceiro(); } catch { return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { billedId?: string; receivedId?: string } | null;
  if (!body?.billedId || !body.receivedId || body.billedId === body.receivedId) return NextResponse.json({ error: "Selecione um lançamento de venda e um crédito bancário." }, { status: 400 });
  const ids = [body.billedId, body.receivedId];
  const { data: entries, error: readError } = await supabase.from("finance_ledger").select("id,type,movement_date,expected_date,net_amount,reconciliation_status").in("id", ids);
  if (readError || entries?.length !== 2) return NextResponse.json({ error: "Um dos lançamentos não está mais disponível." }, { status: 404 });
  const sale = entries.find((item) => item.id === body.billedId); const deposit = entries.find((item) => item.id === body.receivedId);
  if (!sale || !deposit || sale.type !== "RECEITA_FATURADA" || deposit.type !== "RECEITA_RECEBIDA") return NextResponse.json({ error: "Os tipos dos lançamentos não permitem esta conciliação." }, { status: 400 });
  if (sale.reconciliation_status === "CONCILIADO" || deposit.reconciliation_status === "CONCILIADO") return NextResponse.json({ error: "Um dos lançamentos já foi conciliado." }, { status: 409 });
  if (Math.round(Number(sale.net_amount) * 100) !== Math.round(Number(deposit.net_amount) * 100)) return NextResponse.json({ error: "Os valores líquidos são diferentes. Não foi feita alteração." }, { status: 409 });
  const targetDate = sale.expected_date ?? sale.movement_date;
  const dayDistance = Math.abs(Date.parse(`${targetDate}T00:00:00Z`) - Date.parse(`${deposit.movement_date}T00:00:00Z`)) / 86400000;
  if (dayDistance > 7) return NextResponse.json({ error: "As datas diferem em mais de sete dias. Revise manualmente antes de conciliar." }, { status: 409 });
  const months = [...new Set([sale.movement_date.slice(0, 7), deposit.movement_date.slice(0, 7)].map((month) => `${month}-01`))];
  const { data: closedPeriods } = await supabase.from("finance_periods").select("competencia").in("competencia", months).eq("status", "FECHADO");
  if (closedPeriods?.length) return NextResponse.json({ error: "Um dos períodos relacionados já foi fechado. Não é possível alterar esta conciliação." }, { status: 409 });
  const { data: reconciliation, error: createError } = await supabase.from("finance_reconciliations").insert({ kind: "RECEITA_PLATAFORMA_BANCO", status: "CONCILIADO", amount: Number(sale.net_amount), difference: 0, criteria: { rule: "exact-net-amount-within-seven-days", day_distance: dayDistance }, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).select("id").single();
  if (createError || !reconciliation) return NextResponse.json({ error: "Não foi possível criar a conciliação." }, { status: 400 });
  const { error: linkError } = await supabase.from("finance_reconciliation_items").insert(ids.map((ledger_id) => ({ reconciliation_id: reconciliation.id, ledger_id })));
  if (linkError) { await supabase.from("finance_reconciliations").delete().eq("id", reconciliation.id); return NextResponse.json({ error: "Um dos lançamentos já está em outra conciliação." }, { status: 409 }); }
  const { error: updateError } = await supabase.from("finance_ledger").update({ reconciliation_status: "CONCILIADO" }).in("id", ids);
  if (updateError) { await supabase.from("finance_reconciliation_items").delete().eq("reconciliation_id", reconciliation.id); await supabase.from("finance_reconciliations").delete().eq("id", reconciliation.id); return NextResponse.json({ error: "Não foi possível atualizar o status dos lançamentos." }, { status: 400 }); }
  await supabase.from("finance_audit_log").insert({ import_id: null, action: "PLATFORM_BANK_RECONCILIATION", after_data: { reconciliation_id: reconciliation.id, ledger_ids: ids, amount: Number(sale.net_amount), day_distance: dayDistance }, actor: user.id });
  return NextResponse.json({ ok: true, reconciliationId: reconciliation.id });
}

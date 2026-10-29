import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFinanceiro } from "@/lib/role-gates";

const keys = ["extratos", "recebimentos", "conciliacao", "cartao", "notas", "pagamentos"] as const;
type Checklist = Record<(typeof keys)[number], boolean>;
const isMonth = (value: unknown): value is string => typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export async function POST(request: Request) {
  try { await requireFinanceiro(); } catch { return NextResponse.json({ error: "Sem acesso ao financeiro." }, { status: 403 }); }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { competencia?: string; action?: string; checklist?: Partial<Checklist> } | null;
  if (!body || !isMonth(body.competencia)) return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  const competencia = `${body.competencia}-01`;
  const { data: existing } = await supabase.from("finance_periods").select("id,status,checklist").eq("competencia", competencia).maybeSingle();
  if (existing?.status === "FECHADO") return NextResponse.json({ error: "Este mês já foi fechado e está bloqueado para edição." }, { status: 409 });

  if (body.action === "checklist") {
    if (!body.checklist || keys.some((key) => typeof body.checklist?.[key] !== "boolean")) return NextResponse.json({ error: "Confirme cada item do checklist." }, { status: 400 });
    const checklist = Object.fromEntries(keys.map((key) => [key, body.checklist?.[key]])) as Checklist;
    const result = existing
      ? await supabase.from("finance_periods").update({ checklist, updated_at: new Date().toISOString() }).eq("id", existing.id).eq("status", "ABERTO").select("id").maybeSingle()
      : await supabase.from("finance_periods").insert({ competencia, checklist, created_by: user.id }).select("id").single();
    if (result.error || !result.data) return NextResponse.json({ error: "O mês foi fechado ou não foi possível salvar o checklist." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "close") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  if (!existing) return NextResponse.json({ error: "Salve o checklist antes de fechar o mês." }, { status: 409 });
  const checklist = existing.checklist as Partial<Checklist>;
  const missing = keys.filter((key) => checklist[key] !== true);
  if (missing.length) return NextResponse.json({ error: "Confirme todos os itens do checklist antes de fechar." }, { status: 409 });
  const { data: imports } = await supabase.from("finance_imports").select("id,status").eq("metadata->>competencia", body.competencia);
  if (!imports?.length) return NextResponse.json({ error: "Envie e valide os documentos deste mês antes do fechamento." }, { status: 409 });
  if (imports.some((item) => ["FAILED", "PROCESSING"].includes(item.status))) return NextResponse.json({ error: "Há arquivo com falha ou processamento em andamento." }, { status: 409 });
  const importIds = imports.map((item) => item.id);
  const { count: openExceptions, error: exceptionError } = await supabase.from("finance_exceptions").select("id", { count: "exact", head: true }).eq("status", "OPEN").in("import_id", importIds);
  if (exceptionError) return NextResponse.json({ error: "Não foi possível validar as pendências." }, { status: 400 });
  if ((openExceptions ?? 0) > 0) return NextResponse.json({ error: `Resolva as ${openExceptions} pendência(s) em Conferência antes de fechar.` }, { status: 409 });
  const now = new Date().toISOString();
  const { data: closed, error: closeError } = await supabase.from("finance_periods").update({ status: "FECHADO", closed_by: user.id, closed_at: now, updated_at: now }).eq("id", existing.id).eq("status", "ABERTO").select("id").maybeSingle();
  if (closeError || !closed) return NextResponse.json({ error: "O mês já foi fechado ou não foi possível fechar." }, { status: 409 });
  await supabase.from("finance_audit_log").insert({ action: "MONTH_CLOSED", after_data: { competencia: body.competencia, imports: imports.length, open_exceptions: 0 }, actor: user.id });
  return NextResponse.json({ ok: true });
}

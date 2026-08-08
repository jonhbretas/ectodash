import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFinancialDocument } from "@/lib/financeiro/parse-document";
import { normalizeText } from "@/lib/financeiro/automation";

export const maxDuration = 60;

async function ensureEntity(supabase: Awaited<ReturnType<typeof createClient>>, kind: string, name: string | undefined) {
  if (!name?.trim()) return null;
  const normalizedName = normalizeText(name);
  const { data: existing } = await supabase.from("finance_entities").select("id").eq("kind", kind).eq("normalized_name", normalizedName).maybeSingle();
  if (existing) return existing.id as string;
  const { data: created } = await supabase.from("finance_entities").insert({ kind, name: name.trim(), normalized_name: normalizedName, confidence: .75 }).select("id").single();
  return created?.id as string | null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["financeiro", "coordenador_geral"].includes(profile.role)) return NextResponse.json({ error: "Sem acesso ao financeiro" }, { status: 403 });
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  if (!files.length) return NextResponse.json({ error: "Envie ao menos um arquivo" }, { status: 400 });
  const results = [];
  for (const file of files) {
    if (file.size === 0 || file.size > 10 * 1024 * 1024) { results.push({ file: file.name, status: "FAILED", error: "Arquivo vazio ou maior que 10MB" }); continue; }
    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const { data: existing } = await supabase.from("finance_imports").select("id,status").eq("file_sha256", sha256).maybeSingle();
    if (existing) { results.push({ file: file.name, status: "DUPLICATE", importId: existing.id }); continue; }
    const parsed = await parseFinancialDocument(file);
    const { data: imported, error: importError } = await supabase.from("finance_imports").insert({ file_name: file.name, file_sha256: sha256, mime_type: file.type || "application/octet-stream", file_size: file.size, source_type: parsed.sourceType, status: "PROCESSING", row_count: parsed.rows.length, metadata: { format: parsed.format, warnings: parsed.warnings }, created_by: user.id }).select("id").single();
    if (importError || !imported) { results.push({ file: file.name, status: "FAILED", error: importError?.message ?? "Falha ao registrar importação" }); continue; }
    const entityIds = new Map<string, string | null>();
    for (const row of parsed.rows) {
      if (row.category) entityIds.set(`CATEGORY:${row.category}`, await ensureEntity(supabase, "CATEGORY", row.category));
      if (row.provider) entityIds.set(`PROVIDER:${row.provider}`, await ensureEntity(supabase, "PROVIDER", row.provider));
    }
    const ledgerRows = parsed.rows.map((row) => ({ import_id: imported.id, file_name: file.name, sheet_name: row.sheet ?? null, source_line: row.line, line_hash: row.lineHash, external_transaction_id: row.externalId ?? null, movement_date: row.date, type: row.type, original_description: row.description, normalized_description: row.normalizedDescription, gross_amount: row.gross, fee_amount: row.fee, tax_amount: row.tax, refund_amount: row.refund, chargeback_amount: row.chargeback, net_amount: row.net, inflow: row.inflow, outflow: row.outflow, category_id: row.category ? entityIds.get(`CATEGORY:${row.category}`) : null, provider_id: row.provider ? entityIds.get(`PROVIDER:${row.provider}`) : null, reconciliation_status: "PENDENTE", confidence: row.confidence, classification_explanation: row.explanation }));
    const { error: ledgerError } = ledgerRows.length ? await supabase.from("finance_ledger").insert(ledgerRows) : { error: null };
    if (!ledgerError) await supabase.from("finance_audit_log").insert({ import_id: imported.id, action: "IMPORT_PROCESSED", after_data: { file: file.name, rows: parsed.rows.length }, actor: user.id });
    await supabase.from("finance_imports").update({ status: ledgerError ? "FAILED" : parsed.warnings.length ? "PARTIAL" : "PROCESSED", error_message: ledgerError?.message ?? null, processed_at: new Date().toISOString() }).eq("id", imported.id);
    if (parsed.warnings.length) await supabase.from("finance_exceptions").insert(parsed.warnings.map((problem) => ({ import_id: imported.id, problem, recommendation: "Revisar o layout e confirmar a classificação", status: "OPEN" })));
    results.push({ file: file.name, status: ledgerError ? "FAILED" : "PROCESSED", importId: imported.id, rows: parsed.rows.length, warnings: parsed.warnings });
  }
  return NextResponse.json({ results });
}

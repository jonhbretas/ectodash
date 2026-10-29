import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { temCargoModulo } from "@/lib/role-gates";
import { parseFinancialDocument } from "@/lib/financeiro/parse-document";
import { normalizeText } from "@/lib/financeiro/automation";
import { getFinancialDriveFolder } from "@/lib/financeiro/drive-folders";
import { uploadDriveFile } from "@/lib/google/drive";

export const maxDuration = 60;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/x-ofx",
  "application/octet-stream",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

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
  const allowed =
    profile?.role === "coordenador_geral" ||
    profile?.role === "financeiro" ||
    (await temCargoModulo(supabase, "financeiro"));
  if (!allowed) return NextResponse.json({ error: "Sem acesso ao financeiro" }, { status: 403 });
  const form = await request.formData();
  const files = form.getAll("files").filter((item): item is File => item instanceof File);
  const competencia = String(form.get("competencia") || new Date().toISOString().slice(0, 7));
  const categoria = String(form.get("categoria") || "outros");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return NextResponse.json({ error: "Competência inválida" }, { status: 400 });
  const { data: closedPeriod } = await supabase.from("finance_periods").select("id").eq("competencia", `${competencia}-01`).eq("status", "FECHADO").maybeSingle();
  if (closedPeriod) return NextResponse.json({ error: "Este mês já foi fechado. Fale com a coordenação financeira antes de enviar novos documentos." }, { status: 409 });
  if (!files.length) return NextResponse.json({ error: "Envie ao menos um arquivo" }, { status: 400 });
  const results = [];
  for (const file of files) {
    if (file.size === 0 || file.size > 10 * 1024 * 1024) { results.push({ file: file.name, status: "FAILED", error: "Arquivo vazio ou maior que 10MB" }); continue; }
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["ofx", "pdf", "csv", "xlsx", "xls", "jpg", "jpeg", "png", "webp", "heic"].includes(extension ?? "") || (file.type && file.type !== "application/octet-stream" && !ALLOWED_MIME.has(file.type))) { results.push({ file: file.name, status: "FAILED", error: "Tipo de arquivo não permitido. Envie OFX, PDF, CSV, Excel ou imagem." }); continue; }
    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const { data: existing } = await supabase.from("finance_imports").select("id,status").eq("file_sha256", sha256).maybeSingle();
    if (existing) { results.push({ file: file.name, status: "DUPLICATE", importId: existing.id }); continue; }
    let driveFile;
    try {
      const folder = await getFinancialDriveFolder(competencia, categoria);
      const safeName = file.name.replace(/[\\/<>:"|?*\u0000-\u001f]/g, "_").slice(-180);
      driveFile = await uploadDriveFile(folder.id, safeName, bytes, file.type || "application/octet-stream");
    } catch (error) {
      results.push({ file: file.name, status: "FAILED", error: error instanceof Error ? error.message : "Falha ao arquivar no Drive." });
      continue;
    }
    let parsed;
    try {
      parsed = await parseFinancialDocument(file);
    } catch (error) {
      parsed = { format: "PDF" as const, sourceType: "UNKNOWN", rows: [], warnings: [`Falha na leitura automática: ${error instanceof Error ? error.message : "arquivo não processado"}`] };
    }
    const dates = parsed.rows.map((row) => row.date).sort();
    const dateRangeWarning = dates.length && dates.some((date) => date.slice(0, 7) !== competencia)
      ? [`Período fora da competência: o conteúdo inclui datas diferentes da competência selecionada (${competencia}); confira o documento antes de confirmar.`]
      : [];
    const allWarnings = [...parsed.warnings, ...dateRangeWarning];
    const { data: imported, error: importError } = await supabase.from("finance_imports").insert({ file_name: file.name, file_sha256: sha256, mime_type: file.type || "application/octet-stream", file_size: file.size, storage_path: driveFile.id, source_type: parsed.sourceType, provider: parsed.provider ?? null, period_start: dates[0] ?? null, period_end: dates.at(-1) ?? null, status: "PROCESSING", row_count: parsed.rows.length, metadata: { format: parsed.format, warnings: allWarnings, drive_url: driveFile.webViewLink ?? null, competencia, categoria }, created_by: user.id }).select("id").single();
    if (importError || !imported) { results.push({ file: file.name, status: "FAILED", error: importError?.message ?? "Falha ao registrar importação" }); continue; }
    const entityIds = new Map<string, string | null>();
    for (const row of parsed.rows) {
      if (row.category) entityIds.set(`CATEGORY:${row.category}`, await ensureEntity(supabase, "CATEGORY", row.category));
      if (row.provider) entityIds.set(`PROVIDER:${row.provider}`, await ensureEntity(supabase, "PROVIDER", row.provider));
    }
    const ledgerRows = parsed.rows.map((row) => ({ import_id: imported.id, file_name: file.name, sheet_name: row.sheet ?? null, source_line: row.line, line_hash: row.lineHash, external_transaction_id: row.externalId ?? null, movement_date: row.date, sale_date: row.saleDate ?? null, settlement_date: row.settlementDate ?? null, expected_date: row.expectedDate ?? null, type: row.type, original_description: row.description, normalized_description: row.normalizedDescription, gross_amount: row.gross, fee_amount: row.fee, tax_amount: row.tax, refund_amount: row.refund, chargeback_amount: row.chargeback, net_amount: row.net, inflow: row.inflow, outflow: row.outflow, category_id: row.category ? entityIds.get(`CATEGORY:${row.category}`) : null, provider_id: row.provider ? entityIds.get(`PROVIDER:${row.provider}`) : (parsed.provider ? entityIds.get(`PROVIDER:${parsed.provider}`) : null), reconciliation_status: "PENDENTE", confidence: row.confidence, classification_explanation: row.explanation }));
    const { data: savedLedger, error: ledgerError } = ledgerRows.length ? await supabase.from("finance_ledger").insert(ledgerRows).select("id,confidence,original_description,net_amount") : { data: [], error: null };
    const uncertain = (savedLedger ?? []).filter((row) => Number(row.confidence) < 0.8);
    if (!ledgerError) await supabase.from("finance_audit_log").insert({ import_id: imported.id, action: "IMPORT_PROCESSED", after_data: { file: file.name, rows: parsed.rows.length }, actor: user.id });
    await supabase.from("finance_imports").update({ status: ledgerError ? "FAILED" : allWarnings.length || uncertain.length ? "PARTIAL" : "PROCESSED", error_message: ledgerError?.message ?? null, processed_at: new Date().toISOString() }).eq("id", imported.id);
    const exceptions = [
      ...allWarnings.map((problem) => ({ import_id: imported.id, problem, recommendation: "Confira o arquivo original no Drive e complete os dados manualmente.", status: "OPEN" as const })),
      ...uncertain.map((row) => ({ import_id: imported.id, problem: `Classificação com baixa confiança: ${row.original_description}`, affected_amount: row.net_amount, ledger_ids: [row.id], recommendation: "Revise data, descrição e valor antes de considerar este lançamento conferido.", status: "OPEN" as const })),
    ];
    if (exceptions.length) await supabase.from("finance_exceptions").insert(exceptions);
    results.push({ file: file.name, status: ledgerError ? "FAILED" : allWarnings.length || uncertain.length ? "PARTIAL" : "PROCESSED", importId: imported.id, rows: parsed.rows.length, warnings: allWarnings, uncertain: uncertain.length, provider: parsed.provider ?? null, sourceType: parsed.sourceType });
  }
  return NextResponse.json({ results });
}

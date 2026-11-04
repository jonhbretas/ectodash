import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { temCargoModulo } from "@/lib/role-gates";
import { parseFinancialDocument } from "@/lib/financeiro/parse-document";
import { normalizeText } from "@/lib/financeiro/automation";
import { getFinancialDriveFolder } from "@/lib/financeiro/drive-folders";
import { uploadDriveFile } from "@/lib/google/drive";
import { getEffectiveAIConfig } from "@/lib/ai/ai-client";
import { parseDocumentWithAI, FINANCIAL_READING_VERSION, type AIParseResult } from "@/lib/financeiro/ai-document";
import { allFinancialRows } from "@/lib/financeiro/data";
import { separateDuplicates, type ExistingMovement, type DuplicateCandidate } from "@/lib/financeiro/duplicates";

export const maxDuration = 180;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/xml",
  "text/xml",
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
  const useAI = form.get("mode") === "ia";
  const aiConfig = useAI ? await getEffectiveAIConfig(supabase) : null;
  if (useAI && !aiConfig?.apiKey) return NextResponse.json({ error: "Configure a chave OpenAI no servidor antes de usar o Financeiro com IA." }, { status: 503 });
  if (useAI && (files.length !== 1 || files[0].size > 3 * 1024 * 1024)) return NextResponse.json({ error: "Envie um arquivo de até 3 MB por vez para leitura com IA." }, { status: 400 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) return NextResponse.json({ error: "Competência inválida" }, { status: 400 });
  const { data: closedPeriod, error: periodError } = await supabase.from("finance_periods").select("id").eq("competencia", `${competencia}-01`).eq("status", "FECHADO").maybeSingle();
  if (periodError) return NextResponse.json({ error: "Não foi possível verificar o fechamento da competência. Tente novamente." }, { status: 503 });
  if (closedPeriod) return NextResponse.json({ error: "Este mês já foi fechado. Fale com a coordenação financeira antes de enviar novos documentos." }, { status: 409 });
  if (!files.length) return NextResponse.json({ error: "Envie ao menos um arquivo" }, { status: 400 });
  const results = [];
  for (const file of files) {
    if (file.size === 0 || file.size > 10 * 1024 * 1024) { results.push({ file: file.name, status: "FAILED", error: "Arquivo vazio ou maior que 10MB" }); continue; }
    const extension = file.name.toLowerCase().split(".").pop();
    if (!["ofx", "pdf", "xml", "csv", "xlsx", "xls", "jpg", "jpeg", "png", "webp", "heic"].includes(extension ?? "") || (file.type && file.type !== "application/octet-stream" && !ALLOWED_MIME.has(file.type))) { results.push({ file: file.name, status: "FAILED", error: "Tipo de arquivo não permitido. Envie OFX, PDF, CSV, Excel ou imagem." }); continue; }
    const bytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const { data: existing, error: duplicateError } = await supabase.from("finance_imports").select("id,status,storage_path,metadata").eq("file_sha256", sha256).maybeSingle();
    if (duplicateError) { results.push({ file: file.name, status: "FAILED", error: "Não foi possível verificar se o arquivo já foi importado." }); continue; }
    // Reenvio pelo Financeiro com IA de um arquivo que entrou antes pelo
    // leitor sem IA (sem ai_document, sem lançamentos) = releitura automática,
    // não "duplicado". As travas abaixo (lançamentos/conferências) continuam.
    const semLeituraIA = Boolean(existing && !existing.metadata?.ai_document && ["PARTIAL", "FAILED"].includes(existing.status));
    const reprocessing = Boolean(useAI && existing && (form.get("reprocessId") === existing.id || semLeituraIA) && existing.metadata?.competencia === competencia);
    if (existing && !reprocessing) { results.push({ file: file.name, status: "DUPLICATE", importId: existing.id }); continue; }
    if (reprocessing && existing) {
      const [ledger, reviews] = await Promise.all([
        supabase.from("finance_ledger").select("id", { count: "exact", head: true }).eq("import_id", existing.id),
        supabase.from("finance_exceptions").select("id", { count: "exact", head: true }).eq("import_id", existing.id).neq("status", "OPEN"),
      ]);
      if (ledger.error || reviews.error || ledger.count !== 0 || reviews.count !== 0 || existing.metadata?.note_reviewed_at) { results.push({ file: file.name, status: "FAILED", error: "Este arquivo já tem lançamentos ou conferências. Revise os registros existentes para preservar o histórico." }); continue; }
      const { data: claimed, error } = await supabase.from("finance_imports").update({ status: "PROCESSING" }).eq("id", existing.id).neq("status", "PROCESSING").select("id").maybeSingle();
      if (error || !claimed) { results.push({ file: file.name, status: "FAILED", error: "Este arquivo já está sendo processado ou o mês foi fechado." }); continue; }
    }
    let driveFile;
    try {
      if (reprocessing && existing) driveFile = { id: existing.storage_path, webViewLink: existing.metadata?.drive_url };
      else {
        const folder = await getFinancialDriveFolder(competencia, categoria);
        const safeName = file.name.replace(/[\\/<>:"|?*\u0000-\u001f]/g, "_").slice(-180);
        driveFile = await uploadDriveFile(folder.id, safeName, bytes, file.type || "application/octet-stream");
      }
    } catch (error) {
      results.push({ file: file.name, status: "FAILED", error: error instanceof Error ? error.message : "Falha ao arquivar no Drive." });
      continue;
    }
    let parsed: AIParseResult;
    let duplicates: DuplicateCandidate[] = [];
    let sourceDates: string[] = [];
    try {
      parsed = useAI && aiConfig ? await parseDocumentWithAI(file, aiConfig) : await parseFinancialDocument(file);
      sourceDates = parsed.rows.map((row) => row.date).sort();
      if (useAI && parsed.rows.length) {
        const dates = sourceDates;
        const existingRows = await allFinancialRows<ExistingMovement>(supabase, "finance_ledger", "id,movement_date,type,net_amount,normalized_description,external_transaction_id,provider:finance_entities!provider_id(name)", (query) => query.gte("movement_date", dates[0]).lte("movement_date", dates.at(-1)!).not("reconciliation_status", "in", "(IGNORADO,DUPLICADO)"));
        const checked = separateDuplicates(parsed.rows, existingRows);
        parsed.rows = checked.rows; duplicates = checked.duplicates;
      }
    } catch (error) {
      parsed = { format: "PDF" as const, sourceType: "UNKNOWN", rows: [], warnings: [`Falha na leitura automática: ${error instanceof Error ? error.message : "arquivo não processado"}`] };
    }
    const dates = sourceDates;
    const dateRangeWarning = dates.length && dates.some((date) => date.slice(0, 7) !== competencia)
      ? [`Período fora da competência: o conteúdo inclui datas diferentes da competência selecionada (${competencia}); confira o documento antes de confirmar.`]
      : [];
    const allWarnings = [...parsed.warnings, ...dateRangeWarning];
    const importPayload = { file_name: file.name, file_sha256: sha256, mime_type: file.type || "application/octet-stream", file_size: file.size, storage_path: driveFile.id, source_type: parsed.sourceType, provider: parsed.provider ?? null, period_start: dates[0] ?? null, period_end: dates.at(-1) ?? null, status: "PROCESSING", row_count: parsed.rows.length, metadata: { format: parsed.format, warnings: allWarnings, drive_url: driveFile.webViewLink ?? null, competencia, categoria, ai_document: parsed.aiDocument ?? null, ai_model: parsed.aiModel ?? null, reading_version: FINANCIAL_READING_VERSION, information: parsed.information ?? [], alerts: parsed.alerts ?? [] }, created_by: user.id };
    const { data: imported, error: importError } = reprocessing && existing
      ? await supabase.from("finance_imports").update(importPayload).eq("id", existing.id).select("id").single()
      : await supabase.from("finance_imports").insert(importPayload).select("id").single();
    if (importError || !imported) { results.push({ file: file.name, status: "FAILED", error: importError?.message ?? "Falha ao registrar importação" }); continue; }
    const entityIds = new Map<string, string | null>();
    for (const row of parsed.rows) {
      if (row.category && !entityIds.has(`CATEGORY:${row.category}`)) entityIds.set(`CATEGORY:${row.category}`, await ensureEntity(supabase, "CATEGORY", row.category));
      if (row.provider && !entityIds.has(`PROVIDER:${row.provider}`)) entityIds.set(`PROVIDER:${row.provider}`, await ensureEntity(supabase, "PROVIDER", row.provider));
    }
    const ledgerRows = parsed.rows.map((row) => ({ id: crypto.randomUUID(), import_id: imported.id, file_name: file.name, sheet_name: row.sheet ?? null, source_line: row.line, line_hash: row.lineHash, external_transaction_id: row.externalId ?? null, movement_date: row.date, sale_date: row.saleDate ?? null, settlement_date: row.settlementDate ?? null, expected_date: row.expectedDate ?? null, type: row.type, original_description: row.description, normalized_description: row.normalizedDescription, gross_amount: row.gross, fee_amount: row.fee, tax_amount: row.tax, refund_amount: row.refund, chargeback_amount: row.chargeback, net_amount: row.net, inflow: row.inflow, outflow: row.outflow, category_id: row.category ? entityIds.get(`CATEGORY:${row.category}`) : null, provider_id: row.provider ? entityIds.get(`PROVIDER:${row.provider}`) : (parsed.provider ? entityIds.get(`PROVIDER:${parsed.provider}`) : null), reconciliation_status: "PENDENTE", confidence: row.confidence, classification_explanation: row.explanation }));
    const uncertain = ledgerRows.filter((row) => Number(row.confidence) < 0.8);
    const exceptions = [
      ...duplicates.map((duplicate) => ({ import_id: imported.id, problem: `Possível duplicidade: ${duplicate.row.description}`, affected_amount: duplicate.row.net, alternatives: [duplicate], recommendation: "Confira os candidatos e mescle com o registro existente para manter a origem sem duplicar o caixa.", status: "OPEN" as const })),
      ...allWarnings.map((problem) => ({ import_id: imported.id, problem, recommendation: "Confira o arquivo original no Drive e complete os dados manualmente.", status: "OPEN" as const })),
      ...uncertain.map((row) => ({ import_id: imported.id, problem: `Classificação com baixa confiança: ${row.original_description}`, affected_amount: row.net_amount, ledger_ids: [row.id], recommendation: "Revise data, descrição e valor antes de considerar este lançamento conferido.", status: "OPEN" as const })),
    ].map((exception) => ({ affected_amount: 0, ledger_ids: [] as string[], alternatives: [] as unknown[], ...exception }));
    const { error: commitError } = await supabase.rpc("finance_commit_import", { p_import: imported.id, p_rows: ledgerRows, p_exceptions: exceptions });
    if (commitError) {
      console.error("financeiro import commit", { importId: imported.id, error: commitError.message });
      await supabase.from("finance_imports").update({ status: "FAILED", error_message: commitError.message }).eq("id", imported.id);
      results.push({ file: file.name, status: "FAILED", importId: imported.id, error: "Falha ao gravar o processamento. Nenhum novo movimento foi efetivado; tente reler o arquivo." }); continue;
    }
    results.push({ file: file.name, status: allWarnings.length || uncertain.length || duplicates.length ? "PARTIAL" : "PROCESSED", importId: imported.id, rows: parsed.rows.length, warnings: allWarnings, uncertain: uncertain.length, provider: parsed.provider ?? null, sourceType: parsed.sourceType, duplicates: duplicates.length, document: parsed.aiDocument ?? null, information: parsed.information ?? [], alerts: parsed.alerts ?? [], suggestedCompetencia: dates.length && dates[0].slice(0,7) === dates.at(-1)?.slice(0,7) ? dates[0].slice(0,7) : null });
  }
  return NextResponse.json({ results });
}

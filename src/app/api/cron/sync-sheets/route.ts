// src/app/api/cron/sync-sheets/route.ts
// GET /api/cron/sync-sheets — Vercel Cron-triggered, CRON_SECRET-gated
// Route Handler. This is Phase 9's only new server entry point and the
// second place createAdminClient() is imported outside a test file (see
// src/lib/supabase/admin.ts's restriction comment) — a cron context has no
// user session, so every database write uses the trusted service-role
// client, exactly like Phase 7's reminders route.
//
// Flow mirrors src/app/api/cron/reminders/route.ts step-for-step
// (09-RESEARCH.md's "copy Phase 7, change the data source" framing):
//   1. Bearer-token gate against CRON_SECRET
//   2. sheet_sync_runs row created FIRST (visible even on crash)
//   3. Fetch the sheet range as a service account (readonly scope)
//   4. Parse raw rows through zod validation (src/lib/sheets/parse-rows.ts)
//   5. Whole-table replace of financial_entries (never a merge — the sheet
//      is the source of truth, per 09-RESEARCH.md Architecture Item 1)
//   6. Run-row finalized success|failed with entries_count
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSheetsClient } from "@/lib/sheets/client";
import { parseSheetRows } from "@/lib/sheets/parse-rows";

export async function GET(request: NextRequest) {
  // 1. Authenticate the REQUEST itself — fails closed if CRON_SECRET is
  // unset (a missing secret is never "no auth required"), rejected before
  // any database or Sheets call. Same gate as the reminders route.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Trusted service-role client; the Sheets client is built lazily
  // below (its credential parse throws — that must land in the run log,
  // not outside it).
  const supabase = createAdminClient();

  // 3. Create the sheet_sync_runs row FIRST — exists even if everything
  // after this point crashes (FIN-03's "failure is visible, never silently
  // swallowed", the same lifecycle Phase 7 proved for reminder_runs).
  const { data: run, error: runInsertError } = await supabase
    .from("sheet_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (runInsertError || !run) {
    return Response.json(
      { error: "failed to start sync run" },
      { status: 500 }
    );
  }

  const runId = run.id as number;

  // Helper used by BOTH success and failure paths below — the run row is
  // finalized exactly once, never left 'running' forever.
  async function finalize(status: "success" | "failed", entriesCount: number, errorMessage?: string) {
    await supabase
      .from("sheet_sync_runs")
      .update({
        status,
        finished_at: new Date().toISOString(),
        entries_count: entriesCount,
        error_message: errorMessage,
      })
      .eq("id", runId);
  }

  try {
    // 4. Env config check — the spreadsheet identity is human-set (real
    // sheet unknown to code); a missing value is a FAILED run with a clear
    // message, never a silent no-op.
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const range = process.env.SPREADSHEET_RANGE ?? "A:E";
    if (!spreadsheetId) {
      throw new Error("Falta variável de ambiente: SPREADSHEET_ID");
    }

    // 5. Build the service-account client and fetch the raw values. The
    // googleapis client throws on any non-2xx response, so a resolved call
    // guarantees the request was accepted; values may still be undefined
    // for an empty range, which parseSheetRows treats as zero entries.
    const { client } = createSheetsClient();
    const { data: sheetData } = await client.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    // 6. Parse through the zod validation layer — null means the batch was
    // rejected (invalid row), empty means "no data rows" (a legitimate
    // success with 0 entries).
    const entries = parseSheetRows(sheetData?.values ?? []);

    if (entries === null) {
      throw new Error(
        "Linha inválida na planilha — sincronização rejeitada. Verifique o layout das colunas (parse-rows.ts)."
      );
    }

    // 7. Whole-table replace, single transaction-shaped sequence: delete
    // all, then insert the fresh batch. The sheet is the system of record;
    // financial_entries always mirrors it exactly (09-RESEARCH.md
    // Architecture Item 1).
    const { error: deleteError } = await supabase
      .from("financial_entries")
      .delete()
      .gte("id", 0);

    if (deleteError) {
      throw new Error(`falha ao limpar financial_entries: ${deleteError.message}`);
    }

    if (entries.length > 0) {
      const { error: insertError } = await supabase
        .from("financial_entries")
        .insert(entries.map((entry) => ({
          tipo: entry.tipo,
          descricao: entry.descricao,
          valor: entry.valor,
          data: entry.data,
          categoria: entry.categoria,
        })));

      if (insertError) {
        throw new Error(`falha ao inserir financial_entries: ${insertError.message}`);
      }
    }

    // 8. Finalize the run row — success with the parsed entry count.
    await finalize("success", entries.length);

    return Response.json({ entriesCount: entries.length });
  } catch (err) {
    // A thrown exception mid-run still leaves a traceable, non-'running'-
    // forever row (FIN-03, 09-RESEARCH.md Pattern 3).
    const message = err instanceof Error ? err.message : "erro desconhecido";
    await finalize("failed", 0, message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}

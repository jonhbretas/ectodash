// src/app/api/cron/reminders/route.ts
// GET /api/cron/reminders — Vercel Cron-triggered, CRON_SECRET-gated Route
// Handler. This is the phase's only new server entry point and the sole
// place createAdminClient() is imported outside a test file (see
// src/lib/supabase/admin.ts's own restriction comment).
//
// Composes plan 07-01's schema (reminder_runs, demanda_reminders_log) and
// eligibility classifier (reminderTipoFor) into the actual daily reminder
// mechanism. Structure follows 07-RESEARCH.md's "Cron route skeleton" Code
// Example, adapted to this repo's real import paths.
import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { reminderTipoFor } from "@/lib/reminders/eligibility";
import { sendReminder } from "@/lib/reminders/send-reminder";

// Days from today (inclusive) that count as "prazo próximo" for the
// eligibility query's own date-window predicate. Mirrors
// APPROACHING_PRAZO_DAYS in src/lib/reminders/eligibility.ts — kept as a
// separate literal here only because this one feeds a Postgres .lte() date
// string, not the reminderTipoFor() classifier itself (which remains the
// single source of truth for the actual atrasada/aproximando/null decision
// applied per row below).
const APPROACHING_WINDOW_DAYS = 3;

interface DemandaRow {
  id: number;
  titulo: string;
  prazo: string;
  status: "pendente" | "em_andamento" | "concluida";
  atrasada: boolean;
}

interface ResponsavelRow {
  // Nullable since migration 0020/0021: a row can target a roster-only
  // volunteer (voluntario_id) with no auth account, leaving profile_id NULL.
  profile_id: string | null;
  profiles: { email: string } | { email: string }[] | null;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!authHeader || !constantTimeEqual(authHeader, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Build the trusted, service-role client and the Resend SDK client.
  // Nothing before this point touches the database or Resend.
  const supabase = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);

  // 3. Create the reminder_runs row FIRST, before the eligibility query runs
  // — this row exists even if everything after this point crashes,
  // satisfying LEMB-04's "failure is visible, never silently swallowed"
  // requirement.
  const { data: run, error: runInsertError } = await supabase
    .from("reminder_runs")
    .insert({ status: "running" })
    .select("id")
    .single();

  if (runInsertError || !run) {
    return Response.json(
      { error: "failed to start reminder run" },
      { status: 500 }
    );
  }

  const runId = run.id as number;

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  let skippedNoResponsavel = 0;

  try {
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + APPROACHING_WINDOW_DAYS);
    const windowEndISO = windowEnd.toISOString().slice(0, 10);

    // One query serves BOTH LEMB-01 (approaching) and LEMB-02 (atrasada) —
    // never two separate queries or a client-side re-filter pass
    // (07-RESEARCH.md Pattern 1).
    const { data: demandas, error: demandasError } = await supabase
      .from("demandas_com_status")
      .select("id, titulo, prazo, status, atrasada")
      .neq("status", "concluida")
      .or(`atrasada.eq.true,prazo.lte.${windowEndISO}`);

    if (demandasError) {
      throw new Error(demandasError.message);
    }

    for (const demanda of (demandas ?? []) as DemandaRow[]) {
      // reminderTipoFor() is the SOLE source of truth for the
      // atrasada/aproximando/null classification — never re-derived inline.
      const tipo = reminderTipoFor(demanda);
      if (!tipo) continue;

      const [responsaveisResult, membrosResult] = await Promise.all([
        supabase
          .from("demanda_responsaveis")
          .select("profile_id, profiles(email)")
          .eq("demanda_id", demanda.id),
        supabase
          .from("demanda_membros")
          .select("profile_id, profiles(email)")
          .eq("demanda_id", demanda.id),
      ]);

      const responsaveis = responsaveisResult.data ?? [];
      const membros = membrosResult.data ?? [];

      // A demanda with zero responsáveis AND zero membros is explicitly
      // tracked, never silently dropped (07-RESEARCH.md Pitfall 4).
      if (responsaveis.length === 0 && membros.length === 0) {
        skippedNoResponsavel++;
        continue;
      }

      // Union responsáveis + membros, deduped by profile_id — an
      // acompanhante who is also responsável gets exactly one reminder,
      // and the LEMB-03 dedup granularity stays per-recipient. Roster-only
      // rows (profile_id NULL) dedupe on the null key: the one null key
      // collapses all such rows to a single recipient, which is correct —
      // none of them can receive an email anyway (guard below).
      const destinatarios = new Map<string | null, ResponsavelRow>();
      for (const row of [...responsaveis, ...membros] as ResponsavelRow[]) {
        if (!destinatarios.has(row.profile_id)) {
          destinatarios.set(row.profile_id, row);
        }
      }

      // Loop over (demanda, destinatário) PAIRS — LEMB-03's dedup
      // granularity is per-recipient, not per-demanda
      // (07-RESEARCH.md Anti-Patterns).
      for (const responsavel of destinatarios.values()) {
        // A roster-only volunteer (demanda_responsaveis/membros row with
        // voluntario_id set, profile_id NULL since migrations 0020/0021)
        // has no auth account and therefore no resolvable email — skip
        // BEFORE the dedup insert, because profile_id is NOT NULL in
        // demanda_reminders_log and inserting null would crash the whole
        // run with a 23502 violation (exactly the failure the run-log
        // panel showed). Same "explicitly tracked, never silently dropped"
        // semantics as the zero-destinatários case above.
        if (!responsavel.profile_id) {
          skippedNoResponsavel++;
          continue;
        }

        // 4. Dedup check IS the atomic insert-with-conflict-handling below —
        // never a separate SELECT-then-conditional-INSERT (07-RESEARCH.md
        // Pattern 2, Anti-Patterns). This insert claims today's slot before
        // any send; a 23505 unique-violation on the claim itself is the skip
        // signal (handled below), expressed via the Supabase client's own
        // insert+select+error-code idiom rather than a raw SQL upsert clause.
        const { data: dedupRow, error: dedupError } = await supabase
          .from("demanda_reminders_log")
          .insert({
            demanda_id: demanda.id,
            profile_id: responsavel.profile_id,
            tipo,
            run_id: runId,
          })
          .select("id")
          .single();

        if (dedupError) {
          // 23505 = unique_violation: already reminded today for this exact
          // (demanda, profile, tipo) tuple. Skip silently — counts as
          // skipped, not failed. Handled defensively for either error-code
          // shape the Supabase client may surface.
          if (dedupError.code === "23505") {
            skippedCount++;
            continue;
          }
          throw new Error(dedupError.message);
        }

        if (!dedupRow) {
          // Defensive: some client/driver combinations may surface a
          // conflict as a null result rather than a thrown error.
          skippedCount++;
          continue;
        }

        const profileRow = Array.isArray(responsavel.profiles)
          ? responsavel.profiles[0]
          : responsavel.profiles;

        if (!profileRow?.email) {
          // No resolvable email for this responsável — the dedup slot is
          // already claimed (correctly, since a retry today would just hit
          // the same conflict); mark this claimed row failed rather than
          // silently leaving it 'pending' forever.
          await supabase
            .from("demanda_reminders_log")
            .update({
              status: "failed",
              error_message: "responsável sem e-mail resolvível",
            })
            .eq("id", dedupRow.id);
          failedCount++;
          continue;
        }

        // 5. Send — via the resend package directly, never through Supabase
        // Auth's SMTP relay (07-RESEARCH.md Pitfall 1).
        const { error: sendError } = await sendReminder({
          resend,
          to: profileRow.email,
          titulo: demanda.titulo,
          prazoFormatado: format(new Date(demanda.prazo), "dd/MM/yyyy", {
            locale: ptBR,
          }),
          tipo,
        });

        // 6. Mark the already-claimed dedup row sent|failed — NEVER deleted,
        // NEVER retried later this same run (07-RESEARCH.md resolved Open
        // Question 1: a failed send waits until tomorrow's run).
        await supabase
          .from("demanda_reminders_log")
          .update({
            status: sendError ? "failed" : "sent",
            error_message: sendError,
          })
          .eq("id", dedupRow.id);

        if (sendError) {
          failedCount++;
        } else {
          sentCount++;
        }
      }
    }

    // 7. Final run-summary update — happens exactly once, after the loop.
    await supabase
      .from("reminder_runs")
      .update({
        status: failedCount > 0 ? "partial_failure" : "success",
        finished_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
        skipped_count: skippedCount + skippedNoResponsavel,
      })
      .eq("id", runId);

    return Response.json({
      sentCount,
      failedCount,
      skippedCount,
      skippedNoResponsavel,
    });
  } catch (err) {
    // A thrown exception mid-run still leaves a traceable, non-'running'-
    // forever row — never an indefinitely 'running' row with no trace
    // (LEMB-04, 07-RESEARCH.md Pattern 3).
    await supabase
      .from("reminder_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        sent_count: sentCount,
        failed_count: failedCount,
        skipped_count: skippedCount + skippedNoResponsavel,
        error_message: err instanceof Error ? err.message : "unknown error",
      })
      .eq("id", runId);

    return Response.json({ error: "internal error" }, { status: 500 });
  }
}

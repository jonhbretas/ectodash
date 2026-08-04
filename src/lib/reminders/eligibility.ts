// src/lib/reminders/eligibility.ts
// Pure eligibility classifier for LEMB-01/LEMB-02: given a row shaped like
// demandas_com_status, decide whether a reminder is due today and, if so,
// which tipo ("atrasada" | "aproximando"). No I/O, no database access — the
// cron route (plan 07-02) imports this directly rather than re-deriving the
// same classification logic in a raw SQL predicate, so the two always agree.
// Source: 07-RESEARCH.md Pattern 1 / Code Examples (date-fns version).

import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";

// Hardcoded, never read from process.env, a database row, or an admin UI
// field — 07-RESEARCH.md's Alternatives Considered explicitly rejects
// configurability here as speculative complexity for v1.
export const APPROACHING_PRAZO_DAYS = 3;

export type ReminderTipo = "atrasada" | "aproximando";

export function reminderTipoFor(row: {
  prazo: string;
  status: "pendente" | "em_andamento" | "concluida";
  atrasada: boolean;
}): ReminderTipo | null {
  // Concluída always wins, even over atrasada=true — a completed demanda
  // never needs a reminder regardless of how overdue its prazo was.
  if (row.status === "concluida") return null;

  // Atrasada overrides the prazo-window check entirely — an overdue demanda
  // is always reminded, no matter how far in the future a (data-inconsistent)
  // prazo might otherwise compute to.
  if (row.atrasada) return "atrasada";

  // `row.prazo` is a plain "YYYY-MM-DD" date string with no time-of-day
  // meaning. `new Date(row.prazo)` parses it as UTC midnight, which in any
  // timezone west of UTC (e.g. this project's own Brasília/UTC-3 context)
  // shifts it to the PREVIOUS calendar day once converted to local time —
  // a real off-by-one bug in the day-count boundary this function exists
  // to compute correctly. `parseISO` parses the same string as a LOCAL
  // calendar date instead, avoiding that UTC round-trip entirely.
  const daysUntilPrazo = differenceInCalendarDays(
    startOfDay(parseISO(row.prazo)),
    startOfDay(new Date())
  );

  return daysUntilPrazo >= 0 && daysUntilPrazo <= APPROACHING_PRAZO_DAYS
    ? "aproximando"
    : null;
}

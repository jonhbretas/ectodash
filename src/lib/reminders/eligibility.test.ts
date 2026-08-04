// src/lib/reminders/eligibility.test.ts
// Pure-unit tests for reminderTipoFor() — no live database, no
// describe.skipIf. Dates are computed relative to "today" (via date-fns
// helpers mirrored inline) so this suite stays correct regardless of when
// it runs, rather than hardcoding a date string that would eventually put
// a "future" fixture in the past.

import { describe, expect, it } from "vitest";
import { APPROACHING_PRAZO_DAYS, reminderTipoFor } from "./eligibility";

function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // Build the date string from LOCAL date components, not
  // `toISOString().slice(0, 10)` — toISOString converts to UTC first,
  // which shifts the calendar day (and therefore the day-count boundary
  // this suite is testing) depending on the runner's local timezone
  // offset relative to UTC.
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("reminderTipoFor", () => {
  it("atrasada: true -> 'atrasada', regardless of a prazo far in the future (atrasada overrides the prazo-window check entirely)", () => {
    const result = reminderTipoFor({
      prazo: isoDateOffset(365),
      status: "pendente",
      atrasada: true,
    });

    expect(result).toBe("atrasada");
  });

  it("status: 'concluida', atrasada: true -> null (concluída always wins, even over atrasada)", () => {
    const result = reminderTipoFor({
      prazo: isoDateOffset(-30),
      status: "concluida",
      atrasada: true,
    });

    expect(result).toBeNull();
  });

  it("status: 'concluida', prazo in the future -> null", () => {
    const result = reminderTipoFor({
      prazo: isoDateOffset(10),
      status: "concluida",
      atrasada: false,
    });

    expect(result).toBeNull();
  });

  it("non-concluded, non-atrasada demanda with prazo exactly APPROACHING_PRAZO_DAYS (3) days from today -> 'aproximando' (inclusive boundary)", () => {
    const result = reminderTipoFor({
      prazo: isoDateOffset(APPROACHING_PRAZO_DAYS),
      status: "pendente",
      atrasada: false,
    });

    expect(result).toBe("aproximando");
  });

  it("non-concluded, non-atrasada demanda with prazo 4 days from today -> null (exclusive boundary, one day past the window)", () => {
    const result = reminderTipoFor({
      prazo: isoDateOffset(APPROACHING_PRAZO_DAYS + 1),
      status: "em_andamento",
      atrasada: false,
    });

    expect(result).toBeNull();
  });

  it("non-concluded, non-atrasada demanda with prazo today (0 days out) -> 'aproximando'", () => {
    const result = reminderTipoFor({
      prazo: isoDateOffset(0),
      status: "pendente",
      atrasada: false,
    });

    expect(result).toBe("aproximando");
  });

  it("non-concluded, non-atrasada demanda with a prazo far in the past but atrasada: false -> null (data-inconsistency defensive case; negative daysUntilPrazo fails the >= 0 check)", () => {
    const result = reminderTipoFor({
      prazo: isoDateOffset(-30),
      status: "pendente",
      atrasada: false,
    });

    expect(result).toBeNull();
  });
});

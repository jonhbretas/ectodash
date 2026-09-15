import { describe, expect, it } from "vitest";
import { proximaTerca, formatarDataISO } from "./proxima-reuniao";

// 15/09/2026 é uma terça-feira. BRT = UTC-3 (sem horário de verão).
// Constrói os instantes em UTC para equivaler ao horário BRT desejado.
const brt = (y: number, mo: number, d: number, h: number, mi: number) =>
  new Date(Date.UTC(y, mo - 1, d, h + 3, mi));

const iso = (d: Date) => formatarDataISO(d);

describe("proximaTerca — corte terça 19h", () => {
  it("terça 01:36 vale para hoje", () => {
    expect(iso(proximaTerca(brt(2026, 9, 15, 1, 36)))).toBe("2026-09-15");
  });

  it("terça 18:59 ainda vale para hoje", () => {
    expect(iso(proximaTerca(brt(2026, 9, 15, 18, 59)))).toBe("2026-09-15");
  });

  it("terça 19:00 já cai na próxima terça", () => {
    expect(iso(proximaTerca(brt(2026, 9, 15, 19, 0)))).toBe("2026-09-22");
  });

  it("terça 21:00 cai na próxima terça", () => {
    expect(iso(proximaTerca(brt(2026, 9, 15, 21, 0)))).toBe("2026-09-22");
  });

  it("quarta cai na próxima terça", () => {
    expect(iso(proximaTerca(brt(2026, 9, 16, 10, 0)))).toBe("2026-09-22");
  });

  it("segunda aponta para a terça imediata", () => {
    expect(iso(proximaTerca(brt(2026, 9, 14, 10, 0)))).toBe("2026-09-15");
  });
});

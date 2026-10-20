import { describe, expect, it } from "vitest";
import { normalizarDatasEHorarios, normalizarHorario, removerNulos } from "./pos-filtro";

describe("normalizarHorario", () => {
  it.each([
    ["6:56:47 PM", "18:56"],
    ["18:56:47", "18:56"],
    ["19h01", "19:01"],
    ["12:05 AM", "00:05"],
    ["07:30", "07:30"],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarHorario(entrada)).toBe(esperado);
  });
  it("descarta formato irreconhecível", () => {
    expect(normalizarHorario("noite")).toBeUndefined();
  });
});

describe("normalizarDatasEHorarios", () => {
  it("corrige horário da ata e remove datas fora do ISO", () => {
    expect(normalizarDatasEHorarios({
      ata: { horario: "6:56:47 PM", data: "13/10/2026" },
      eventos: [{ nome: "A", data: "2026-11-01" }, { nome: "B", data: "1 de novembro" }],
    })).toEqual({
      ata: { horario: "18:56" },
      eventos: [{ nome: "A", data: "2026-11-01" }, { nome: "B" }],
    });
  });
});

describe("removerNulos", () => {
  it("remove chaves nulas em qualquer profundidade e nulos em listas", () => {
    expect(removerNulos({
      titulo: "Reunião",
      ata: { data: null, horario: null, participantes: ["Ana", null] },
      eventos: [{ nome: "Curso", local: null, evidencia: null }],
      zero: 0,
      vazio: "",
    })).toEqual({
      titulo: "Reunião",
      ata: { participantes: ["Ana"] },
      eventos: [{ nome: "Curso" }],
      zero: 0,
      vazio: "",
    });
  });
});

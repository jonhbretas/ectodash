import { describe, expect, it } from "vitest";
import { removerNulos } from "./pos-filtro";

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

import { describe, expect, it } from "vitest";
import { filtrarVoluntariosPorLocalidade } from "./escala-localidade";

const localidades = [
  { id: 3, nome: "Curitiba" },
  { id: 4, nome: "Foz do Iguaçu - Sede" },
];

describe("filtrarVoluntariosPorLocalidade", () => {
  it("inclui Foz/Sede e os cadastros legados ECTOLAB, mas exclui outras cidades", () => {
    const voluntarios = [
      { id: 1, unidade: "Foz do Iguaçu - Sede", localidade_id: 4 },
      { id: 2, unidade: "ECTOLAB", localidade_id: null },
      { id: 3, unidade: "ECTOLAB (FOZ/SEDE)", localidade_id: null },
      { id: 4, unidade: "Curitiba", localidade_id: 3 },
    ];

    const resultado = filtrarVoluntariosPorLocalidade(
      voluntarios,
      "Foz do Iguaçu - Sede",
      localidades,
      new Set()
    );

    expect(resultado.map((voluntario) => voluntario.id)).toEqual([1, 2, 3]);
  });

  it("resolve o alias ECTOLAB (FOZ/SEDE) para a localidade canônica", () => {
    const voluntarios = [
      { id: 1, unidade: "Foz do Iguaçu - Sede", localidade_id: 4 },
      { id: 2, unidade: "ECTOLAB", localidade_id: null },
      { id: 3, unidade: "São Paulo", localidade_id: 8 },
    ];

    const resultado = filtrarVoluntariosPorLocalidade(
      voluntarios,
      "ECTOLAB (FOZ/SEDE)",
      localidades,
      new Set()
    );

    expect(resultado.map((voluntario) => voluntario.id)).toEqual([1, 2]);
  });

  it("mantém um vínculo explícito mesmo quando o cadastro usa outra unidade", () => {
    const voluntarios = [
      { id: 1, unidade: "São Paulo", localidade_id: 8 },
      { id: 2, unidade: "Curitiba", localidade_id: 3 },
    ];

    const resultado = filtrarVoluntariosPorLocalidade(
      voluntarios,
      "Foz do Iguaçu - Sede",
      localidades,
      new Set([1])
    );

    expect(resultado.map((voluntario) => voluntario.id)).toEqual([1]);
  });
});

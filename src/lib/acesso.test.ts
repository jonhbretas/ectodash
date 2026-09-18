// src/lib/acesso.test.ts
// Kill switch global (0105) + regras de acesso ao Marketing (0104).
import { describe, expect, it } from "vitest";
import { podeAcessar, type Acesso } from "./acesso";

const comum: Acesso = { role: "voluntario_comum", cargos: [] };
const comumOff: Acesso = {
  role: "voluntario_comum",
  cargos: [],
  modulosDesativados: ["demandas"],
};
const comCargoMarketing: Acesso = {
  role: "voluntario_comum",
  cargos: [
    {
      cargo_id: 1,
      nivel: "coordenador_area",
      area_id: 2,
      area_nome: "Comunicação",
      localidade_id: null,
      localidade_nome: null,
      modulos: ["marketing"],
    },
  ],
};
const geral: Acesso = { role: "coordenador_geral", cargos: [] };
const geralOff: Acesso = {
  role: "coordenador_geral",
  cargos: [],
  modulosDesativados: ["demandas", "marketing"],
};

describe("kill switch (modulosDesativados)", () => {
  it("módulo desativado some p/ usuário comum", () => {
    expect(podeAcessar(comumOff, "demandas")).toBe(false);
  });

  it("módulo ativo segue normal p/ usuário comum (leitura)", () => {
    expect(podeAcessar(comum, "demandas")).toBe("ler");
  });

  it("coordenador geral passa pelo kill switch (diagnosticar e religar)", () => {
    expect(podeAcessar(geralOff, "demandas")).toBe("gerenciar");
    expect(podeAcessar(geralOff, "marketing")).toBe("gerenciar");
  });

  it("sem a lista, nada muda (fail-open)", () => {
    expect(podeAcessar(comum, "marketing")).toBe(false); // restrito por PII
    expect(podeAcessar(geral, "marketing")).toBe("gerenciar");
  });
});

describe("marketing p/ comunicação", () => {
  it("cargo com módulo marketing gerencia", () => {
    expect(podeAcessar(comCargoMarketing, "marketing")).toBe("gerenciar");
  });

  it("cargo com módulo marketing não abre outros restritos", () => {
    expect(podeAcessar(comCargoMarketing, "financeiro")).toBe(false);
  });
});

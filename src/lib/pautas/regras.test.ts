import { describe, expect, it } from "vitest";
import {
  calcularResultadoVotacao,
  contarVotos,
  pautasSimilares,
} from "./regras";

describe("calcularResultadoVotacao", () => {
  it("aprova quando aprovar > rejeitar e há quórum", () => {
    expect(calcularResultadoVotacao({ aprovar: 2, rejeitar: 1, abster: 0 }, 3)).toBe("aprovada");
  });
  it("empate não aprova", () => {
    expect(calcularResultadoVotacao({ aprovar: 1, rejeitar: 1, abster: 1 }, 3)).toBe("rejeitada");
  });
  it("sem quórum quando o total é menor que o mínimo", () => {
    expect(calcularResultadoVotacao({ aprovar: 2, rejeitar: 0, abster: 0 }, 3)).toBe("sem_quorum");
  });
  it("abstenções contam para o quórum", () => {
    expect(calcularResultadoVotacao({ aprovar: 1, rejeitar: 0, abster: 2 }, 3)).toBe("aprovada");
  });
  it("zero votos é sem quórum", () => {
    expect(calcularResultadoVotacao({ aprovar: 0, rejeitar: 0, abster: 0 }, 3)).toBe("sem_quorum");
  });
});

describe("contarVotos", () => {
  it("conta por tipo e total", () => {
    expect(
      contarVotos([{ voto: "aprovar" }, { voto: "aprovar" }, { voto: "abster" }, { voto: "rejeitar" }])
    ).toEqual({ aprovar: 2, rejeitar: 1, abster: 1, total: 4 });
  });
});

describe("pautasSimilares", () => {
  it("encontra títulos parecidos ignorando acento e caixa", () => {
    const r = pautasSimilares("Compra de microscópio novo", [
      { id: 1, titulo: "Compra do microscopio" },
      { id: 2, titulo: "Festa junina" },
    ]);
    expect(r.map((x) => x.id)).toEqual([1]);
  });
  it("limita a 5 e ordena pelo melhor score", () => {
    const candidatos = Array.from({ length: 8 }, (_, i) => ({
      id: i + 1,
      titulo: i === 4 ? "Reforma telhado laboratorio" : `Reforma telhado laboratorio extra${i}`,
    }));
    const r = pautasSimilares("Reforma telhado laboratorio", candidatos);
    expect(r.length).toBeLessThanOrEqual(5);
    expect(r[0].id).toBe(5);
  });
  it("títulos vazios ou curtos retornam []", () => {
    expect(pautasSimilares("", [{ id: 1, titulo: "abc" }])).toEqual([]);
    expect(pautasSimilares("oi", [{ id: 1, titulo: "oi" }])).toEqual([]);
  });
});

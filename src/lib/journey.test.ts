import { describe, expect, it } from "vitest";
import { journeySteps, journeySummary } from "./journey";

describe("progresso da jornada", () => {
  it("começa na integração sem pontos fictícios", () => {
    expect(journeySummary([])).toMatchObject({ done: 0, points: 0, percent: 0, next: { id: "voluntario:boas-vindas" } });
  });

  it("não conta etapas duplicadas ou desconhecidas", () => {
    expect(journeySummary(["voluntario:boas-vindas", "voluntario:boas-vindas", "invalida", "sistema:perfil"]))
      .toMatchObject({ done: 2, points: 30, next: { id: "voluntario:fundamentos" } });
  });

  it("calcula a próxima etapa independentemente em cada trilha", () => {
    const docente = journeySteps.filter((step) => step.track === "docente");
    expect(journeySummary(["docente:livro", "docente:proep", "voluntario:boas-vindas"], docente))
      .toMatchObject({ done: 2, total: 7, points: 40, next: { id: "docente:curso-ead" } });
  });

  it("conclui a exploração sem repetir pontos em revisitas", () => {
    const all = journeySteps.map((step) => step.id);
    expect(journeySummary([...all, ...all])).toMatchObject({ done: 15, points: 270, percent: 100, next: undefined });
  });

  it("restringe os totais às áreas disponíveis para a pessoa", () => {
    const steps = journeySteps.filter((step) => step.id === "sistema:perfil");
    expect(journeySummary(["sistema:perfil", "sistema:eventos"], steps)).toMatchObject({ done: 1, total: 1, points: 10, percent: 100 });
  });
});

// src/lib/contratos/variables.test.ts
// Unit tests for the {{token}} placeholder replacement used by contract models.
import { describe, expect, it } from "vitest";
import { aplicarVariaveis } from "./variables";

describe("aplicarVariaveis", () => {
  it("substitui tokens conhecidos pelos valores fornecidos", () => {
    const texto =
      "Contrato de {{aluno_nome}} para o evento {{evento_titulo}} em {{evento_data}}.";
    const resultado = aplicarVariaveis(texto, {
      "{{aluno_nome}}": "Maria Silva",
      "{{evento_titulo}}": "Curso de Autopesquisa",
      "{{evento_data}}": "10/08/2026",
    });
    expect(resultado).toBe(
      "Contrato de Maria Silva para o evento Curso de Autopesquisa em 10/08/2026."
    );
  });

  it("mantém tokens sem valor ou desconhecidos intactos", () => {
    const texto = "Aluno: {{aluno_nome}}. Token desconhecido: {{token_x}}.";
    const resultado = aplicarVariaveis(texto, {});
    expect(resultado).toBe("Aluno: {{aluno_nome}}. Token desconhecido: {{token_x}}.");
  });

  it("não preenche token cujo valor é vazio ou só espaços", () => {
    const texto = "{{aluno_nome}} e {{valor}}";
    const resultado = aplicarVariaveis(texto, {
      "{{aluno_nome}}": "   ",
      "{{valor}}": "",
    });
    expect(resultado).toBe("{{aluno_nome}} e {{valor}}");
  });

  it("substitui o mesmo token em múltiplas ocorrências", () => {
    const texto = "{{aluno_nome}} assina e {{aluno_nome}} confirma.";
    const resultado = aplicarVariaveis(texto, { "{{aluno_nome}}": "João" });
    expect(resultado).toBe("João assina e João confirma.");
  });
});

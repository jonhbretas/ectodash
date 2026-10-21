// src/lib/contratos/formulario.test.ts
import { describe, expect, it } from "vitest";
import { camposDoFormulario, validarRespostaAluno } from "./formulario";
import { ALUNO_VAZIO, mascararEmail, normalizarNome } from "./aluno";

describe("camposDoFormulario", () => {
  it("pede sempre nome, CPF, e-mail e telefone", () => {
    expect(camposDoFormulario("Contrato de {{aluno_nome}}.")).toEqual(["nome", "documento", "email", "telefone"]);
  });

  it("acrescenta os campos que o modelo usa, na ordem padrão", () => {
    expect(camposDoFormulario("Residente em {{aluno_endereco}}, RG {{ aluno_rg }}, nascido em {{aluno_nascimento}}")).toEqual([
      "nome",
      "documento",
      "rg",
      "nascimento",
      "email",
      "telefone",
      "endereco",
    ]);
  });
});

describe("validarRespostaAluno", () => {
  const valido = {
    ...ALUNO_VAZIO,
    nome: "Maria da Silva",
    documento: "529.982.247-25",
    email: "maria@exemplo.com",
    telefone: "45999990000",
  };

  it("aceita resposta completa", () => {
    expect(validarRespostaAluno(valido, ["nome", "documento", "email", "telefone"])).toEqual([]);
  });

  it("exige os campos do modelo e endereço minimamente completo", () => {
    expect(validarRespostaAluno(valido, ["nome", "endereco"])).toContain("Preencha: Endereço completo");
    expect(validarRespostaAluno({ ...valido, endereco: "Rua A" }, ["endereco"])).toContain(
      "Endereço incompleto (rua, número, bairro, cidade/UF, CEP)"
    );
  });

  it("recusa CPF inválido e nascimento no futuro", () => {
    const erros = validarRespostaAluno({ ...valido, documento: "111.111.111-11", nascimento: "01/01/2999" }, []);
    expect(erros).toContain("CPF inválido");
    expect(erros).toContain("Data de nascimento fora do esperado");
  });
});

describe("normalizarNome / mascararEmail", () => {
  it("corrige nomes todo em maiúsculas ou minúsculas", () => {
    expect(normalizarNome("MARIA DA SILVA  DOS SANTOS")).toBe("Maria da Silva dos Santos");
    expect(normalizarNome("joão e souza")).toBe("João e Souza");
    expect(normalizarNome("Ana McDonald")).toBe("Ana McDonald");
  });

  it("mascara o e-mail", () => {
    expect(mascararEmail("andre.pedretti@gmail.com")).toBe("an***@gmail.com");
  });
});

// src/lib/contratos/planilha.test.ts
import { describe, expect, it } from "vitest";
import { lerPlanilha } from "./planilha";
import { cpfValido, dataParaIso, formatarCpf, formatarTelefone, validarAluno } from "./aluno";
import { ALUNO_VAZIO } from "./aluno";

describe("lerPlanilha", () => {
  it("reconhece cabeçalho colado do Google Sheets (tabulação)", () => {
    const texto =
      "Nome completo\tCPF\tE-mail\tTelefone\tEndereço\n" +
      "André Pedretti\t044.071.266-12\tandre@x.com\t41995382020\tRua A, 10 - Curitiba/PR";
    const r = lerPlanilha(texto);
    expect(r.comCabecalho).toBe(true);
    expect(r.alunos).toHaveLength(1);
    expect(r.alunos[0]).toMatchObject({
      nome: "André Pedretti",
      documento: "044.071.266-12",
      email: "andre@x.com",
      telefone: "41995382020",
      endereco: "Rua A, 10 - Curitiba/PR",
    });
  });

  it("lê CSV com ponto e vírgula e aspas com separador dentro", () => {
    const texto =
      'nome;email;endereco\n"Maria Silva";maria@x.com;"Av. B; 200, Foz do Iguaçu"\r\n';
    const r = lerPlanilha(texto);
    expect(r.alunos[0].endereco).toBe("Av. B; 200, Foz do Iguaçu");
    expect(r.alunos[0].email).toBe("maria@x.com");
  });

  it("sem cabeçalho usa a ordem padrão das colunas", () => {
    const r = lerPlanilha("João Souza\t52998224725\t\t\tjoao@x.com");
    expect(r.comCabecalho).toBe(false);
    expect(r.alunos[0]).toMatchObject({
      nome: "João Souza",
      documento: "52998224725",
      email: "joao@x.com",
    });
  });

  it("ignora linhas vazias", () => {
    expect(lerPlanilha("nome\temail\n\n\t\nAna Lima\ta@x.com\n").alunos).toHaveLength(1);
  });
});

describe("validação do aluno", () => {
  it("valida CPF pelos dígitos verificadores", () => {
    expect(cpfValido("044.071.266-12")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("044.071.266-13")).toBe(false);
  });

  it("formata CPF e telefone", () => {
    expect(formatarCpf("04407126612")).toBe("044.071.266-12");
    expect(formatarTelefone("41995382020")).toBe("(41) 99538-2020");
    expect(formatarTelefone("+55 41 99538-2020")).toBe("(41) 99538-2020");
  });

  it("converte datas", () => {
    expect(dataParaIso("5/3/1980")).toBe("1980-03-05");
    expect(dataParaIso("1980-03-05")).toBe("1980-03-05");
    expect(dataParaIso("31/02/1980")).toBeNull();
  });

  it("aponta erros que impedem o envio", () => {
    const { erros } = validarAluno({ ...ALUNO_VAZIO, nome: "Ana Lima", email: "x", documento: "123" });
    expect(erros).toEqual(["E-mail inválido", "CPF inválido"]);
  });
});

// src/lib/marketing/merge-tags.test.ts
import { describe, expect, it } from "vitest";
import { applyMergeTags } from "./merge-tags";

const data = {
  nome: "Maria da Silva",
  email: "maria@exemplo.com",
  unsubscribeUrl: "https://site/descadastrar?token=abc",
};

describe("applyMergeTags", () => {
  it("substitui nome, email, unsub e webversion", () => {
    const out = applyMergeTags(
      "<p>Olá, *|PRIMEIRO_NOME|*</p><a href=\"*|UNSUB|*\">sair</a><a href=\"*|WEBVERSION|*\">web</a><span>*|EMAIL|*</span>",
      data
    );
    expect(out).toContain("Olá, Maria");
    expect(out).toContain('href="https://site/descadastrar?token=abc"');
    expect(out).toContain('href="#"');
    expect(out).toContain("maria@exemplo.com");
    expect(out).not.toMatch(/\*\|[A-Z_]+\|\*/);
  });

  it("aceita minúsculas e preserva desconhecidas", () => {
    const out = applyMergeTags("<p>*|fname|* *|OUTRA|*</p>", data);
    expect(out).toContain("Maria *|OUTRA|*");
  });

  it("sem nome usa amigo(a) e sobrenome vazio", () => {
    const out = applyMergeTags("<p>Olá, *|PRIMEIRO_NOME|* *|SOBRENOME|*!</p>", {
      ...data,
      nome: null,
    });
    expect(out).toContain("Olá, amigo(a) !");
  });
});

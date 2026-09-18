// src/lib/marketing/sanitize.test.ts
// Testes unitários puros (sem banco) da sanitização de leads.
import { describe, expect, it } from "vitest";
import {
  normalizeEmail,
  sanitizeLeads,
  validateEmail,
} from "./sanitize";

describe("normalizeEmail", () => {
  it("lowercase + trim", () => {
    expect(normalizeEmail("  Maria@Gmail.COM ")).toBe("maria@gmail.com");
  });
});

describe("validateEmail", () => {
  it("aceita e-mail válido", () => {
    expect(validateEmail("joao@ectolab.org")).toEqual({ ok: true });
  });

  it("rejeita sem @", () => {
    const r = validateEmail("joaoectolab.org");
    expect(r.ok).toBe(false);
  });

  it("rejeita domínio sem ponto", () => {
    const r = validateEmail("joao@gmail");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/ponto/);
  });

  it("sugere correção p/ typo de domínio", () => {
    const r = validateEmail("joao@gmial.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.suggestion).toBe("joao@gmail.com");
  });

  it("rejeita descartável", () => {
    const r = validateEmail("x@mailinator.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/descartável/);
  });

  it("rejeita pontos duplicados", () => {
    expect(validateEmail("jo..ao@gmail.com").ok).toBe(false);
  });
});

describe("sanitizeLeads", () => {
  it("remove duplicados case-insensitive e conta", () => {
    const r = sanitizeLeads("A@x.com\na@X.com\nb@y.com.br");
    expect(r.valid.map((v) => v.email)).toEqual(["a@x.com", "b@y.com.br"]);
    expect(r.duplicatesRemoved).toBe(1);
    expect(r.invalid).toHaveLength(0);
  });

  it("ignora linhas em branco", () => {
    const r = sanitizeLeads("\n  \na@x.com\n");
    expect(r.valid).toHaveLength(1);
    expect(r.invalid).toHaveLength(0);
  });

  it("extrai nome nos formatos suportados", () => {
    const r = sanitizeLeads(
      "Maria Silva <maria@x.com>\njoao@y.com,João\nana@z.com.br;Ana Souza"
    );
    expect(r.valid).toEqual([
      { email: "maria@x.com", nome: "Maria Silva" },
      { email: "joao@y.com", nome: "João" },
      { email: "ana@z.com.br", nome: "Ana Souza" },
    ]);
  });

  it("separa inválidos com motivo", () => {
    const r = sanitizeLeads("nao-email\nok@x.com\nsem@dominio");
    expect(r.valid).toHaveLength(1);
    expect(r.invalid).toHaveLength(2);
    expect(r.invalid[0].raw).toBe("nao-email");
  });
});

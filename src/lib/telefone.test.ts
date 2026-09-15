import { describe, expect, it } from "vitest";
import { formatarTelefone, linkWhatsApp, telefoneParaWhatsApp } from "./telefone";

describe("telefoneParaWhatsApp", () => {
  it("prefixa 55 em número BR sem DDI", () => {
    expect(telefoneParaWhatsApp("(45) 99999-9999")).toBe("5545999999999");
    expect(telefoneParaWhatsApp("(11) 98585-8875")).toBe("5511985858875");
  });

  it("mantém número já com DDI 55", () => {
    expect(telefoneParaWhatsApp("+55 41995382020")).toBe("5541995382020");
    expect(telefoneParaWhatsApp("45991535300")).toBe("5545991535300");
  });

  it("preserva internacionais sem prefixar 55", () => {
    expect(telefoneParaWhatsApp("+1 (561) 414-0229")).toBe("15614140229");
    expect(telefoneParaWhatsApp("+49 17650991354")).toBe("4917650991354");
  });

  it("rejeita número curto", () => {
    expect(telefoneParaWhatsApp("(45) -9993")).toBeNull();
    expect(telefoneParaWhatsApp("123")).toBeNull();
  });
});

describe("linkWhatsApp", () => {
  it("monta link wa.me ou null", () => {
    expect(linkWhatsApp("(45) 99999-9999")).toBe("https://wa.me/5545999999999");
    expect(linkWhatsApp("curto")).toBeNull();
  });
});

describe("formatarTelefone", () => {
  it("formata BR 10/11 dígitos com DDI ou sem", () => {
    expect(formatarTelefone("(45) 99999-9999")).toBe("(45) 99999-9999");
    expect(formatarTelefone("5545999999999")).toBe("(45) 99999-9999");
    expect(formatarTelefone("4132065559")).toBe("(41) 3206-5559");
  });

  it("devolve o original quando não reconhece", () => {
    expect(formatarTelefone("+1 (561) 414-0229")).toBe("+1 (561) 414-0229");
  });
});

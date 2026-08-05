import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and strips accents", () => {
    expect(slugify("São Paulo")).toBe("sao-paulo");
    expect(slugify("Paratecnológico")).toBe("paratecnologico");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(slugify("Rio de Janeiro")).toBe("rio-de-janeiro");
    expect(slugify("Brasília  -  DF")).toBe("brasilia-df");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("- Curitiba -")).toBe("curitiba");
  });

  it("keeps plain ASCII text unchanged", () => {
    expect(slugify("Florianopolis")).toBe("florianopolis");
  });
});

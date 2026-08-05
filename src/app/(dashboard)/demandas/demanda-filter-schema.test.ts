import { describe, expect, it } from "vitest";
import { demandaFilterSchema, parseDemandaFilters } from "./demanda-filter-schema";

// Pure unit tests against the zod schema only — no live database, mirrors
// tests/scripts/role-arg.test.ts's pure-unit-test style. searchParams is
// untrusted URL input, validated with the same rigor Phase 4 already
// applied to formData (05-RESEARCH.md Pattern 5).
describe("demandaFilterSchema", () => {
  it("returns all-undefined fields when no filters are set", () => {
    const result = demandaFilterSchema.parse({});

    expect(result).toEqual({
      area: undefined,
      responsavel: undefined,
      agrupar: undefined,
      view: undefined,
    });
  });

  it("trims a padded area value", () => {
    const result = demandaFilterSchema.parse({ area: "  Pesquisa de Campo  " });

    expect(result.area).toBe("Pesquisa de Campo");
  });

  it("treats an empty-string area the same as absent", () => {
    const result = demandaFilterSchema.parse({ area: "" });

    expect(result.area).toBeUndefined();
  });

  it("throws when responsavel is not a numeric roster id", () => {
    expect(() => demandaFilterSchema.parse({ responsavel: "not-a-number" })).toThrow();
  });

  it("accepts a numeric responsavel roster id and rejects a UUID", () => {
    expect(() => demandaFilterSchema.parse({ responsavel: "42" })).not.toThrow();
    expect(() =>
      demandaFilterSchema.parse({
        responsavel: "123e4567-e89b-12d3-a456-426614174000",
      })
    ).toThrow();
  });

  it("accepts agrupar values of exactly area or responsavel, and rejects anything else", () => {
    expect(() => demandaFilterSchema.parse({ agrupar: "area" })).not.toThrow();
    expect(() => demandaFilterSchema.parse({ agrupar: "responsavel" })).not.toThrow();
    expect(() => demandaFilterSchema.parse({ agrupar: "status" })).toThrow();
  });

  it("combines all three filters independently when set together", () => {
    const result = demandaFilterSchema.parse({
      area: "Pesquisa",
      responsavel: "42",
      agrupar: "responsavel",
      view: "kanban",
    });

    expect(result).toEqual({
      area: "Pesquisa",
      responsavel: "42",
      agrupar: "responsavel",
      view: "kanban",
    });
  });

  it("accepts view values of exactly lista, kanban or calendario, and rejects anything else", () => {
    expect(() => demandaFilterSchema.parse({ view: "lista" })).not.toThrow();
    expect(() => demandaFilterSchema.parse({ view: "kanban" })).not.toThrow();
    expect(() => demandaFilterSchema.parse({ view: "calendario" })).not.toThrow();
    expect(() => demandaFilterSchema.parse({ view: "tabela" })).toThrow();
  });
});

describe("parseDemandaFilters", () => {
  it("extracts only the string case of each key, ignoring arrays and undefined", () => {
    const result = parseDemandaFilters({
      area: "Pesquisa",
      responsavel: ["dup1", "dup2"],
      agrupar: undefined,
    });

    expect(result).toEqual({
      area: "Pesquisa",
      responsavel: undefined,
      agrupar: undefined,
    });
  });

  it("returns an all-undefined filter set for an empty raw object", () => {
    const result = parseDemandaFilters({});

    expect(result).toEqual({
      area: undefined,
      responsavel: undefined,
      agrupar: undefined,
    });
  });
});

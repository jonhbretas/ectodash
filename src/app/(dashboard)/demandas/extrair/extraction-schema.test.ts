import { describe, expect, it } from "vitest";
import { extractionResponseSchema } from "./extraction-schema";

describe("extractionResponseSchema", () => {
  it("accepts a valid empty array — zero suggestions is a legitimate outcome, not an error", () => {
    const result = extractionResponseSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it("accepts a valid suggestion array", () => {
    const result = extractionResponseSchema.safeParse([
      {
        titulo: "Revisar orçamento",
        responsavel_texto: "Maria",
        prazo_texto: "sexta que vem",
      },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects an item missing a required field", () => {
    const result = extractionResponseSchema.safeParse([{ titulo: "x" }]);
    expect(result.success).toBe(false);
  });

  it("rejects a non-array top-level value", () => {
    const result = extractionResponseSchema.safeParse("not an array");
    expect(result.success).toBe(false);
  });

  it("rejects an array longer than 50 items", () => {
    const result = extractionResponseSchema.safeParse(
      Array(51).fill({
        titulo: "x",
        responsavel_texto: "y",
        prazo_texto: "z",
      })
    );
    expect(result.success).toBe(false);
  });
});

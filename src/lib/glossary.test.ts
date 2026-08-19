import { describe, expect, it } from "vitest";
import { applyGlossary, countGlossaryMatches, normalizeGlossaryText } from "./glossary";

const termos = [
  { term: "SIAEC", replacement: "CEAEC" },
  { term: "UNISSIM", replacement: "UNICIN" },
  { term: "neossinapse", replacement: "nova conexão mental" },
  { term: "holopensene", replacement: "ambiente energético" },
];

describe("normalizeGlossaryText", () => {
  it("removes accents and lowercases", () => {
    expect(normalizeGlossaryText("HOLOPENSENE")).toBe("holopensene");
    expect(normalizeGlossaryText("Neossinapse")).toBe("neossinapse");
  });
});

describe("applyGlossary", () => {
  it("replaces a jargon term by its correct word, case-insensitive", () => {
    expect(applyGlossary("A SIAEC realizou o evento.", termos)).toBe(
      "A CEAEC realizou o evento."
    );
  });

  it("corrects speech-to-text acronym typos (SIAEC → CEAEC, UNISSIM → UNICIN)", () => {
    expect(applyGlossary("Fomos na SIAEC e depois na UNISSIM.", termos)).toBe(
      "Fomos na CEAEC e depois na UNICIN."
    );
  });

  it("preserves uppercase when the whole word is uppercase", () => {
    expect(applyGlossary("SIAEC", termos)).toBe("CEAEC");
    expect(applyGlossary("siaec", termos)).toBe("CEAEC");
    expect(applyGlossary("neossinapse", termos)).toBe("nova conexão mental");
  });

  it("does not replace inside another word (word boundary)", () => {
    expect(applyGlossary("somasse e holopensene", [
      { term: "soma", replacement: "soma de energias" },
      ...termos,
    ])).toBe("somasse e ambiente energético");
  });

  it("matches multi-word replacement keeping the rest of the sentence intact", () => {
    expect(applyGlossary("A neossinapse coletiva foi registrada.", termos)).toBe(
      "A nova conexão mental coletiva foi registrada."
    );
  });

  it("returns the input unchanged when there are no terms or no text", () => {
    expect(applyGlossary("", termos)).toBe("");
    expect(applyGlossary("Texto sem termos.", [])).toBe("Texto sem termos.");
  });
});

describe("countGlossaryMatches", () => {
  it("counts each occurrence of the registered terms", () => {
    expect(countGlossaryMatches("SIAEC e UNISSIM e siaec", termos)).toBe(3);
  });

  it("counts zero when nothing matches", () => {
    expect(countGlossaryMatches("nenhum termo aqui", termos)).toBe(0);
  });
});

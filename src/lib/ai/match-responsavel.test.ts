import { describe, expect, it } from "vitest";
import { matchResponsavel } from "./match-responsavel";

describe("matchResponsavel", () => {
  it("matches a first-name-only mention against the email local-part", () => {
    const profiles = [
      { id: "a", email: "maria.silva@example.invalid" },
      { id: "b", email: "joao@example.invalid" },
    ];

    expect(matchResponsavel("Maria", profiles)).toBe("a");
  });

  it("matches accent-insensitively", () => {
    const profiles = [{ id: "a", email: "maria.silva@example.invalid" }];

    expect(matchResponsavel("María", profiles)).toBe("a");
  });

  it("matches case-insensitively", () => {
    const profiles = [{ id: "a", email: "maria.silva@example.invalid" }];

    expect(matchResponsavel("MARIA", profiles)).toBe("a");
  });

  it("returns null when no confident match exists — never a guessed UUID", () => {
    const profiles = [
      { id: "a", email: "maria.silva@example.invalid" },
      { id: "b", email: "joao@example.invalid" },
    ];

    expect(matchResponsavel("Carlos", profiles)).toBeNull();
  });

  it("returns null for empty input — never matches", () => {
    const profiles = [{ id: "a", email: "maria.silva@example.invalid" }];

    expect(matchResponsavel("", profiles)).toBeNull();
  });

  it("matches the full email local-part in either substring direction", () => {
    const profiles = [{ id: "a", email: "maria.silva@example.invalid" }];

    expect(
      matchResponsavel("maria.silva@example.invalid", profiles)
    ).toBe("a");
  });

  it("resolves a duplicate first name to whichever profile appears first in iteration order (accepted known limitation, not a bug)", () => {
    const profiles = [
      { id: "a", email: "maria.silva@example.invalid" },
      { id: "b", email: "maria.santos@example.invalid" },
    ];

    expect(matchResponsavel("Maria", profiles)).toBe("a");
  });
});

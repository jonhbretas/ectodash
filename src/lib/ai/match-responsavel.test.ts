import { describe, expect, it } from "vitest";
import { matchResponsavel, matchResponsavelRoster } from "./match-responsavel";

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

describe("matchResponsavelRoster", () => {
  const profiles = [
    { id: "p1", email: "ana@example.invalid", full_name: "Ana Beatriz Souza" },
  ];
  const roster = [
    { id: 1, nome: "Ana Beatriz Souza", profileId: "p1" },
    { id: 2, nome: "Carlos Pereira", profileId: null },
  ];

  it("matches a roster name and resolves the linked profile id", () => {
    expect(matchResponsavelRoster("Ana", profiles, roster)).toEqual({
      profileId: "p1",
      rosterId: 1,
    });
  });

  it("matches a roster volunteer WITHOUT an account — profileId stays null", () => {
    expect(matchResponsavelRoster("Carlos Pereira", profiles, roster)).toEqual({
      profileId: null,
      rosterId: 2,
    });
  });

  it("is accent- and case-insensitive against roster names", () => {
    expect(matchResponsavelRoster("cárlós pêreira", profiles, roster)).toEqual({
      profileId: null,
      rosterId: 2,
    });
  });

  it("falls back to account matching when the roster has no hit", () => {
    expect(matchResponsavelRoster("Ana", profiles, [])).toEqual({
      profileId: "p1",
      rosterId: null,
    });
  });

  it("returns nulls for empty input — never matches", () => {
    expect(matchResponsavelRoster("", profiles, roster)).toEqual({
      profileId: null,
      rosterId: null,
    });
  });

  it("returns nulls when nobody matches anywhere", () => {
    expect(matchResponsavelRoster("Zeca", profiles, roster)).toEqual({
      profileId: null,
      rosterId: null,
    });
  });
});

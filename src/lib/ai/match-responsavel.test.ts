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

  it("rejects a duplicate first name as ambiguous instead of guessing the first", () => {
    const profiles = [
      { id: "a", email: "maria.silva@example.invalid" },
      { id: "b", email: "maria.santos@example.invalid" },
    ];

    expect(matchResponsavel("Maria", profiles)).toBeNull();
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
    expect(matchResponsavelRoster("Ana Beatriz Souza", profiles, roster)).toEqual({
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

  it("matches by first+last token when the mention has middle names", () => {
    expect(
      matchResponsavelRoster(
        "Carlos Henrique Pereira",
        profiles,
        roster
      )
    ).toEqual({ profileId: null, rosterId: 2 });
  });

  it("matches a mention that is the roster name plus extra middle tokens", () => {
    expect(
      matchResponsavelRoster("Ana Beatriz Souza e Silva", profiles, roster)
    ).toEqual({ profileId: "p1", rosterId: 1 });
  });

  it("falls back to account matching when the roster has no hit", () => {
    expect(matchResponsavelRoster("Ana", profiles, [])).toEqual({
      profileId: "p1",
      rosterId: null,
    });
  });

  it("rejects short one-token mentions instead of substring-guessing", () => {
    // "Ana" is 3 chars — below the containment minimum. The account
    // fallback is unique here so the profile resolves, but no roster row.
    expect(matchResponsavelRoster("Ana", profiles, roster)).toEqual({
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

  it("rejects a mention shared by two roster rows as ambiguous", () => {
    const duplicados = [
      { id: 1, nome: "Ana Prado", profileId: null },
      { id: 2, nome: "Ana Yogan", profileId: null },
      { id: 3, nome: "Mariana Cabral", profileId: null },
    ];
    // No roster row wins (ambiguous); the unique account fallback still
    // resolves the profile — but never a guessed roster row.
    expect(matchResponsavelRoster("Ana", profiles, duplicados)).toEqual({
      profileId: "p1",
      rosterId: null,
    });
  });

  it("rejects a short token that lands inside an unrelated name", () => {
    // "Ara" is contained in "Eliane Amarante" AND "Jose Luis Ara Sobrinho" —
    // the old matcher linked the wrong volunteer; now it's ambiguous → null.
    const roster = [
      { id: 23, nome: "Eliane Amarante", profileId: null },
      { id: 44, nome: "Jose Luis Ara Sobrinho", profileId: null },
    ];
    expect(matchResponsavelRoster("Ara", [], roster)).toEqual({
      profileId: null,
      rosterId: null,
    });
  });

  it("resolves real-world shortened roster names by first+last token", () => {
    const roster = [
      { id: 2, nome: "Almir Pereira", profileId: null },
      { id: 3, nome: "Ana Prado", profileId: null },
      { id: 58, nome: "Marcos Ulaf", profileId: null },
      { id: 81, nome: "Regina Krupka", profileId: null },
      { id: 64, nome: "Mariana Cabral", profileId: null },
      { id: 44, nome: "Jose Luis Ara Sobrinho", profileId: null },
      { id: 952, nome: "Dal Van Brum", profileId: null },
      { id: 15, nome: "Dalvan Brum", profileId: null },
    ];

    expect(
      matchResponsavelRoster("Almir dos Santos Pereira", [], roster)
    ).toEqual({ profileId: null, rosterId: 2 });
    expect(
      matchResponsavelRoster("Ana Paula do Prado", [], roster)
    ).toEqual({ profileId: null, rosterId: 3 });
    expect(
      matchResponsavelRoster("Marcos Vinícius Ulaf", [], roster)
    ).toEqual({ profileId: null, rosterId: 58 });
    expect(
      matchResponsavelRoster("Regina Maria Krupka", [], roster)
    ).toEqual({ profileId: null, rosterId: 81 });
    expect(
      matchResponsavelRoster("Mariana Cabral Schveitzer", [], roster)
    ).toEqual({ profileId: null, rosterId: 64 });
    expect(
      matchResponsavelRoster("Jose Luis Ara", [], roster)
    ).toEqual({ profileId: null, rosterId: 44 });
    expect(matchResponsavelRoster("Dal Van Brum", [], roster)).toEqual({
      profileId: null,
      rosterId: 952,
    });
  });
});

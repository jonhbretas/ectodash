import { describe, expect, it } from "vitest";
import { parseInviteArgs, ROLE_VALUES } from "../../scripts/lib/role-arg";

// Pure unit tests against the argument parser only. Nothing here imports
// scripts/seed-coordinator.ts, so no test can ever trigger a real invite —
// these run with no network access and no Supabase credentials present.
describe("parseInviteArgs", () => {
  it("defaults to voluntario_comum when only an address is given", () => {
    const result = parseInviteArgs(["voluntario@instituicao.org"]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.email).toBe("voluntario@instituicao.org");
    expect(result.role).toBe("voluntario_comum");
  });

  it.each(ROLE_VALUES)(
    "parses an address plus the role %s to that exact role",
    (role) => {
      const result = parseInviteArgs([
        "voluntario@instituicao.org",
        `--role=${role}`,
      ]);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.email).toBe("voluntario@instituicao.org");
      expect(result.role).toBe(role);
    }
  );

  it("rejects a role that is not one of the four fixed values", () => {
    const result = parseInviteArgs([
      "voluntario@instituicao.org",
      "--role=super_admin",
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    for (const role of ROLE_VALUES) {
      expect(result.error).toContain(role);
    }
  });

  it("fails with a usage-style error when no address is given, regardless of role", () => {
    const withoutRole = parseInviteArgs([]);
    expect(withoutRole.ok).toBe(false);

    const withRole = parseInviteArgs(["--role=financeiro"]);
    expect(withRole.ok).toBe(false);
  });

  it("parses the role position-independently — before or after the address", () => {
    const roleFirst = parseInviteArgs([
      "--role=lider_area",
      "voluntario@instituicao.org",
    ]);
    const roleLast = parseInviteArgs([
      "voluntario@instituicao.org",
      "--role=lider_area",
    ]);

    expect(roleFirst.ok).toBe(true);
    expect(roleLast.ok).toBe(true);
    if (!roleFirst.ok || !roleLast.ok) return;
    expect(roleFirst).toEqual(roleLast);
  });
});

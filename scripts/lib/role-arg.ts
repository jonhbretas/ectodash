// scripts/lib/role-arg.ts
// Pure argument parser and role validator for scripts/seed-coordinator.ts.
// No side effects, no Supabase import — safe to import from tests without
// ever risking a real invite against the live project.
import { z } from "zod";

const ROLE_FLAG_PREFIX = "--role=";

export const ROLE_VALUES = [
  "coordenador_geral",
  "lider_area",
  "voluntario_comum",
  "financeiro",
] as const;

export const roleSchema = z.enum(ROLE_VALUES);

export type Role = z.infer<typeof roleSchema>;

// Least-privileged default (D-02): a bare invite with no role flag creates
// a voluntario_comum account, never anything more privileged.
const DEFAULT_ROLE: Role = "voluntario_comum";

export type ParseInviteArgsResult =
  | { ok: true; email: string; role: Role }
  | { ok: false; error: string };

function invalidRoleMessage(rawRole: string): string {
  return (
    `Papel inválido: "${rawRole}". ` +
    `Os papéis válidos são: ${ROLE_VALUES.join(", ")}.`
  );
}

const USAGE_ERROR =
  "Uso: npm run seed:coordinator -- <email> [--role=<papel>]\n" +
  `Papéis válidos: ${ROLE_VALUES.join(", ")} (padrão: ${DEFAULT_ROLE})`;

/**
 * Parses the raw argv-style argument list for the invite script. The role
 * flag (--role=<value>) may appear before or after the address — the first
 * non-flag token is treated as the address regardless of position.
 */
export function parseInviteArgs(args: string[]): ParseInviteArgsResult {
  let rawRole: string | undefined;
  let email: string | undefined;

  for (const arg of args) {
    if (arg.startsWith(ROLE_FLAG_PREFIX)) {
      rawRole = arg.slice(ROLE_FLAG_PREFIX.length);
    } else if (email === undefined) {
      email = arg;
    }
  }

  if (!email) {
    return { ok: false, error: USAGE_ERROR };
  }

  if (rawRole === undefined) {
    return { ok: true, email, role: DEFAULT_ROLE };
  }

  const parsed = roleSchema.safeParse(rawRole);
  if (!parsed.success) {
    return { ok: false, error: invalidRoleMessage(rawRole) };
  }

  return { ok: true, email, role: parsed.data };
}

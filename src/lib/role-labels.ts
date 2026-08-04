// src/lib/role-labels.ts
// The five fixed institutional roles (0002_profiles_role.sql +
// 0016_roles_rename.sql) in their pt-BR display names — the single place
// this mapping lives. Updated 2026-08-04: `lider_area` became
// `coordenador_area` ("Coordenador de área") and the new `voluntariado`
// role was added.
export const ROLE_LABELS: Record<string, string> = {
  coordenador_geral: "Coordenador geral",
  coordenador_area: "Coordenador de área",
  voluntario_comum: "Voluntário comum",
  financeiro: "Financeiro",
  voluntariado: "Voluntariado",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Sem papel";
  return ROLE_LABELS[role] ?? role;
}

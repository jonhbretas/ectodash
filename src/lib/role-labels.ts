// src/lib/role-labels.ts
// Os cinco papéis institucionais fixos (0002_profiles_role.sql +
// 0016_roles_rename.sql) e os níveis de cargo de acesso (0043_cargos_acesso)
// em seus nomes de exibição pt-BR — o único lugar onde esse mapeamento
// mora. Updated 2026-08-04: `lider_area` became `coordenador_area`
// ("Coordenador de área") and the new `voluntariado` role was added.
// 2026-08-10: níveis de cargo (cargo = nível + escopo) adicionados.
export const ROLE_LABELS: Record<string, string> = {
  coordenador_geral: "Coordenador geral",
  coordenador_area: "Coordenador de área",
  voluntario_comum: "Voluntário comum",
  financeiro: "Financeiro",
  voluntariado: "Voluntariado",
};

export const NIVEL_CARGO_LABELS: Record<string, string> = {
  coordenador_area: "Coordenador de área",
  coordenador_geral_area: "Coordenador geral de área",
  coordenador_localidade: "Coordenador geral de localidade",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "Sem papel";
  return ROLE_LABELS[role] ?? role;
}

export function nivelCargoLabel(nivel: string | null | undefined): string {
  if (!nivel) return "Sem cargo";
  return NIVEL_CARGO_LABELS[nivel] ?? nivel;
}

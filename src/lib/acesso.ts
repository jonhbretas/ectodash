// src/lib/acesso.ts
// Modelo de níveis de acesso por área (migration 0043): acesso = cargo
// (nível + escopo) somado ao role global. Fonte única para decidir o que
// cada conta pode ver/fazer por módulo — sidebar, gates de página e
// botões de ação. O limite REAL é a RLS no banco; este módulo é o gate de
// UX (mesma convenção dos gates de role espalhados pelas páginas).

export type AppRole =
  | "coordenador_geral"
  | "coordenador_area"
  | "voluntario_comum"
  | "financeiro"
  | "voluntariado";

export type NivelCargo =
  | "coordenador_area"
  | "coordenador_geral_area"
  | "coordenador_localidade";

export type Cargo = {
  cargo_id: number;
  nivel: NivelCargo;
  area_id: number | null;
  area_nome: string | null;
  localidade_id: number | null;
  localidade_nome: string | null;
  modulos: string[];
};

export type Acesso = {
  role: AppRole | null;
  cargos: Cargo[];
};

// Módulos concedíveis em cargo_modulos (CHECK da migration 0043) + os
// módulos exclusivos de role (painel, areas), que cargos nunca concedem.
export type ModuloAcesso =
  | "demandas"
  | "reunioes"
  | "dips"
  | "voluntarios"
  | "eventos"
  | "projetos"
  | "pesquisas"
  | "proep"
  | "analise"
  | "analisar"
  | "vendas"
  | "financeiro"
  | "utilidades"
  | "contratos";

export type ModuloRestrito = "painel" | "areas";

export const MODULOS_LABELS: Record<ModuloAcesso, string> = {
  demandas: "Demandas",
  reunioes: "Reuniões",
  dips: "Dinâmica DIP",
  voluntarios: "Voluntários",
  eventos: "Eventos",
  projetos: "Projetos",
  pesquisas: "Pesquisas",
  proep: "PROEP",
  analise: "Análise",
  analisar: "Analisar com IA",
  vendas: "Loja Ectolab",
  financeiro: "Financeiro",
  utilidades: "Utilidades",
  contratos: "Contratos",
};

export const NIVEL_CARGO_LABELS: Record<NivelCargo, string> = {
  coordenador_area: "Coordenador de área",
  coordenador_geral_area: "Coordenador geral de área",
  coordenador_localidade: "Coordenador geral de localidade",
};

export function nivelCargoLabel(nivel: NivelCargo | string | null | undefined): string {
  if (!nivel) return "Sem cargo";
  return NIVEL_CARGO_LABELS[nivel as NivelCargo] ?? nivel;
}

export const MODULOS_CONCEDIVEIS: ModuloAcesso[] = Object.keys(
  MODULOS_LABELS
) as ModuloAcesso[];

/**
 * Nível de acesso do usuário a um módulo:
 * - "gerenciar": gestão plena (criar/editar/excluir) — role global ou cargo
 *   com o módulo concedido;
 * - "ler": leitura — todo módulo público; módulos restritos (financeiro,
 *   vendas, painel) ficam negados sem role/cargo;
 * - false: sem acesso.
 */
export function podeAcessar(
  acesso: Acesso,
  modulo: ModuloAcesso
): "gerenciar" | "ler" | false {
  const role = acesso.role;

  if (role === "coordenador_geral") return "gerenciar";

  // Contratos contêm dados pessoais de alunos e é exclusivo do coordenador
  // geral (RLS 0042/0047 + gates de página). Cargo nenhum concede este módulo.
  if (modulo === "contratos") return false;

  if (role === "financeiro") {
    if (modulo === "financeiro") return "gerenciar";
    if (modulo === "vendas") return false;
    return "ler";
  }

  if (role === "voluntariado") {
    if (modulo === "voluntarios") return "gerenciar";
    if (modulo === "financeiro" || modulo === "vendas") return false;
    return "ler";
  }

  const concedido = acesso.cargos.some((c) => c.modulos.includes(modulo));
  if (concedido) return "gerenciar";

  // Módulos restritos exigem role ou cargo; os públicos são de leitura
  // para qualquer conta autenticada (como sempre foi). PROEP entrou na
  // lista na auditoria 0063: contém PII de alunos (nome/e-mail/telefone)
  // e a RLS do banco agora restringe leitura/escrita a coordenadores.
  if (
    modulo === "financeiro" ||
    modulo === "vendas" ||
    modulo === "proep"
  ) {
    return false;
  }
  return "ler";
}

/** Um cargo de área gerencia dentro da própria árvore? (não inclui localidade) */
export function cargoCobreArea(cargo: Cargo, areaId: number | null): boolean {
  if (areaId === null) return false;
  if (cargo.nivel === "coordenador_area") return cargo.area_id === areaId;
  return cargo.area_id === areaId; // herança de sub-áreas é resolvida no banco
}

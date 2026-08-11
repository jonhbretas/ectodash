import type { DemandaStatus } from "./status-badge";

export type DemandaGroupable = {
  id: number;
  titulo: string;
  responsavelEmails: string[];
  prazo: string;
  status: DemandaStatus;
  atrasada: boolean;
  area: string | null;
  projeto?: string | null;
  eventoNome?: string | null;
  etiquetaNome?: string | null;
  checklistTotal?: number;
  checklistFeitos?: number;
};

export const SEM_AREA_DEFINIDA = "Sem área definida";

// Single comparator implementing the whole sort rule in one place: atrasada
// first, then prazo ascending, then concluída last regardless of prazo
// (04-UI-SPEC.md Screen Inventory > 1, Sort order). Reads the
// server-computed `atrasada` boolean only — never recomputes it. Grouping
// (below) wraps around this comparator; it never replaces or reorders it.
export function compareDemandas(
  a: DemandaGroupable,
  b: DemandaGroupable
): number {
  if (a.status === "concluida" !== (b.status === "concluida")) {
    return a.status === "concluida" ? 1 : -1;
  }
  if (a.atrasada !== b.atrasada) {
    return a.atrasada ? -1 : 1;
  }
  return a.prazo.localeCompare(b.prazo);
}

// One section per distinct group value. A demanda with multiple
// responsáveis (demanda_responsaveis is many-to-many) has no single
// "primary" responsável to bucket by — absent a UI-SPEC tiebreaker, the
// simplest defensible rule is applied: the demanda appears once in every
// group for each of its responsáveis. This choice is documented in
// 05-02-SUMMARY.md since 05-UI-SPEC.md does not explicitly resolve it.
export function groupDemandas(
  demandas: DemandaGroupable[],
  groupBy: "area" | "responsavel"
): { label: string; items: DemandaGroupable[] }[] {
  const groups = new Map<string, DemandaGroupable[]>();

  for (const demanda of demandas) {
    if (groupBy === "area") {
      const key = demanda.area?.trim() ? demanda.area : SEM_AREA_DEFINIDA;
      const items = groups.get(key) ?? [];
      items.push(demanda);
      groups.set(key, items);
    } else {
      const emails =
        demanda.responsavelEmails.length > 0
          ? demanda.responsavelEmails
          : ["Sem responsável definido"];
      for (const email of emails) {
        const items = groups.get(email) ?? [];
        items.push(demanda);
        groups.set(email, items);
      }
    }
  }

  // Sem área definida always sorts last; every other group sorts
  // alphabetically for a stable, predictable section order.
  const labels = [...groups.keys()].sort((a, b) => {
    if (a === SEM_AREA_DEFINIDA) return 1;
    if (b === SEM_AREA_DEFINIDA) return -1;
    return a.localeCompare(b);
  });

  return labels.map((label) => ({
    label,
    items: [...(groups.get(label) ?? [])].sort(compareDemandas),
  }));
}

import Link from "next/link";
import { ClipboardList, FilterX } from "lucide-react";
import DemandaCard from "./demanda-card";
import DemandaTable from "./demanda-table";
import type { DemandaStatus } from "./status-badge";

// The breakpoint-switching container: cards below lg (including tablet),
// table at lg and above — a single CSS-only lg: breakpoint switch, per
// 04-UI-SPEC.md's Responsive Behavior Summary. No JavaScript-based screen-
// width detection (React lifecycle hooks, a browser resize listener, or a
// media-query hook) is used to decide which variant renders.
export type Demanda = {
  id: number;
  titulo: string;
  responsavelEmails: string[];
  prazo: string;
  status: DemandaStatus;
  atrasada: boolean;
  area: string | null;
};

export type DemandaListProps = {
  demandas: Demanda[];
  // groupBy: when set, the list splits into labeled sections instead of one
  // flat sorted list (05-UI-SPEC.md Screen Inventory 1a). compareDemandas is
  // applied WITHIN each group independently, never globally when grouping
  // is active.
  groupBy?: "area" | "responsavel";
  // filtersActive: whether ≥1 of área/responsável is currently set, passed
  // down from page.tsx — used to pick which empty state to render when the
  // list is empty. This is a STRUCTURAL distinction, not just a copy choice
  // (05-UI-SPEC.md Screen Inventory 2): the filtered-to-zero-results state
  // only renders when a filter narrowed an otherwise non-empty role-scoped
  // dataset down to nothing, never when the role-scoped dataset was already
  // empty to begin with.
  filtersActive?: boolean;
  // isCoordenador: threaded from page.tsx's existing profiles.role read (no
  // new query) — gates the "Painel do coordenador" entry-point link in the
  // header row below. Purely a UX-hiding decision, never an authorization
  // boundary (06-UI-SPEC.md's Entry Point contract; RLS on /painel's own
  // queries from plan 06-01 is what actually matters).
  isCoordenador?: boolean;
  // canExtractDemandas: threaded from page.tsx's existing profiles.role
  // read (no new query) — gates the "Extrair demandas de reunião"
  // entry-point link below, visible to coordenador_geral AND lider_area
  // (unlike isCoordenador above, which is coordenador-only). Purely a
  // UX-hiding decision; /demandas/extrair's own page-level role check
  // (plan 08-02, Task 1) is what actually matters
  // (08-UI-SPEC.md's Entry Point contract).
  canExtractDemandas?: boolean;
};

const SEM_AREA_DEFINIDA = "Sem área definida";

// Single comparator implementing the whole sort rule in one place: atrasada
// first, then prazo ascending, then concluída last regardless of prazo
// (04-UI-SPEC.md Screen Inventory > 1, Sort order). Reads the
// server-computed `atrasada` boolean only — never recomputes it. Grouping
// (below) wraps around this comparator; it never replaces or reorders it.
function compareDemandas(a: Demanda, b: Demanda): number {
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
function groupDemandas(
  demandas: Demanda[],
  groupBy: "area" | "responsavel"
): { label: string; items: Demanda[] }[] {
  const groups = new Map<string, Demanda[]>();

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

export default function DemandaList({
  demandas,
  groupBy,
  filtersActive = false,
  isCoordenador = false,
  canExtractDemandas = false,
}: DemandaListProps) {
  const sorted = [...demandas].sort(compareDemandas);
  const count = demandas.length;
  const countLabel = count === 1 ? "1 demanda" : `${count} demandas`;
  const grouped = groupBy ? groupDemandas(demandas, groupBy) : null;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-zinc-900">Demandas</h1>
          <span className="text-base text-zinc-700">{countLabel}</span>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {isCoordenador && (
            <Link
              href="/painel"
              className="flex min-h-14 w-full items-center justify-center rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto"
            >
              Painel do coordenador
            </Link>
          )}

          {canExtractDemandas && (
            <Link
              href="/demandas/extrair"
              className="flex min-h-14 w-full items-center justify-center rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto"
            >
              Extrair demandas de reunião
            </Link>
          )}

          <Link
            href="/demandas/nova"
            className="flex min-h-14 w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto"
          >
            Nova demanda
          </Link>
        </div>
      </div>

      {count === 0 && filtersActive ? (
        // Filtered-to-zero-results — distinct from the "no demandas at all"
        // state below, kept as a fully separate render branch (not a shared
        // conditional) so a future edit to one can't accidentally bleed
        // into the other (05-UI-SPEC.md Screen Inventory 2).
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <FilterX size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma demanda encontrada com esses filtros
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Tente escolher outra área, projeto ou responsável, ou toque em
            &quot;Limpar filtros&quot; para ver todas as demandas.
          </p>
          <Link
            href="/"
            className="flex min-h-14 items-center justify-center rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Limpar filtros
          </Link>
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <ClipboardList size={48} className="text-zinc-400" aria-hidden="true" />
          <h2 className="text-3xl font-semibold text-zinc-900">
            Nenhuma demanda cadastrada ainda
          </h2>
          <p className="max-w-md text-xl text-zinc-700">
            Quando alguém criar uma demanda, ela vai aparecer aqui. Toque em
            &quot;Nova demanda&quot; para começar.
          </p>
          <Link
            href="/demandas/nova"
            className="flex min-h-14 items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Nova demanda
          </Link>
        </div>
      ) : grouped ? (
        <div className="flex flex-col gap-8">
          {grouped.map((group) => {
            const groupCountLabel =
              group.items.length === 1
                ? "1 demanda"
                : `${group.items.length} demandas`;
            return (
              <div key={group.label} className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold text-zinc-900">
                    {group.label}
                  </h2>
                  <span className="text-base text-zinc-700">
                    {groupCountLabel}
                  </span>
                </div>
                <ul className="flex flex-col gap-4 lg:hidden">
                  {group.items.map((demanda) => (
                    <DemandaCard key={demanda.id} {...demanda} />
                  ))}
                </ul>
                <div className="hidden lg:block">
                  <DemandaTable demandas={group.items} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-4 lg:hidden">
            {sorted.map((demanda) => (
              <DemandaCard key={demanda.id} {...demanda} />
            ))}
          </ul>
          <div className="hidden lg:block">
            <DemandaTable demandas={sorted} />
          </div>
        </>
      )}
    </div>
  );
}

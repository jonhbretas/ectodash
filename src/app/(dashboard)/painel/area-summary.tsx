// Breakdown-by-área row list — receives pre-computed counts (including each
// área's overdue sub-count) as a prop. Sorted by primary count descending,
// ties broken alphabetically; "Sem área definida" always sorts last
// regardless of its count (06-UI-SPEC.md Screen Inventory §2). Reuses
// Phase 5's exact "/?area=" filter query param for the "Ver demandas" link
// — no new filtering mechanism.
import Link from "next/link";

const SEM_AREA_DEFINIDA = "Sem área definida"; // matches demanda-list.tsx's
// SEM_AREA_DEFINIDA constant exactly — do not invent a second label.

export type AreaSummaryRow = {
  area: string;
  count: number;
  overdueCount: number;
};

export type AreaSummaryProps = {
  rows: AreaSummaryRow[];
};

function sortRows(rows: AreaSummaryRow[]): AreaSummaryRow[] {
  return [...rows].sort((a, b) => {
    if (a.area === SEM_AREA_DEFINIDA) return 1;
    if (b.area === SEM_AREA_DEFINIDA) return -1;
    if (a.count !== b.count) return b.count - a.count;
    return a.area.localeCompare(b.area);
  });
}

export default function AreaSummary({ rows }: AreaSummaryProps) {
  const sorted = sortRows(rows);

  return (
    <section className="flex w-full max-w-4xl flex-col gap-2">
      <h2 className="text-2xl font-semibold text-zinc-900">
        Demandas por área
      </h2>
      <div className="flex flex-col">
        {sorted.map((row) => {
          const countLabel =
            row.count === 1 ? "1 demanda" : `${row.count} demandas`;
          const overdueLabel =
            row.overdueCount === 1
              ? "1 atrasada"
              : `${row.overdueCount} atrasadas`;

          return (
            <div
              key={row.area}
              className="flex items-center justify-between gap-4 border-b border-zinc-200 py-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span
                  className="truncate text-xl text-zinc-900"
                  title={row.area}
                >
                  {row.area}
                </span>
                {row.overdueCount > 0 && (
                  <span className="text-base text-red-700">
                    {overdueLabel}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="text-xl font-semibold text-zinc-900">
                  {countLabel}
                </span>
                <Link
                  href={`/?area=${encodeURIComponent(row.area)}`}
                  className="flex min-h-14 items-center px-2 text-base text-[#2195B9] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                >
                  Ver demandas
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

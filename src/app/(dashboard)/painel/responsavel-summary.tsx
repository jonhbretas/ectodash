// Breakdown-by-voluntário row list — identical structure/sort/link rules to
// area-summary.tsx, but for the per-voluntário breakdown built from the
// batched demanda_responsaveis query (06-RESEARCH.md Pattern 1b). This
// component only ever receives responsáveis who actually have ≥1 assignment
// — there is no "0-count row" to render for this breakdown
// (06-UI-SPEC.md's explicit UI Considerations note).
import Link from "next/link";

export type ResponsavelSummaryRow = {
  profileId: string;
  email: string;
  count: number;
  overdueCount: number;
};

export type ResponsavelSummaryProps = {
  rows: ResponsavelSummaryRow[];
};

function sortRows(rows: ResponsavelSummaryRow[]): ResponsavelSummaryRow[] {
  return [...rows].sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.email.localeCompare(b.email);
  });
}

export default function ResponsavelSummary({
  rows,
}: ResponsavelSummaryProps) {
  const sorted = sortRows(rows);

  return (
    <section className="flex w-full max-w-4xl flex-col gap-2">
      <h2 className="text-2xl font-semibold text-zinc-900">
        Demandas por voluntário
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
              key={row.profileId}
              className="flex items-center justify-between gap-4 border-b border-zinc-200 py-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span
                  className="truncate text-xl text-zinc-900"
                  title={row.email}
                >
                  {row.email}
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
                  href={`/?responsavel=${encodeURIComponent(row.profileId)}`}
                  className="flex min-h-14 items-center px-2 text-base text-[#d4883a] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]"
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

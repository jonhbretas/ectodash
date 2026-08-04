// Institution-wide overdue panel — reuses DemandaTable/DemandaCard directly
// (06-RESEARCH.md Pattern 2), the same lg: breakpoint card/table switch
// demanda-list.tsx already uses. Not a new list-rendering implementation.
// This file itself is a Server Component (no "use client") — it only
// imports and renders DemandaTable, which is already "use client" internally,
// matching how demanda-list.tsx already does the same.
import DemandaCard from "../demandas/demanda-card";
import DemandaTable, { type DemandaTableRow } from "../demandas/demanda-table";

export type OverduePanelProps = {
  demandas: DemandaTableRow[];
};

export default function OverduePanel({ demandas }: OverduePanelProps) {
  return (
    <section
      aria-labelledby="overdue-heading"
      className="flex w-full max-w-4xl flex-col gap-4"
    >
      <h2
        id="overdue-heading"
        className="text-2xl font-semibold text-zinc-900"
      >
        Demandas atrasadas ({demandas.length})
      </h2>
      <ul className="flex flex-col gap-4 lg:hidden">
        {demandas.map((demanda) => (
          <DemandaCard key={demanda.id} {...demanda} />
        ))}
      </ul>
      <div className="hidden lg:block">
        <DemandaTable demandas={demandas} />
      </div>
    </section>
  );
}

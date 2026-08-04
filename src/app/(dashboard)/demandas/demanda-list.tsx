import Link from "next/link";
import { ClipboardList } from "lucide-react";
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
};

// Single comparator implementing the whole sort rule in one place: atrasada
// first, then prazo ascending, then concluída last regardless of prazo
// (04-UI-SPEC.md Screen Inventory > 1, Sort order). Reads the
// server-computed `atrasada` boolean only — never recomputes it.
function compareDemandas(a: Demanda, b: Demanda): number {
  if (a.status === "concluida" !== (b.status === "concluida")) {
    return a.status === "concluida" ? 1 : -1;
  }
  if (a.atrasada !== b.atrasada) {
    return a.atrasada ? -1 : 1;
  }
  return a.prazo.localeCompare(b.prazo);
}

export default function DemandaList({ demandas }: DemandaListProps) {
  const sorted = [...demandas].sort(compareDemandas);
  const count = demandas.length;
  const countLabel = count === 1 ? "1 demanda" : `${count} demandas`;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-zinc-900">Demandas</h1>
          <span className="text-base text-zinc-700">{countLabel}</span>
        </div>

        <Link
          href="/demandas/nova"
          className="flex min-h-14 w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:w-auto"
        >
          Nova demanda
        </Link>
      </div>

      {count === 0 ? (
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

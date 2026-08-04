"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import StatusBadge, { type DemandaStatus } from "./status-badge";
import OverdueBadge from "./overdue-badge";

// Desktop (lg and above) table view — same data as DemandaCard, with the
// overdue border-l-4 row stripe as a redundant-but-scannable second signal
// for a table full of rows (04-UI-SPEC.md Screen Inventory > 1). The
// lg-breakpoint visibility switch itself lives in the caller (demanda-list.tsx).
export type DemandaTableRow = {
  id: number;
  titulo: string;
  responsavelEmails: string[];
  prazo: string;
  status: DemandaStatus;
  atrasada: boolean;
  area: string | null;
};

export type DemandaTableProps = {
  demandas: DemandaTableRow[];
};

export default function DemandaTable({ demandas }: DemandaTableProps) {
  const router = useRouter();

  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg border border-zinc-300">
      <thead>
        <tr className="bg-zinc-100 text-base font-semibold text-zinc-700">
          <th className="px-4 py-3 text-left">Título</th>
          <th className="px-4 py-3 text-left">Responsável</th>
          <th className="px-4 py-3 text-left">Prazo</th>
          <th className="px-4 py-3 text-left">Status</th>
          <th className="px-4 py-3 text-left">Área/Projeto</th>
        </tr>
      </thead>
      <tbody>
        {demandas.map((demanda) => {
          const prazoFormatada = format(
            new Date(`${demanda.prazo}T00:00:00`),
            "dd/MM/yyyy",
            { locale: ptBR }
          );

          return (
            <tr
              key={demanda.id}
              onClick={() => router.push(`/demandas/${demanda.id}/editar`)}
              className={`cursor-pointer border-t border-zinc-300 bg-white text-xl text-zinc-900 hover:bg-zinc-50 ${
                demanda.atrasada ? "border-l-4 border-l-red-700" : ""
              }`}
            >
              <td className="max-w-xs truncate px-4 py-3" title={demanda.titulo}>
                {demanda.titulo}
              </td>
              <td className="px-4 py-3">
                {demanda.responsavelEmails.length > 0
                  ? demanda.responsavelEmails.join(", ")
                  : "Sem responsável definido"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={demanda.atrasada ? "text-red-700" : ""}>
                    {prazoFormatada}
                  </span>
                  {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={demanda.status} />
              </td>
              <td className="px-4 py-3">
                {demanda.area ? (
                  <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-700">
                    {demanda.area}
                  </span>
                ) : (
                  <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-500">
                    Sem área definida
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <Table className="w-full border-collapse overflow-hidden rounded-lg border border-zinc-300">
      <TableHeader>
        <TableRow className="border-b-0 bg-zinc-100 text-base font-semibold text-zinc-700 hover:bg-zinc-100">
          <TableHead className="h-auto px-4 py-3 text-left font-semibold text-zinc-700">
            Título
          </TableHead>
          <TableHead className="h-auto px-4 py-3 text-left font-semibold text-zinc-700">
            Responsável
          </TableHead>
          <TableHead className="h-auto px-4 py-3 text-left font-semibold text-zinc-700">
            Prazo
          </TableHead>
          <TableHead className="h-auto px-4 py-3 text-left font-semibold text-zinc-700">
            Status
          </TableHead>
          <TableHead className="h-auto px-4 py-3 text-left font-semibold text-zinc-700">
            Área/Projeto
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {demandas.map((demanda) => {
          const prazoFormatada = format(
            new Date(`${demanda.prazo}T00:00:00`),
            "dd/MM/yyyy",
            { locale: ptBR }
          );

          return (
            <TableRow
              key={demanda.id}
              onClick={() => router.push(`/demandas/${demanda.id}/editar`)}
              className={`cursor-pointer border-t border-b-0 border-zinc-300 bg-white text-xl text-zinc-900 hover:bg-zinc-50 ${
                demanda.atrasada ? "border-l-4 border-l-red-700" : ""
              }`}
            >
              <TableCell
                className="max-w-xs truncate px-4 py-3"
                title={demanda.titulo}
              >
                {demanda.titulo}
              </TableCell>
              <TableCell className="whitespace-normal px-4 py-3">
                {demanda.responsavelEmails.length > 0
                  ? demanda.responsavelEmails.join(", ")
                  : "Sem responsável definido"}
              </TableCell>
              <TableCell className="whitespace-normal px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className={demanda.atrasada ? "text-red-700" : ""}>
                    {prazoFormatada}
                  </span>
                  {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}
                </div>
              </TableCell>
              <TableCell className="whitespace-normal px-4 py-3">
                <StatusBadge status={demanda.status} />
              </TableCell>
              <TableCell className="whitespace-normal px-4 py-3">
                {demanda.area ? (
                  <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-700">
                    {demanda.area}
                  </span>
                ) : (
                  <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-500">
                    Sem área definida
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

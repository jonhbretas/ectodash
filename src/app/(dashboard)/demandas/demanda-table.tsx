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
// overdue left-border stripe as a redundant-but-scannable second signal
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
  projeto?: string | null;
  eventoNome?: string | null;
  etiquetaNome?: string | null;
  checklistTotal?: number;
  checklistFeitos?: number;
};

export type DemandaTableProps = {
  demandas: DemandaTableRow[];
};

export default function DemandaTable({ demandas }: DemandaTableProps) {
  const router = useRouter();

  return (
    <Table className="w-full table-fixed overflow-hidden rounded-2xl ring-1 ring-zinc-200/60">
      <TableHeader>
        <TableRow className="border-b-0 bg-zinc-100/80 text-base font-semibold text-zinc-600 hover:bg-zinc-100/80">
          <TableHead className="h-auto w-[38%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Título
          </TableHead>
          <TableHead className="h-auto w-[24%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Responsável
          </TableHead>
          <TableHead className="h-auto w-[12%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Prazo
          </TableHead>
          <TableHead className="h-auto w-[12%] px-5 py-3.5 text-left font-semibold text-zinc-600">
            Status
          </TableHead>
          <TableHead className="h-auto w-[14%] px-5 py-3.5 text-left font-semibold text-zinc-600">
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
              className={`cursor-pointer border-t border-b-0 border-zinc-100 bg-white text-base text-zinc-900 transition-colors duration-200 hover:bg-zinc-50 ${
                demanda.atrasada ? "border-l-3 border-l-red-500" : ""
              }`}
            >
              <TableCell className="truncate px-5 py-3.5" title={demanda.titulo}>
                {demanda.titulo}
              </TableCell>
              <TableCell
                className="truncate px-5 py-3.5 text-zinc-700"
                title={
                  demanda.responsavelEmails.length > 0
                    ? demanda.responsavelEmails.join(", ")
                    : "Sem responsável definido"
                }
              >
                {demanda.responsavelEmails.length > 0
                  ? demanda.responsavelEmails.join(", ")
                  : "Sem responsável definido"}
              </TableCell>
              <TableCell className="whitespace-normal px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className={demanda.atrasada ? "font-medium text-red-700" : "text-zinc-600"}>
                    {prazoFormatada}
                  </span>
                  {demanda.atrasada && <OverdueBadge prazo={demanda.prazo} />}
                </div>
              </TableCell>
              <TableCell className="whitespace-normal px-5 py-3.5">
                <StatusBadge status={demanda.status} />
              </TableCell>
              <TableCell className="whitespace-normal px-5 py-3.5">
                <div className="flex flex-wrap gap-1.5">
                  {demanda.area ? (
                    <span
                      className="max-w-36 truncate rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-700"
                      title={demanda.area}
                    >
                      {demanda.area}
                    </span>
                  ) : (
                    <span className="max-w-36 truncate rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-400">
                      Sem área definida
                    </span>
                  )}
                  {demanda.projeto && (
                    <span
                      className="max-w-36 truncate rounded-full bg-[#f5f0eb] px-2.5 py-0.5 text-sm font-medium text-[#d4883a] ring-1 ring-[#f0e0cf]/60"
                      title={demanda.projeto}
                    >
                      {demanda.projeto}
                    </span>
                  )}
                  {demanda.eventoNome && (
                    <span
                      className="max-w-36 truncate rounded-full bg-purple-50 px-2.5 py-0.5 text-sm font-medium text-purple-700 ring-1 ring-purple-200/60"
                      title={demanda.eventoNome}
                    >
                      {demanda.eventoNome}
                    </span>
                  )}
                  {demanda.etiquetaNome && (
                    <span
                      className="max-w-36 truncate rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200/60"
                      title={demanda.etiquetaNome}
                    >
                      {demanda.etiquetaNome}
                    </span>
                  )}
                  {(demanda.checklistTotal ?? 0) > 0 && (
                    <span className="w-fit rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-600">
                      Checklist {demanda.checklistFeitos ?? 0}/{demanda.checklistTotal}
                    </span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

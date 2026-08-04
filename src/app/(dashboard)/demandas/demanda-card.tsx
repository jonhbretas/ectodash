import Link from "next/link";
import { Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import StatusBadge, { type DemandaStatus } from "./status-badge";
import OverdueBadge from "./overdue-badge";

// Full 04-UI-SPEC.md mobile card layout, extended from plan 04-02's minimal
// tracer version. The whole card is the tap target — no separate "Editar"
// button on mobile.
export type DemandaCardProps = {
  id: number;
  titulo: string;
  responsavelEmails: string[];
  prazo: string;
  status: DemandaStatus;
  atrasada: boolean;
  area: string | null;
};

export default function DemandaCard({
  id,
  titulo,
  responsavelEmails,
  prazo,
  status,
  atrasada,
  area,
}: DemandaCardProps) {
  const prazoFormatada = format(new Date(`${prazo}T00:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });

  return (
    <li>
      <Link
        href={`/demandas/${id}/editar`}
        className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-4 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-lg font-semibold text-zinc-900">
            {titulo}
          </p>
          <StatusBadge status={status} />
        </div>

        <p className="flex items-center gap-1 text-base text-zinc-700">
          <User size={16} aria-hidden="true" />
          {responsavelEmails.length > 0
            ? responsavelEmails.join(", ")
            : "Sem responsável definido"}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`flex items-center gap-1 text-base ${
              atrasada ? "text-red-700" : "text-zinc-700"
            }`}
          >
            <Calendar size={16} aria-hidden="true" />
            {prazoFormatada}
          </p>
          {atrasada && <OverdueBadge prazo={prazo} />}
        </div>

        {area ? (
          <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-700">
            {area}
          </span>
        ) : (
          <span className="w-fit rounded-full bg-zinc-100 px-2 py-0.5 text-base text-zinc-500">
            Sem área definida
          </span>
        )}
      </Link>
    </li>
  );
}

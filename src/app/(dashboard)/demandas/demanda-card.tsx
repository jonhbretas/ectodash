import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Intentionally minimal — this is the tracer's presentational card, not
// yet 04-UI-SPEC.md's full treatment (status badge, overdue badge,
// responsive table on desktop). Plan 04-04 extends this same component
// with that visual polish.
export type DemandaCardProps = {
  titulo: string;
  responsavelEmails: string[];
  prazo: string;
};

export default function DemandaCard({
  titulo,
  responsavelEmails,
  prazo,
}: DemandaCardProps) {
  const prazoFormatada = format(new Date(`${prazo}T00:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-300 bg-white p-4">
      <p className="text-lg font-semibold text-zinc-900">{titulo}</p>
      <p className="text-base text-zinc-700">
        {responsavelEmails.length > 0
          ? responsavelEmails.join(", ")
          : "Sem responsável definido"}
      </p>
      <p className="text-base text-zinc-700">{prazoFormatada}</p>
    </li>
  );
}

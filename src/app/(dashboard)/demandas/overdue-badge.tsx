import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Rendered only by the caller when `atrasada === true` — this component
// never receives or checks that boolean itself. The decision is made once,
// upstream, by reading demandas_com_status.atrasada (plan 04-01); this is a
// pure rendering concern (04-UI-SPEC.md Overdue Visual Treatment).
export type OverdueBadgeProps = {
  prazo: string;
};

export default function OverdueBadge({ prazo }: OverdueBadgeProps) {
  const formatted = format(new Date(`${prazo}T00:00:00`), "dd/MM/yyyy", {
    locale: ptBR,
  });

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-base font-semibold text-red-800"
      aria-label={`Atrasada — prazo era ${formatted}`}
    >
      <AlertTriangle size={16} aria-hidden="true" />
      Atrasada
    </span>
  );
}

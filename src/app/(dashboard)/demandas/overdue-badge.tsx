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
  const formatted = (() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) return prazo;
    const d = new Date(`${prazo}T00:00:00`);
    if (Number.isNaN(d.getTime())) return prazo;
    try {
      return format(d, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return prazo;
    }
  })();

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-base font-semibold text-red-700 ring-1 ring-red-200/60 transition-all duration-200"
      aria-label={`Atrasada — prazo era ${formatted}`}
    >
      <AlertTriangle size={15} aria-hidden="true" />
      Atrasada
    </span>
  );
}

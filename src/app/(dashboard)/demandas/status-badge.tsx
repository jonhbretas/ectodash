import { CheckCircle2, Circle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// The only component in the codebase rendering a demanda's status — Phase
// 5's filtered views and Phase 6's coordinator dashboard reuse this rather
// than re-deriving the icon/color/label pairing (04-UI-SPEC.md Status
// Representation table).
export type DemandaStatus = "pendente" | "em_andamento" | "concluida";

const STATUS_CONFIG: Record<
  DemandaStatus,
  {
    label: string;
    Icon: typeof Circle;
    className: string;
  }
> = {
  pendente: {
    label: "Pendente",
    Icon: Circle,
    className: "border border-amber-300 bg-amber-100 text-amber-700",
  },
  em_andamento: {
    label: "Em andamento",
    Icon: Clock,
    className: "border border-blue-300 bg-blue-100 text-blue-700",
  },
  concluida: {
    label: "Concluída",
    Icon: CheckCircle2,
    className: "border border-green-300 bg-green-100 text-green-700",
  },
};

export type StatusBadgeProps = {
  status: DemandaStatus;
};

// Icon and label are always rendered together — never the icon alone,
// never the color alone (04-UI-SPEC.md's explicit non-color-alone rule).
export default function StatusBadge({ status }: StatusBadgeProps) {
  const { label, Icon, className } = STATUS_CONFIG[status];

  return (
    <Badge
      className={`h-auto rounded-full px-2 py-0.5 text-base font-semibold [&>svg]:size-4! ${className}`}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </Badge>
  );
}

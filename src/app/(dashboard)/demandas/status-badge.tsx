import { CheckCircle2, Circle, Clock } from "lucide-react";

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
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
  },
  em_andamento: {
    label: "Em andamento",
    Icon: Clock,
    className: "bg-[#E6E6E6] text-[#2195B9] ring-1 ring-[#E6E6E6]/60",
  },
  concluida: {
    label: "Concluída",
    Icon: CheckCircle2,
    className: "bg-green-50 text-green-700 ring-1 ring-green-200/60",
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
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-base font-semibold transition-all duration-200 ${className}`}
    >
      <Icon size={15} aria-hidden="true" />
      {label}
    </span>
  );
}

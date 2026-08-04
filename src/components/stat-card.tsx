// Shared stat card used by /painel and /financeiro — extracted from
// painel/page.tsx's local StatCard (identical shape, per-component sizing
// via className). Icon+label always paired, never color alone, matching
// status-badge.tsx's established convention.
import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export type StatCardProps = {
  label: string;
  value: string | number;
  Icon: LucideIcon;
  iconClassName?: string;
  highlight?: boolean;
};

export default function StatCard({
  label,
  value,
  Icon,
  iconClassName = "text-zinc-700",
  highlight = false,
}: StatCardProps) {
  return (
    <Card
      role="group"
      aria-label={`${label}: ${value}`}
      className={
        highlight
          ? "border-red-300 bg-red-100"
          : "border border-zinc-300 bg-white"
      }
    >
      <CardContent className="flex flex-col gap-2 p-6">
        <div className="flex items-center gap-2">
          <Icon
            size={24}
            aria-hidden="true"
            className={highlight ? "text-red-800" : iconClassName}
          />
          <span
            className={`text-xl font-medium ${
              highlight ? "text-red-800" : "text-zinc-700"
            }`}
          >
            {label}
          </span>
        </div>
        <span
          className={`text-3xl font-semibold ${
            highlight ? "text-red-800" : "text-zinc-900"
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

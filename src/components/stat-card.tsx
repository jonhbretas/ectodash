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
  iconClassName = "text-slate-600",
  highlight = false,
}: StatCardProps) {
  return (
    <Card
      role="group"
      aria-label={`${label}: ${value}`}
      className={`relative overflow-hidden border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 ${
        highlight
          ? "bg-red-50 ring-1 ring-red-200/60"
          : "bg-white ring-1 ring-slate-200/60"
      }`}
    >
      <div
        className={`absolute top-0 left-0 h-1 w-full ${
          highlight
            ? "bg-gradient-to-r from-red-500 to-red-400"
            : "bg-gradient-to-r from-blue-500 to-indigo-500"
        }`}
        aria-hidden="true"
      />
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              highlight
                ? "bg-red-100 text-red-600"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <Icon size={18} aria-hidden="true" strokeWidth={1.75} />
          </div>
          <span
            className={`text-sm font-medium ${
              highlight ? "text-red-700" : "text-slate-500"
            }`}
          >
            {label}
          </span>
        </div>
        <span
          className={`text-2xl font-bold tracking-tight ${
            highlight ? "text-red-700" : "text-slate-900"
          }`}
        >
          {value}
        </span>
      </CardContent>
    </Card>
  );
}

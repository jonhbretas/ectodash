"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  rascunho: {
    label: "Rascunho",
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  },
  publicada: {
    label: "Publicada",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-red-50 text-red-700 border-red-200",
  },
} as const;

export default function EscalaStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.rascunho;

  return (
    <Badge
      variant="outline"
      className={`text-sm font-medium ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}

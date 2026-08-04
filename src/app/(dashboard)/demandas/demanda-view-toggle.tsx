"use client";

// View switcher — Lista / Kanban / Calendário. The choice persists in the
// URL (?view=...) using the same router.push pattern demanda-filters.tsx
// already established, so the view survives navigation and can be shared.
// Segmented control with ≥44px targets and aria-pressed state; the list
// view is the ABSENCE of the param (no redundant ?view=lista in the URL).
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutList, Columns3, CalendarDays } from "lucide-react";
import type { DemandaFilters } from "./demanda-filter-schema";

export type DemandaView = "lista" | "kanban" | "calendario";

export type DemandaViewToggleProps = {
  currentView: DemandaView;
};

const OPTIONS: Array<{
  value: DemandaView;
  label: string;
  Icon: typeof LayoutList;
}> = [
  { value: "lista", label: "Lista", Icon: LayoutList },
  { value: "kanban", label: "Kanban", Icon: Columns3 },
  { value: "calendario", label: "Calendário", Icon: CalendarDays },
];

export default function DemandaViewToggle({
  currentView,
}: DemandaViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function selectView(view: DemandaView) {
    // Preserve every other filter (area, responsavel, agrupar) — only the
    // view key changes; "lista" means "remove the param" so the URL never
    // carries a redundant default.
    const params = new URLSearchParams(searchParams.toString());
    if (view === "lista") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    const query = params.toString();
    router.push(query ? `/?${query}` : "/");
  }

  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className="flex w-full max-w-4xl items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm"
    >
      {OPTIONS.map((option) => {
        const active = option.value === currentView;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => selectView(option.value)}
            aria-pressed={active}
            className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
              active
                ? "bg-blue-700 text-white"
                : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <option.Icon size={20} aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

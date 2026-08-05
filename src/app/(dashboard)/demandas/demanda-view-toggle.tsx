"use client";

// View switcher — Lista / Kanban / Calendário. The choice persists in the
// URL (?view=...) using the same router.push pattern demanda-filters.tsx
// already established, so the view survives navigation and can be shared.
// Segmented control with ≥56px targets and aria-pressed state; the list
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
      className="inline-flex w-full items-center gap-1 rounded-xl bg-zinc-100 p-0.5 sm:w-fit"
    >
      {OPTIONS.map((option) => {
        const active = option.value === currentView;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => selectView(option.value)}
            aria-pressed={active}
            className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-base font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:flex-initial ${
              active
                ? "bg-white text-blue-700 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <option.Icon size={17} aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

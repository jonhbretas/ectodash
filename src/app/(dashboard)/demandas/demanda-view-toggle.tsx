"use client";

// View switcher — Lista / Kanban / Calendário. The choice persists in the
// URL (?view=...) using the same router.push pattern demanda-filters.tsx
// already established, so the view survives navigation and can be shared.
// Segmented control with ≥56px targets and aria-pressed state; the list
// view is the ABSENCE of the param (no redundant ?view=lista in the URL).
//
// Navigation feedback: the clicked option swaps its icon for a spinner for
// the duration of the client-side transition (the route-level loading.tsx
// skeleton shows in the content area meanwhile) — the Kanban view re-fetches
// every demanda server-side, and without this the click looks dead.
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutList, Columns3, CalendarDays, Loader2 } from "lucide-react";

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

// Safety net — if the navigation never completes (network failure, server
// error) the spinner must not stay stuck forever.
const MAX_PENDING_MS = 15_000;

export default function DemandaViewToggle({
  currentView,
}: DemandaViewToggleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingView, setPendingView] = useState<DemandaView | null>(null);

  useEffect(() => {
    if (pendingView === null) return;
    if (pendingView === currentView) {
      // Navigation committed — clear the spinner right after the new props
      // land (deferred so it never cascades into the same render commit).
      const timer = setTimeout(() => setPendingView(null), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setPendingView(null), MAX_PENDING_MS);
    return () => clearTimeout(timer);
  }, [pendingView, currentView]);

  function selectView(view: DemandaView) {
    if (pendingView !== null || view === currentView) return;
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
    setPendingView(view);
    router.push(query ? `/?${query}` : "/");
  }

  return (
    <div
      role="group"
      aria-label="Modo de visualização"
      className="inline-flex items-center gap-1 rounded-xl bg-zinc-100 p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.value === currentView;
        const pending = pendingView === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => selectView(option.value)}
            aria-pressed={active}
            aria-busy={pending}
            disabled={pendingView !== null}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] sm:px-3 sm:text-base ${
              active
                ? "bg-white text-[#2195B9] shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60"
                : "text-zinc-600 hover:text-zinc-900"
            } ${pending ? "cursor-wait" : ""} disabled:opacity-90`}
          >
            {pending ? (
              <Loader2
                size={17}
                aria-hidden="true"
                className="animate-spin"
              />
            ) : (
              <option.Icon size={17} aria-hidden="true" />
            )}
            <span className="truncate max-sm:hidden">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

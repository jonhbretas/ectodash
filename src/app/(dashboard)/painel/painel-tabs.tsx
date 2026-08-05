"use client";

// Segmented tab bar for the /painel sections (07-UI-SPEC.md — one screen,
// many categories: summary, overdue, institutional config, job logs).
// Each tab receives its content as a pre-rendered ReactNode from the server
// page; this component only tracks which tab is active. Only the active
// tab's panel is mounted.
import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PainelTab = {
  id: string;
  label: string;
  badge?: number;
  content: ReactNode;
};

export default function PainelTabs({ tabs }: { tabs: PainelTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (!active) return null;

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        role="tablist"
        aria-label="Seções do painel"
        className="flex w-full flex-wrap items-center gap-1 rounded-2xl bg-zinc-100 p-1 ring-1 ring-zinc-200/60"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              id={`painel-tab-trigger-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`painel-tab-panel-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl px-4 text-base font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4883a]",
                selected
                  ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-700"
              )}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-semibold",
                    tab.badge > 0
                      ? "bg-red-100 text-red-700"
                      : "bg-zinc-200 text-zinc-500"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        id={`painel-tab-panel-${active.id}`}
        role="tabpanel"
        aria-labelledby={`painel-tab-trigger-${active.id}`}
        className="flex w-full flex-col gap-8"
      >
        {active.content}
      </div>
    </div>
  );
}

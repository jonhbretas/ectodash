"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrailTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
};

export default function TrailTabs({ tabs }: { tabs: TrailTab[] }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (!active) return null;

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        role="tablist"
        aria-label="Trilhas"
        className="flex w-full flex-wrap items-center gap-1 rounded-2xl bg-zinc-100 p-1 ring-1 ring-zinc-200/60"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`trail-tab-trigger-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`trail-tab-panel-${tab.id}`}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-xl px-5 text-base font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
                selected
                  ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-700"
              )}
            >
              <Icon size={18} aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={`trail-tab-panel-${active.id}`}
        role="tabpanel"
        aria-labelledby={`trail-tab-trigger-${active.id}`}
        className="flex w-full flex-col gap-8"
      >
        {active.content}
      </div>
    </div>
  );
}

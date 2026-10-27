"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { GraduationCap, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_ICONS = {
  users: Users,
  graduation: GraduationCap,
} as const;

type TrailTab = {
  id: string;
  label: string;
  icon: keyof typeof TAB_ICONS;
};

export default function TrailTabs({
  tabs,
  children,
}: {
  tabs: TrailTab[];
  children: ReactNode[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const activeId = params.get("tab") ?? tabs[0]?.id ?? "";
  function setActiveId(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", id);
    next.delete("etapa");
    router.replace(`/trilha?${next.toString()}`, { scroll: false });
  }
  const activeIndex = tabs.findIndex((t) => t.id === activeId);
  const active = tabs[activeIndex] ?? tabs[0];

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
          const Icon = TAB_ICONS[tab.icon];
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

      {tabs.map((tab, i) => (
        <div
          key={tab.id}
          id={`trail-tab-panel-${tab.id}`}
          role="tabpanel"
          hidden={tab.id !== active.id}
          aria-labelledby={`trail-tab-trigger-${tab.id}`}
          className={cn(
            "flex w-full flex-col gap-8",
            tab.id !== active.id && "hidden"
          )}
        >
          {children[i]}
        </div>
      ))}
    </div>
  );
}

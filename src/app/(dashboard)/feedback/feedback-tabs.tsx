"use client";

// src/app/(dashboard)/feedback/feedback-tabs.tsx
// Tabs simples para alternar entre Relatos e Logs sem navegar.
// Mantém estado local; acessível via role=tablist.
import { useState } from "react";
import { MessageSquareWarning, History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RelatoRow } from "./feedback-view";
import FeedbackView from "./feedback-view";
import FeedbackLogPanel from "./feedback-log-panel";

type TabId = "relatos" | "logs";

export default function FeedbackTabs({
  relatos,
  isCoordenador,
}: {
  relatos: RelatoRow[];
  isCoordenador: boolean;
}) {
  const [tab, setTab] = useState<TabId>("relatos");

  return (
    <div className="flex w-full flex-col gap-4">
      {isCoordenador && (
        <div
          role="tablist"
          aria-label="Seções de relatos"
          className="flex w-fit items-center gap-1 rounded-xl bg-zinc-100 p-1"
        >
          <button
            role="tab"
            aria-selected={tab === "relatos"}
            aria-controls="panel-relatos"
            id="tab-relatos"
            type="button"
            onClick={() => setTab("relatos")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
              tab === "relatos"
                ? "bg-white text-zinc-900 shadow"
                : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <MessageSquareWarning size={16} aria-hidden="true" />
            Relatos
          </button>
          <button
            role="tab"
            aria-selected={tab === "logs"}
            aria-controls="panel-logs"
            id="tab-logs"
            type="button"
            onClick={() => setTab("logs")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
              tab === "logs"
                ? "bg-white text-zinc-900 shadow"
                : "text-zinc-500 hover:text-zinc-700"
            )}
          >
            <History size={16} aria-hidden="true" />
            Logs
          </button>
        </div>
      )}

      <div
        id="panel-relatos"
        role="tabpanel"
        aria-labelledby="tab-relatos"
        hidden={isCoordenador && tab !== "relatos"}
      >
        <FeedbackView relatos={relatos} isCoordenador={isCoordenador} />
      </div>

      {isCoordenador && (
        <div
          id="panel-logs"
          role="tabpanel"
          aria-labelledby="tab-logs"
          hidden={tab !== "logs"}
        >
          {tab === "logs" && <FeedbackLogPanel relatos={relatos} />}
        </div>
      )}
    </div>
  );
}

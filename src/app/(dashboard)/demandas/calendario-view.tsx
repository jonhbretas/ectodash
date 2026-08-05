"use client";

// Calendar view — demandas placed on their prazo date in a month grid
// (Sunday-first weeks, pt-BR labels). Colors carry the status at a glance
// but never carry meaning alone: each chip also shows a text label on
// larger screens and every chip links to its demanda's edit screen.
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { KanbanDemanda } from "./kanban-board";

export type CalendarioViewProps = {
  demandas: KanbanDemanda[];
};

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const STATUS_CHIP: Record<
  KanbanDemanda["status"],
  { className: string; label: string }
> = {
  pendente: { className: "bg-amber-100 text-amber-900", label: "Pendente" },
  em_andamento: { className: "bg-blue-100 text-blue-900", label: "Em andamento" },
  concluida: { className: "bg-green-100 text-green-900", label: "Concluída" },
};

export default function CalendarioView({ demandas }: CalendarioViewProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDate = useMemo(() => {
    const map = new Map<string, KanbanDemanda[]>();
    for (const demanda of demandas) {
      const date = format(parseISO(demanda.prazo), "yyyy-MM-dd");
      const bucket = map.get(date) ?? [];
      bucket.push(demanda);
      map.set(date, bucket);
    }
    return map;
  }, [demandas]);

  const monthLabel = format(cursor, "MMMM yyyy", { locale: ptBR });
  const today = new Date();

  // Grid always spans full Sunday-to-Saturday weeks, so chunking into rows
  // of 7 is exact — each row is a flex-1 strip that stretches to fill the
  // viewport height on desktop.
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-2xl font-semibold capitalize text-zinc-900">
          {monthLabel}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor((m) => addMonths(m, -1))}
            aria-label="Mês anterior"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="min-h-12 rounded-xl border border-zinc-300 bg-white px-4 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setCursor((m) => addMonths(m, 1))}
            aria-label="Próximo mês"
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <div
            key={weekday}
            className="px-1 pb-1 text-center text-base font-semibold text-zinc-600"
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-1 lg:h-[calc(100dvh-24rem)]">
        {weeks.map((week) => (
          <div key={format(week[0], "yyyy-MM-dd")} className="grid flex-1 grid-cols-7 gap-1">
            {week.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const items = byDate.get(dateKey) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const isToday = isSameDay(day, today);

              return (
                <div
                  key={dateKey}
                  className={`flex min-h-20 flex-col gap-1 overflow-hidden rounded-xl border p-1 sm:min-h-28 lg:min-h-0 sm:p-2 ${
                    inMonth ? "border-zinc-200 bg-white" : "border-zinc-100 bg-zinc-50/50"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-lg font-medium ${
                      isToday
                        ? "bg-blue-700 text-white"
                        : inMonth
                          ? "text-zinc-900"
                          : "text-zinc-400"
                    }`}
                  >
                    {format(day, "d")}
                  </span>

                  <div className="flex flex-col gap-1">
                    {items.map((demanda) => {
                      const chip = STATUS_CHIP[demanda.status];
                      return (
                        <Link
                          key={demanda.id}
                          href={`/demandas/${demanda.id}/editar`}
                          title={`${demanda.titulo} — ${chip.label}`}
                          className={`block truncate rounded-lg px-1.5 py-0.5 text-sm font-medium transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 sm:text-base ${
                            chip.className
                          } ${demanda.atrasada ? "ring-1 ring-red-400" : ""}`}
                        >
                          <span className="hidden lg:inline">{demanda.titulo}</span>
                          <span className="lg:hidden">
                            {demanda.atrasada ? "!" : "•"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-700">
        <span className="font-semibold text-zinc-900">Legenda:</span>
        {(["pendente", "em_andamento", "concluida"] as const).map((status) => {
          const chip = STATUS_CHIP[status];
          return (
            <span key={status} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-full ${chip.className}`} aria-hidden="true" />
              {chip.label}
            </span>
          );
        })}
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full ring-1 ring-red-400" aria-hidden="true" />
          Atrasada
        </span>
      </div>
    </div>
  );
}

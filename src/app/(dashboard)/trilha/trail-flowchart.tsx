"use client";

import { useTrailSelection } from "./use-trail-selection";
import JourneyStepButton from "./journey-step-button";
import {
  BookOpen,
  Award,
  Lightbulb,
  Users,
  Trophy,
  Check,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Category = {
  nome: string;
  concluido: boolean;
  detalhe?: string;
};

type TrailStage = {
  id: string;
  titulo: string;
  descricao: string;
  icone: "book" | "award" | "lightbulb" | "users" | "trophy";
  cor: string;
  categorias: Category[];
};

const ICON_MAP = {
  book: BookOpen,
  award: Award,
  lightbulb: Lightbulb,
  users: Users,
  trophy: Trophy,
} as const;

export default function TrailFlowchart({
  stages,
  etapaAtual,
  completedIds,
}: {
  stages: TrailStage[];
  etapaAtual: number;
  completedIds?: string[];
}) {
  const [active, setActive] = useTrailSelection("voluntario", stages.map((stage) => stage.id), etapaAtual);

  const stage = stages[active];
  const Icon = ICON_MAP[stage.icone];
  const isComplete = completedIds?.includes(`voluntario:${stage.id}`) ?? false;
  const isCurrent = active === etapaAtual && !isComplete;

  return (
    <section className="relative w-full">
      {/* Section header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
          Fluxograma de Progressão
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
      </div>

      {/* Trail container */}
      <div className="relative rounded-3xl bg-gradient-to-br from-white via-white to-zinc-50/50 p-6 ring-1 ring-zinc-200/40 shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:p-8">
        {/* Decorative background dots */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#2195B9]/3 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#FDBA2F]/3 blur-3xl" />
        </div>

        {/* ── Etapas (colored icons) on top ── */}
        <div className="relative mb-10 overflow-x-auto pb-1">
          <div className="flex min-w-[560px] items-start justify-between gap-2 sm:gap-4">
            {stages.map((s, i) => {
              const SIcon = ICON_MAP[s.icone];
              const sDone = completedIds?.includes(`voluntario:${s.id}`) ?? false;
              const sCurrent = i === etapaAtual && !sDone;
              const isActive = i === active;

              return (
                <div
                  key={s.id}
                  className="relative flex flex-1 flex-col items-center gap-2.5"
                >
                  {/* Connector line to next stage */}
                  {i < stages.length - 1 && (
                    <div
                      className={cn(
                        "absolute top-[30px] left-1/2 h-1 w-[calc(100%+0.5rem)] rounded-full sm:w-[calc(100%+1rem)]",
                        sDone
                          ? "bg-gradient-to-r from-[#16a34a] to-[#2195B9]"
                          : sCurrent
                            ? "bg-gradient-to-r from-[#FDBA2F] to-zinc-200"
                            : "bg-zinc-200"
                      )}
                    />
                  )}

                  {/* Icon badge */}
                  <button
                    onClick={() => setActive(i)}
                    aria-label={`${s.titulo} — Etapa ${i + 1}`}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "group relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 transition-all duration-300",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
                      sDone
                        ? "border-[#16a34a] bg-gradient-to-br from-[#16a34a] to-[#059669] text-white shadow-[0_0_0_4px_rgba(22,163,74,0.15)]"
                        : sCurrent
                          ? "border-[#FDBA2F] bg-gradient-to-br from-[#FDBA2F] to-[#e5a520] text-white shadow-[0_0_0_4px_rgba(253,186,47,0.25)] animate-[pulse-soft_2s_ease-in-out_infinite]"
                          : isActive
                            ? "border-[#2195B9] text-[#2195B9] shadow-[0_0_0_4px_rgba(33,149,185,0.15)]"
                            : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-500"
                    )}
                  >
                    {sDone ? (
                      <Check size={24} strokeWidth={2.5} />
                    ) : (
                      <SIcon size={24} strokeWidth={1.75} />
                    )}

                    {/* Glow effect for current */}
                    {sCurrent && (
                      <span className="absolute -inset-1 rounded-2xl bg-[#FDBA2F]/20 animate-[pulse-soft_2s_ease-in-out_infinite]" />
                    )}
                  </button>

                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider sm:text-xs",
                        isActive ? "text-[#2195B9]" : "text-zinc-400"
                      )}
                    >
                      Etapa {i + 1}
                    </span>
                    <span className="hidden max-w-full text-center text-[10px] leading-tight text-zinc-500 line-clamp-1 lg:block">
                      {s.titulo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Task card (full width) ── */}
        <div className="relative">
          <div
            className={cn(
              "w-full rounded-2xl p-5 ring-1 border-0 transition-all duration-300",
              isCurrent
                ? "bg-gradient-to-r from-white to-[#FDBA2F]/5 ring-[#FDBA2F]/40 shadow-[0_4px_20px_rgba(253,186,47,0.08)]"
                : isComplete
                  ? "bg-white ring-[#16a34a]/20 shadow-[0_1px_3px_rgba(22,163,74,0.04)]"
                  : "bg-white ring-zinc-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-xs font-bold uppercase tracking-widest",
                      isComplete
                        ? "text-[#16a34a]"
                        : isCurrent
                          ? "text-[#e5a520]"
                          : "text-zinc-400"
                    )}
                  >
                    Etapa {active + 1}
                  </span>
                  {isComplete && (
                    <span className="rounded-full bg-[#16a34a]/10 px-2 py-0.5 text-xs font-semibold text-[#16a34a]">
                      Explorada
                    </span>
                  )}
                  {isCurrent && (
                    <span className="rounded-full bg-[#FDBA2F]/15 px-2 py-0.5 text-xs font-semibold text-[#e5a520]">
                      Próxima descoberta
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-zinc-900">{stage.titulo}</h3>
                <p className="text-sm text-zinc-500">{stage.descricao}</p>
              </div>

            </div>

            {/* Categories */}
            <div className="mt-4 flex flex-col gap-1.5 border-t border-zinc-100 pt-4">
              {stage.categorias.map((cat, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200",
                    cat.concluido
                      ? "bg-[#16a34a]/5"
                      : isCurrent
                        ? "bg-zinc-50/80"
                        : "bg-zinc-50/50"
                  )}
                >
                  {cat.concluido ? (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  ) : isCurrent ? (
                    <Circle
                      size={24}
                      className="shrink-0 text-[#FDBA2F]"
                      strokeWidth={1.5}
                    />
                  ) : (
                    <Circle size={24} className="shrink-0 text-zinc-300" strokeWidth={1.5} />
                  )}
                  <div className="flex flex-1 items-center justify-between">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        cat.concluido ? "text-zinc-700" : "text-zinc-400"
                      )}
                    >
                      {cat.nome}
                    </span>
                    {cat.detalhe && (
                      <span
                        className={cn(
                          "text-xs font-medium",
                          cat.concluido ? "text-[#16a34a]" : "text-zinc-400"
                        )}
                      >
                        {cat.detalhe}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {completedIds && <JourneyStepButton key={stage.id} stepId={`voluntario:${stage.id}`} completedIds={completedIds} />}
          </div>

          {/* End node */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="h-6 w-0.5 border-l-2 border-dashed border-zinc-200" />
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50">
              <Trophy size={24} className="text-zinc-300" />
            </div>
            <div className="w-full rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-5 text-center">
              <p className="text-sm font-medium text-zinc-400 italic">
                Cada descoberta é um passo. Explore todas as etapas no seu ritmo.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

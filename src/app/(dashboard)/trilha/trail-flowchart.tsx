"use client";

import { useState } from "react";
import {
  BookOpen,
  Award,
  Lightbulb,
  Users,
  Trophy,
  Check,
  Lock,
  ChevronDown,
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

function StageNode({
  stage,
  index,
  isCurrent,
  isLast,
}: {
  stage: TrailStage;
  index: number;
  isCurrent: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(isCurrent);
  const Icon = ICON_MAP[stage.icone];
  const concluidos = stage.categorias.filter((c) => c.concluido).length;
  const total = stage.categorias.length;
  const isComplete = concluidos === total;

  return (
    <div className="relative flex w-full items-start gap-0">
      {/* ── Spine column (icon + connector line) ── */}
      <div className="relative z-10 flex flex-col items-center" style={{ minWidth: 72 }}>
        {/* Icon badge */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className={cn(
            "group relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 transition-all duration-300",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
            isComplete
              ? "border-[#16a34a] bg-gradient-to-br from-[#16a34a] to-[#059669] text-white shadow-[0_0_0_4px_rgba(22,163,74,0.15)]"
              : isCurrent
                ? "border-[#FDBA2F] bg-gradient-to-br from-[#FDBA2F] to-[#e5a520] text-white shadow-[0_0_0_4px_rgba(253,186,47,0.25)] animate-[pulse-soft_2s_ease-in-out_infinite]"
                : "border-zinc-200 bg-white text-zinc-400"
          )}
          aria-label={`${stage.titulo} — ${concluidos}/${total} concluídos`}
        >
          {isComplete ? (
            <Check size={24} strokeWidth={2.5} />
          ) : (
            <Icon size={24} strokeWidth={1.75} />
          )}

          {/* Glow effect for current */}
          {isCurrent && (
            <span className="absolute -inset-1 rounded-2xl bg-[#FDBA2F]/20 animate-[pulse-soft_2s_ease-in-out_infinite]" />
          )}
        </button>

        {/* Connector line */}
        {!isLast && (
          <div className="relative w-1 flex-1 py-2">
            <div
              className={cn(
                "absolute inset-x-0 top-0 bottom-0 rounded-full",
                isComplete
                  ? "bg-gradient-to-b from-[#16a34a] to-[#2195B9]"
                  : isCurrent
                    ? "bg-gradient-to-b from-[#FDBA2F] to-zinc-200"
                    : "bg-zinc-200"
              )}
            />
            {/* Animated dots on completed connections */}
            {isComplete && (
              <div className="absolute inset-x-0 top-0 bottom-0 overflow-hidden">
                <div className="absolute left-1/2 -translate-x-1/2 w-1 h-2 bg-white/60 rounded-full animate-[shimmer_2s_ease-in-out_infinite]" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Content card ── */}
      <div className="flex-1 pb-6 pl-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className={cn(
            "w-full text-left rounded-2xl p-5 transition-all duration-300",
            "ring-1 border-0",
            isCurrent
              ? "bg-gradient-to-r from-white to-[#FDBA2F]/5 ring-[#FDBA2F]/40 shadow-[0_4px_20px_rgba(253,186,47,0.08)]"
              : isComplete
                ? "bg-white ring-[#16a34a]/20 shadow-[0_1px_3px_rgba(22,163,74,0.04)]"
                : "bg-white ring-zinc-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
            "hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:-translate-y-0.5",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
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
                  Etapa {index + 1}
                </span>
                {isComplete && (
                  <span className="rounded-full bg-[#16a34a]/10 px-2 py-0.5 text-xs font-semibold text-[#16a34a]">
                    Concluída
                  </span>
                )}
                {isCurrent && (
                  <span className="rounded-full bg-[#FDBA2F]/15 px-2 py-0.5 text-xs font-semibold text-[#e5a520]">
                    Em andamento
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-zinc-900">{stage.titulo}</h3>
              <p className="text-sm text-zinc-500">{stage.descricao}</p>
            </div>

            <div className="flex items-center gap-2">
              {/* Progress mini-bar */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-semibold text-zinc-500">
                  {concluidos}/{total}
                </span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isComplete
                        ? "bg-gradient-to-r from-[#16a34a] to-[#059669]"
                        : "bg-gradient-to-r from-[#2195B9] to-[#FDBA2F]"
                    )}
                    style={{ width: `${total > 0 ? (concluidos / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <ChevronDown
                size={18}
                className={cn(
                  "text-zinc-400 transition-transform duration-300",
                  expanded && "rotate-180"
                )}
              />
            </div>
          </div>

          {/* Expanded categories */}
          <div
            className={cn(
              "grid transition-all duration-300",
              expanded
                ? "mt-4 grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-1.5 border-t border-zinc-100 pt-4">
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
                      <Lock size={16} className="shrink-0 text-zinc-300" />
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
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

export default function TrailFlowchart({
  stages,
  etapaAtual,
}: {
  stages: TrailStage[];
  etapaAtual: number;
}) {
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

        {/* Nodes */}
        <div className="relative">
          {stages.map((stage, i) => (
            <StageNode
              key={stage.id}
              stage={stage}
              index={i}
              isCurrent={i === etapaAtual}
              isLast={i === stages.length - 1}
            />
          ))}

          {/* End node */}
          <div className="relative flex w-full items-center">
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50">
              <Trophy size={24} className="text-zinc-300" />
            </div>
            <div className="ml-4 flex-1 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 p-5">
              <p className="text-sm font-medium text-zinc-400 italic">
                Continue trilhando para desbloquear todas as etapas...
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

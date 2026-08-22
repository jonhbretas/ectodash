"use client";

import { useState } from "react";
import {
  BookOpen,
  MonitorPlay,
  Presentation,
  Users,
  Star,
  Zap,
  FileText,
  Check,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DocenteStep = {
  id: string;
  titulo: string;
  descricao: string;
  icone: "book" | "monitor" | "presentation";
  cor: string;
  categorias: {
    nome: string;
    concluido: boolean;
    detalhe?: string;
  }[];
};

type DocentePath = {
  id: string;
  titulo: string;
  descricao: string;
  icone: "proep" | "ogb" | "dip" | "curso";
  cor: string;
  detalhe: string;
};

const STEP_ICONS = {
  book: BookOpen,
  monitor: MonitorPlay,
  presentation: Presentation,
} as const;

const PATH_ICONS = {
  proep: Users,
  ogb: Star,
  dip: Zap,
  curso: FileText,
} as const;

const BASE_STEPS: DocenteStep[] = [
  {
    id: "livro",
    titulo: "Leitura do Livro",
    descricao: "Ectoplasma: Panorama Contemporâneo das Pesquisas sobre Ectoplasmia",
    icone: "book",
    cor: "from-[#2195B9] to-[#1a7a99]",
    categorias: [
      { nome: "Leitura completa do livro", concluido: false },
    ],
  },
  {
    id: "curso-ead",
    titulo: "Curso Ectoplasmia Interassistencial",
    descricao: "Participar do curso EaD",
    icone: "monitor",
    cor: "from-[#16a34a] to-[#0d8a3a]",
    categorias: [
      { nome: "Participação no curso EaD", concluido: false },
    ],
  },
  {
    id: "curso-autoorg",
    titulo: "Auto-Organização Bioenergética",
    descricao: "Participar como aluno e ministrar o curso",
    icone: "presentation",
    cor: "from-[#FDBA2F] to-[#e5a520]",
    categorias: [
      { nome: "Participar na condição de aluno", concluido: false },
      { nome: "Ministrar o curso", concluido: false },
    ],
  },
];

const FOLLOW_PATHS: DocentePath[] = [
  {
    id: "proep",
    titulo: "PROEP",
    descricao: "Participar 6 meses ativamente da DIP, ser monitor e depois realizar aulas-treino",
    icone: "proep",
    cor: "from-[#8b5cf6] to-[#7c3aed]",
    detalhe: "Participação ativa → Monitoria → Aulas-treino",
  },
  {
    id: "ogb",
    titulo: "OGB",
    descricao: "Participar como professor 2 até ser aprovado",
    icone: "ogb",
    cor: "from-[#2195B9] to-[#1a7a99]",
    detalhe: "Atuação como Professor 2 até aprovação final",
  },
  {
    id: "dip",
    titulo: "DIP",
    descricao: "Ser Energizador 1, o ideal é ser professor e tenepessista",
    icone: "dip",
    cor: "from-[#16a34a] to-[#0d8a3a]",
    detalhe: "Combinação ideal: Professor + Tenepessista",
  },
  {
    id: "proposicao",
    titulo: "Proposição de Curso",
    descricao: "Elaboração e submissão de proposta de curso à Ectolab",
    icone: "curso",
    cor: "from-[#e11d48] to-[#be123c]",
    detalhe: "Elaboração e submissão de proposta de curso",
  },
];

export default function TrailDocenteFlowchart() {
  const [activeBase, setActiveBase] = useState(0);
  const [activePath, setActivePath] = useState<number | null>(null);

  const step = BASE_STEPS[activeBase];

  return (
    <section className="relative w-full">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">
          Jornada Docente na Ectolab
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
      </div>

      <div className="relative rounded-3xl bg-gradient-to-br from-white via-white to-zinc-50/50 p-6 ring-1 ring-zinc-200/40 shadow-[0_1px_3px_rgba(0,0,0,0.02)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[#2195B9]/3 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#FDBA2F]/3 blur-3xl" />
        </div>

        {/* Base steps */}
        <div className="relative mb-4">
          <p className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-[#2195B9]">
            Caminho Formativo
          </p>
          <div className="flex min-w-[480px] items-start justify-between gap-2 overflow-x-auto sm:gap-4">
            {BASE_STEPS.map((s, i) => {
              const SIcon = STEP_ICONS[s.icone];
              const isActive = i === activeBase;
              const isDone = s.categorias.every((c) => c.concluido);

              return (
                <div
                  key={s.id}
                  className="relative flex flex-1 flex-col items-center gap-2.5"
                >
                  {i < BASE_STEPS.length - 1 && (
                    <div
                      className={cn(
                        "absolute top-[30px] left-1/2 h-1 w-[calc(100%+0.5rem)] rounded-full sm:w-[calc(100%+1rem)]",
                        isDone
                          ? "bg-gradient-to-r from-[#16a34a] to-[#2195B9]"
                          : "bg-zinc-200"
                      )}
                    />
                  )}

                  <button
                    onClick={() => { setActiveBase(i); setActivePath(null); }}
                    aria-label={s.titulo}
                    className={cn(
                      "group relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 transition-all duration-300",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
                      isDone
                        ? "border-[#16a34a] bg-gradient-to-br from-[#16a34a] to-[#059669] text-white shadow-[0_0_0_4px_rgba(22,163,74,0.15)]"
                        : isActive
                          ? cn("text-white shadow-[0_0_0_4px_rgba(33,149,185,0.15)]", s.cor.startsWith("from-") ? `bg-gradient-to-br ${s.cor}` : "bg-[#2195B9]", "border-transparent")
                          : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300 hover:text-zinc-500"
                    )}
                  >
                    {isDone ? (
                      <Check size={24} strokeWidth={2.5} />
                    ) : (
                      <SIcon size={24} strokeWidth={1.75} />
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
                    <span className="hidden max-w-full text-center text-[10px] leading-tight text-zinc-500 line-clamp-2 lg:block">
                      {s.titulo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail card for active base step */}
        <div className="relative mb-6">
          <div
            className={cn(
              "w-full rounded-2xl p-5 ring-1 border-0 transition-all duration-300",
              "bg-gradient-to-r from-white to-zinc-50/50 ring-zinc-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Etapa {activeBase + 1}
                </span>
                <h3 className="text-xl font-bold text-zinc-900">{step.titulo}</h3>
                <p className="text-sm text-zinc-500">{step.descricao}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5 border-t border-zinc-100 pt-4">
              {step.categorias.map((cat, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200",
                    cat.concluido ? "bg-[#16a34a]/5" : "bg-zinc-50/80"
                  )}
                >
                  {cat.concluido ? (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16a34a] text-white">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  ) : (
                    <Circle size={24} className="shrink-0 text-[#FDBA2F]" strokeWidth={1.5} />
                  )}
                  <div className="flex flex-1 items-center justify-between">
                    <span className={cn("text-sm font-medium", cat.concluido ? "text-zinc-700" : "text-zinc-400")}>
                      {cat.nome}
                    </span>
                    {cat.detalhe && (
                      <span className={cn("text-xs font-medium", cat.concluido ? "text-[#16a34a]" : "text-zinc-400")}>
                        {cat.detalhe}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Divider — paths after base steps */}
        <div className="relative mb-6 flex flex-col items-center gap-2">
          <div className="h-6 w-0.5 border-l-2 border-dashed border-zinc-300" />
          <p className="text-center text-sm font-semibold italic text-zinc-500">
            Após concluir as etapas acima, você poderá seguir os seguintes caminhos:
          </p>
          <div className="h-3 w-0.5 border-l-2 border-dashed border-zinc-300" />
        </div>

        {/* Follow-up paths */}
        <div className="relative">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FOLLOW_PATHS.map((path, i) => {
              const PIcon = PATH_ICONS[path.icone];
              const isActive = activePath === i;

              return (
                <button
                  key={path.id}
                  onClick={() => setActivePath(isActive ? null : i)}
                  className={cn(
                    "group relative flex flex-col items-center gap-3 rounded-2xl border-2 p-5 text-center transition-all duration-300",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
                    isActive
                      ? cn("text-white shadow-lg", `bg-gradient-to-br ${path.cor}`, "border-transparent")
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:shadow-md"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300",
                      isActive
                        ? "bg-white/20"
                        : "bg-zinc-100 group-hover:bg-zinc-200"
                    )}
                  >
                    <PIcon size={22} className={isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-700"} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={cn("text-sm font-bold", isActive ? "text-white" : "text-zinc-800")}>
                      {path.titulo}
                    </span>
                    <span className={cn("text-xs leading-relaxed", isActive ? "text-white/80" : "text-zinc-500")}>
                      {path.descricao}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mt-auto rounded-lg px-3 py-1.5 text-[10px] font-medium",
                      isActive ? "bg-white/15 text-white/90" : "bg-zinc-50 text-zinc-500"
                    )}
                  >
                    {path.detalhe}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Compass, GraduationCap, Map, Sparkles, Trophy } from "lucide-react";
import { journeySteps, journeySummary, type JourneyTrack } from "@/lib/journey";
import { cn } from "@/lib/utils";

export default function HomeJourney({ completedIds, availableSystemIds, canViewTrails, unavailable = false }: {
  completedIds: string[];
  availableSystemIds: string[];
  canViewTrails: boolean;
  unavailable?: boolean;
}) {
  const [track, setTrack] = useState<JourneyTrack>(canViewTrails ? "voluntario" : "sistema");
  const available = journeySteps.filter((step) => step.track === "sistema"
    ? availableSystemIds.includes(step.id) : canViewTrails);
  const summary = journeySummary(completedIds, available);
  const steps = available.filter((step) => step.track === track);
  const current = journeySummary(completedIds, steps);
  const tabs = [
    ...(canViewTrails ? [
      { id: "voluntario" as const, title: "Voluntário", Icon: Map },
      { id: "docente" as const, title: "Docente", Icon: GraduationCap },
    ] : []),
    { id: "sistema" as const, title: "Explorar", Icon: Compass },
  ];
  const next = current.next;
  const badge = summary.done === summary.total ? "Jornada explorada" : summary.points >= 100 ? "Explorador de saberes" : summary.points > 0 ? "Primeiros passos" : "Uma nova jornada";

  return (
    <section aria-labelledby="journey-title" className="order-first flex min-w-0 flex-col overflow-hidden rounded-3xl border border-[#28627B]/15 bg-white shadow-sm xl:order-last">
      <div className="relative overflow-hidden bg-[#173E50] p-5 text-white sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 size-52 rounded-full border-[24px] border-white/5" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-cyan-100"><Sparkles size={14} aria-hidden="true" /> Aprender, participar, compartilhar</p>
            <h2 id="journey-title" className="mt-2 text-2xl font-bold tracking-tight">Sua jornada começa aqui</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-200">Conheça cada etapa das trilhas e descubra novas formas de fazer parte da Ectolab.</p>
          </div>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#FDBA2F] text-[#173E50] shadow-lg"><Trophy size={25} aria-hidden="true" /></span>
        </div>
        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium">{badge}</span>
          <span className="text-sm font-bold text-amber-200">{unavailable ? "—" : summary.points} XP de exploração</span>
        </div>
        <div role="progressbar" aria-label="Exploração da jornada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={unavailable ? 0 : summary.percent} className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-[#FDBA2F] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${unavailable ? 0 : summary.percent}%` }} />
        </div>
        <p className="relative mt-2 text-xs text-slate-200">{unavailable ? "Seu progresso está temporariamente indisponível." : `${summary.done} de ${summary.total} descobertas · cada etapa conta uma vez`}</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
        <div role="tablist" aria-label="Escolha sua jornada" className="grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-slate-100 p-1">
          {tabs.map(({ id, title, Icon }) => <button key={id} id={`home-journey-tab-${id}`} role="tab" aria-selected={track === id} aria-controls="home-journey-panel" type="button" onClick={() => setTrack(id)} className={cn("flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]", track === id ? "bg-white text-[#28627B] shadow-sm" : "text-slate-500 hover:text-slate-900")}>
            <Icon size={16} aria-hidden="true" />{title}
          </button>)}
        </div>
        <div id="home-journey-panel" role="tabpanel" aria-labelledby={`home-journey-tab-${track}`} className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">{track === "voluntario" ? "Trilha do voluntário" : track === "docente" ? "Trilha docente" : "Conheça o sistema"}</h3>
            <span className="text-xs font-medium text-slate-500">{unavailable ? "—" : `${current.done}/${current.total} exploradas`}</span>
          </div>
          <ol className="flex flex-col">
            {steps.map((step, index) => {
              const done = completedIds.includes(step.id);
              const isNext = step.id === next?.id;
              return <li key={step.id} className="relative pb-2 last:pb-0">
                {index < steps.length - 1 && <span aria-hidden="true" className="absolute left-[17px] top-9 h-[calc(100%-20px)] w-0.5 bg-slate-200" />}
                <Link href={step.href} className={cn("relative flex min-h-14 items-center gap-3 rounded-xl p-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]", isNext ? "bg-[#2195B9]/5" : "hover:bg-slate-50")}>
                  <span className={cn("z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white", done ? "bg-emerald-100 text-emerald-700" : isNext ? "bg-[#2195B9] text-white" : "bg-slate-100 text-slate-500")}>{done ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{step.title}</span><span className="block text-xs leading-relaxed text-slate-500">{done ? "Explorada · pode revisitar" : isNext ? step.description : "Disponível para explorar"}</span></span>
                  <span className={cn("shrink-0 text-xs font-semibold", done ? "text-emerald-700" : "text-[#28627B]")}>{done ? "Feito" : `+${step.points} XP`}</span>
                </Link>
              </li>;
            })}
          </ol>
          <Link href={next?.href ?? (track === "sistema" ? "/perfil" : `/trilha?tab=${track}`)} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#28627B] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#2195B9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]">
            {next ? current.done > 0 ? "Continuar jornada" : "Dar o primeiro passo" : "Revisitar minhas descobertas"}<ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">Nas trilhas, leia e confirme cada etapa para ganhar XP. Em Explorar, visite as áreas. Os pontos registram descobertas; a conclusão da formação é acompanhada separadamente.</p>
      </div>
    </section>
  );
}

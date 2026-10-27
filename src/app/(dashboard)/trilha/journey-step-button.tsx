"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCheck, Sparkles, ArrowRight } from "lucide-react";
import { journeySteps } from "@/lib/journey";
import { registrarExploracao } from "../journey-actions";

export default function JourneyStepButton({ stepId, completedIds }: { stepId: string; completedIds: string[] }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const complete = completedIds.includes(stepId);
  const step = journeySteps.find((item) => item.id === stepId);
  if (!step) return null;
  const next = journeySteps.find((item) => item.track === step.track && item.id !== stepId && !completedIds.includes(item.id));

  return (
    <div className="mt-5 rounded-xl border border-[#2195B9]/20 bg-[#2195B9]/5 p-4">
      <p className="text-sm font-semibold text-slate-900">Um passo na sua jornada</p>
      <p className="mt-1 text-sm text-slate-600">Leia os critérios acima e confirme que conheceu esta etapa. A formação é acompanhada separadamente.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || complete}
          onClick={() => startTransition(async () => {
            setError(undefined);
            try {
              const result = await registrarExploracao(stepId);
              if (result.error) setError(result.error);
            } catch { setError("Não foi possível salvar. Tente novamente."); }
          })}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#28627B] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2195B9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-default disabled:bg-emerald-100 disabled:text-emerald-800"
        >
          {complete ? <CheckCheck size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
          {pending ? "Salvando…" : complete ? "Etapa explorada · +20 XP" : "Conheci esta etapa · +20 XP"}
        </button>
        {complete && <Link href={next?.href ?? "/"} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#28627B] hover:underline">
          {next ? "Próxima etapa" : "Voltar à minha jornada"}<ArrowRight size={16} aria-hidden="true" />
        </Link>}
      </div>
      <p role="status" className="mt-2 text-sm text-red-700">{error}</p>
    </div>
  );
}

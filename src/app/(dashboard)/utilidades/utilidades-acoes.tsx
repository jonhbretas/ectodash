"use client";

// Ações de cadastro no topo de Links Úteis: dois botões bem visíveis
// (IA e manual). Só um painel aberto por vez, logo abaixo dos botões.
import { useState } from "react";
import { CheckCircle2, PlusCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import UtilidadesIA from "./utilidades-ia";
import NovoItemForm from "./utilidades-client";

type Area = { id: number; nome: string };
type Painel = "ia" | "manual" | null;

export default function UtilidadesAcoes({ areas }: { areas: Area[] }) {
  const [painel, setPainel] = useState<Painel>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  function alternar(p: Exclude<Painel, null>) {
    setSucesso(null);
    setPainel((atual) => (atual === p ? null : p));
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => alternar("ia")}
          aria-expanded={painel === "ia"}
          className={cn(
            "flex min-h-14 items-center gap-2 rounded-xl px-5 text-lg font-semibold text-white shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
            painel === "ia"
              ? "bg-[#28627B]"
              : "bg-gradient-to-r from-[#2195B9] to-[#28627B] hover:from-[#28627B] hover:to-[#28627B]"
          )}
        >
          <Sparkles size={22} aria-hidden="true" />
          Criar cards com IA
        </button>
        <button
          type="button"
          onClick={() => alternar("manual")}
          aria-expanded={painel === "manual"}
          className={cn(
            "flex min-h-14 items-center gap-2 rounded-xl border-2 px-5 text-lg font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
            painel === "manual"
              ? "border-[#2195B9] bg-[#2195B9]/10 text-[#28627B]"
              : "border-zinc-300 bg-white text-zinc-800 hover:border-[#2195B9] hover:text-[#28627B]"
          )}
        >
          <PlusCircle size={22} aria-hidden="true" />
          Adicionar manualmente
        </button>
      </div>

      {sucesso && painel === null && (
        <p role="status" className="flex w-fit items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-lg font-medium text-green-800 ring-1 ring-green-200">
          <CheckCircle2 size={20} aria-hidden="true" />
          {sucesso}
        </p>
      )}

      {painel === "ia" && <UtilidadesIA areas={areas} onClose={() => setPainel(null)} />}

      {painel === "manual" && (
        <NovoItemForm
          areas={areas}
          onClose={() => setPainel(null)}
          onSaved={(msg) => {
            setSucesso(msg);
            setPainel(null);
          }}
        />
      )}
    </div>
  );
}

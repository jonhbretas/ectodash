"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2 } from "lucide-react";
import { gerarAlocacao } from "./actions";
import ParticipantesLocalidadeDialog from "./participantes-localidade-dialog";

export default function GerarEscalaButton({ escalaId }: { escalaId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [participantesOpen, setParticipantesOpen] = useState(false);

  async function runSort() {
    try {
      const result = await gerarAlocacao(escalaId);
      if (result.needsParticipants) {
        setParticipantesOpen(true);
      } else if (!result.ok) {
        setError(result.message);
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("Erro no sorteio:", err);
      setError("Falha ao gerar o sorteio. Tente novamente.");
    }
  }

  function handleClick() {
    setError(null);
    startTransition(runSort);
  }

  function handleParticipantsSaved() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await gerarAlocacao(escalaId);
        if (!result.ok) setError(result.message);
        else router.refresh();
      } catch (err) {
        console.error("Erro no sorteio:", err);
        setError("Falha ao gerar o sorteio. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={pending}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2195B9] to-[#FDBA2F] px-4 text-lg font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:from-[#28627B] hover:to-[#2195B9] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        <Wand2 size={18} aria-hidden="true" />
        {pending ? "Sorteando..." : "Sortear escala"}
      </button>
      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
      <ParticipantesLocalidadeDialog
        open={participantesOpen}
        onOpenChange={setParticipantesOpen}
        escalaId={escalaId}
        sortearDepoisDeSalvar
        onSaved={handleParticipantsSaved}
      />
    </div>
  );
}

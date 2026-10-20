"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { excluirEscala } from "./actions";

export default function ExcluirEscalaButton({ escalaId }: { escalaId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function excluir() {
    if (!window.confirm("Excluir esta escala e todas as suas alocações? Esta ação não pode ser desfeita.")) return;
    setError(null);
    startTransition(async () => {
      const result = await excluirEscala(escalaId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={excluir}
        disabled={pending}
        className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-lg font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
      >
        {pending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}
        Excluir
      </button>
      {error && <span className="max-w-48 text-right text-sm text-red-600">{error}</span>}
    </div>
  );
}

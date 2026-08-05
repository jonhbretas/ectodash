"use client";

// Alterna a situação de trabalho do voluntário (ativo/ocioso, migration
// 0026) direto do perfil — visível apenas para quem gerencia a equipe.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoonStar, Sun } from "lucide-react";
import { atualizarSituacaoVoluntario } from "./actions";

export default function SituacaoToggle({
  voluntarioId,
  situacao,
}: {
  voluntarioId: number;
  situacao: "ativo" | "ocioso";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function alternar(proxima: "ativo" | "ocioso") {
    setPending(true);
    setMensagem(null);
    const resultado = await atualizarSituacaoVoluntario(voluntarioId, proxima);
    setPending(false);
    setMensagem(resultado.message);
    if (resultado.ok) {
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {situacao === "ocioso" ? (
          <button
            type="button"
            onClick={() => alternar("ativo")}
            disabled={pending}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:opacity-60"
          >
            <Sun size={18} aria-hidden="true" />
            Marcar como ativo
          </button>
        ) : (
          <button
            type="button"
            onClick={() => alternar("ocioso")}
            disabled={pending}
            className="flex min-h-12 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 text-lg font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-60"
          >
            <MoonStar size={18} aria-hidden="true" />
            Marcar como ocioso
          </button>
        )}
        {mensagem && (
          <span className="text-base text-zinc-600">{mensagem}</span>
        )}
      </div>
    </div>
  );
}

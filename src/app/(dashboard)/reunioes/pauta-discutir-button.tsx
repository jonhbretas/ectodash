"use client";

// "Marcar como discutida nesta ata" — used on the ata detail page where the
// ata is implicit (you are inside the meeting). Links the pauta via
// ata_discutida_id (0077). RLS (0076) is the real boundary; the caller only
// renders it when canManage is true.
import { useState, useTransition } from "react";
import { CheckCheck, Loader2 } from "lucide-react";
import { marcarPautaDiscutida } from "./pauta-actions";

export default function PautaDiscutirButton({
  pautaId,
  ataId,
}: {
  pautaId: number;
  ataId: number;
}) {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMensagem(null);
            const result = await marcarPautaDiscutida(pautaId, ataId);
            if (!result.ok && result.message) setMensagem(result.message);
          })
        }
        className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 text-sm font-medium text-white transition-all duration-200 hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
        ) : (
          <CheckCheck size={14} aria-hidden="true" />
        )}
        Discutida nesta reunião
      </button>
      {mensagem && <span className="text-sm text-red-600">{mensagem}</span>}
    </div>
  );
}

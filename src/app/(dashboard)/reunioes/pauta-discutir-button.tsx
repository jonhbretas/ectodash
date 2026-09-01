"use client";

// "Marcar como discutida nesta ata" — used on the ata detail page where the
// ata is implicit (you are inside the meeting). Links the pauta via
// ata_discutida_id (0077). RLS (0076) is the real boundary; the caller only
// renders it when canManage is true.
import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCheck, ChevronDown, Loader2 } from "lucide-react";
import { marcarPautaDiscutida } from "./pauta-actions";

type AtaOption = {
  id: number;
  titulo: string;
  data_reuniao: string;
};

export default function PautaDiscutirButton({
  pautaId,
  ataId,
  atasDisponiveis = [],
}: {
  pautaId: number;
  ataId: number;
  atasDisponiveis?: AtaOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleDiscutir(selectedAtaId: number | null) {
    setShowDropdown(false);
    setMensagem(null);
    startTransition(async () => {
      const result = await marcarPautaDiscutida(pautaId, selectedAtaId ?? ataId);
      if (!result.ok && result.message) setMensagem(result.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          disabled={pending}
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 text-sm font-medium text-white transition-all duration-200 hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          ) : (
            <CheckCheck size={14} aria-hidden="true" />
          )}
          Discutida nesta reunião
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {showDropdown && (
          <div className="absolute left-0 top-full z-10 mt-1 w-72 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
            <div className="border-b border-zinc-100 px-3 py-2">
              <span className="text-xs font-medium text-zinc-500">
                Marcar como discutida na reunião:
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleDiscutir(ataId)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="font-medium text-green-700">Esta reunião</span>
            </button>
            {atasDisponiveis.length > 0 && (
              <>
                <div className="border-t border-zinc-100 px-3 py-1.5">
                  <span className="text-xs font-medium text-zinc-500">
                    Ou selecione outra reunião:
                  </span>
                </div>
                {atasDisponiveis
                  .filter((ata) => ata.id !== ataId)
                  .map((ata) => (
                    <button
                      key={ata.id}
                      type="button"
                      onClick={() => handleDiscutir(ata.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      {ata.data_reuniao} — {ata.titulo}
                    </button>
                  ))}
              </>
            )}
          </div>
        )}
      </div>
      {mensagem && <span className="text-sm text-red-600">{mensagem}</span>}
    </div>
  );
}

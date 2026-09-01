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

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Gera as próximas N terças-feiras a partir de hoje (BRT). */
function gerarProximasTerças(qtd: number): { data: string; label: string }[] {
  const resultado: { data: string; label: string }[] = [];
  const hoje = new Date();
  const hojeBRT = new Date(
    hoje.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  const dia = hojeBRT.getDay();
  const terca = 2;
  let diff = (terca - dia + 7) % 7;
  if (diff === 0) diff = 7;

  for (let i = 0; i < qtd; i++) {
    const data = new Date(hojeBRT);
    data.setDate(data.getDate() + diff + i * 7);
    const yyyy = data.getFullYear();
    const mm = String(data.getMonth() + 1).padStart(2, "0");
    const dd = String(data.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    const label = `${dd}/${mm}/${yyyy}`;
    resultado.push({ data: iso, label });
  }
  return resultado;
}

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

  const proximasTerças = gerarProximasTerças(8);

  const datasExistentes = new Set(atasDisponiveis.map((a) => a.data_reuniao));
  const tercasUnicas = proximasTerças.filter((t) => !datasExistentes.has(t.data));

  const opcoesDiscutir = [
    ...atasDisponiveis.map((a) => ({
      id: a.id,
      data: a.data_reuniao,
      label: `${formatarDataBR(a.data_reuniao)} — ${a.titulo}`,
    })),
    ...tercasUnicas.map((t) => ({
      id: null,
      data: t.data,
      label: `${t.label} — Sem ata`,
    })),
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleDiscutir(selectedAtaId: number | null, dataReuniao?: string) {
    setShowDropdown(false);
    setMensagem(null);
    startTransition(async () => {
      const result = await marcarPautaDiscutida(
        pautaId,
        selectedAtaId ?? ataId,
        dataReuniao
      );
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
          <div className="absolute left-0 top-full z-10 mt-1 w-80 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
            <div className="border-b border-zinc-100 px-3 py-2">
              <span className="text-xs font-medium text-zinc-500">
                Selecione a reunião em que deseja que essa pauta seja discutida:
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleDiscutir(ataId)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <span className="font-medium text-green-700">Esta reunião</span>
            </button>
            {opcoesDiscutir.length > 0 && (
              <>
                <div className="border-t border-zinc-100 px-3 py-1.5">
                  <span className="text-xs font-medium text-zinc-500">
                    Reuniões:
                  </span>
                </div>
                {opcoesDiscutir
                  .filter((opcao) => opcao.id !== ataId)
                  .map((opcao, idx) => (
                    <button
                      key={`${opcao.data}-${idx}`}
                      type="button"
                      onClick={() => handleDiscutir(opcao.id, opcao.id ? undefined : opcao.data)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                    >
                      {opcao.label}
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

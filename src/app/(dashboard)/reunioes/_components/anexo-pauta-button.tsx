"use client";

// Anexar / trocar / remover o arquivo de uma pauta já criada (D-02).
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip, Trash2 } from "lucide-react";
import { ANEXO_ACCEPT } from "@/lib/pautas/anexo";
import { enviarAnexoPauta } from "../_lib/enviar-anexo";
import { removerAnexo } from "../pauta-anexo-actions";

const btn =
  "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-400 bg-white px-4 text-base font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60";

export default function AnexoPautaButton({
  pautaId,
  temAnexo,
}: {
  pautaId: number;
  temAnexo: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [pending, startTransition] = useTransition();

  async function aoEscolher(file: File) {
    setMsg(null);
    setEnviando(true);
    setProgresso(0);
    const r = await enviarAnexoPauta(pautaId, file, setProgresso);
    setEnviando(false);
    setMsg({ ok: r.ok, texto: r.message });
    if (r.ok) router.refresh();
  }

  function remover() {
    setMsg(null);
    startTransition(async () => {
      const r = await removerAnexo(pautaId);
      setConfirmando(false);
      setMsg({ ok: r.ok, texto: r.ok ? "Anexo removido." : (r.message ?? "Não foi possível remover.") });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ANEXO_ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher arquivo para anexar"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void aoEscolher(f);
          }}
        />
        <button type="button" disabled={enviando || pending} onClick={() => inputRef.current?.click()} className={btn}>
          {enviando ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Paperclip size={18} aria-hidden="true" />}
          {temAnexo ? "Trocar anexo" : "Anexar arquivo"}
        </button>

        {temAnexo && !confirmando && (
          <button type="button" disabled={enviando || pending} onClick={() => setConfirmando(true)} className={`${btn} text-red-800`}>
            <Trash2 size={18} aria-hidden="true" /> Remover anexo
          </button>
        )}
        {temAnexo && confirmando && (
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-medium text-zinc-900">Remover o anexo desta pauta?</span>
            <button type="button" disabled={pending} onClick={remover} className={`${btn} border-red-700 bg-red-700 text-white hover:bg-red-800`}>
              {pending && <Loader2 size={18} className="animate-spin" aria-hidden="true" />} Sim, remover
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirmando(false)} className={btn}>
              Cancelar
            </button>
          </span>
        )}
      </div>
      {enviando && (
        <p role="status" aria-live="polite" className="text-base font-medium text-zinc-800">
          Enviando anexo… {progresso}%
        </p>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-base font-medium ${msg.ok ? "text-emerald-800" : "text-red-700"}`}>
          {msg.texto}
        </p>
      )}
    </div>
  );
}

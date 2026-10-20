"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Loader2, Plus, Save } from "lucide-react";
import { definirEpiconDaAgenda } from "./actions";

const EPICONS_PADRAO = ["Marina Thomaz", "Fernando Barbaresco", "Dayane Rossa", "Roberto Leimig"];

export default function EpiconAgendaSelector({ escalaId }: { escalaId: number }) {
  const [selecionado, setSelecionado] = useState(EPICONS_PADRAO[0]);
  const [outroNome, setOutroNome] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nome = outroNome.trim() || selecionado;

  function salvar() {
    setMessage(null);
    startTransition(async () => {
      const result = await definirEpiconDaAgenda(escalaId, nome);
      setMessage(result.message);
      if (result.ok) setOutroNome("");
    });
  }

  return (
    <section aria-label="Epicon definido pela agenda" className="w-full rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-violet-950"><CalendarCheck size={20} aria-hidden="true" /> Epicon pela agenda</h2>
          <p className="mt-1 text-sm text-violet-800">Não entra no sorteio. Confirme quem está previsto na agenda da DIP.</p>
        </div>
        <button type="button" onClick={salvar} disabled={pending || !nome} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
          Confirmar Epicon
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-violet-900">
          Nome previsto
          <select value={selecionado} onChange={(event) => { setSelecionado(event.target.value); setOutroNome(""); }} className="min-h-11 rounded-lg border border-violet-200 bg-white px-3 text-base text-zinc-900">
            {EPICONS_PADRAO.map((epicon) => <option key={epicon} value={epicon}>{epicon}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-violet-900">
          Outro Epicon no dia (opcional)
          <span className="relative">
            <Plus size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500" aria-hidden="true" />
            <input value={outroNome} onChange={(event) => setOutroNome(event.target.value)} placeholder="Digite o nome completo" className="min-h-11 w-full rounded-lg border border-violet-200 bg-white py-2 pl-9 pr-3 text-base text-zinc-900" />
          </span>
        </label>
      </div>
      {message && <p className="mt-2 text-sm text-violet-900" role="status">{message}</p>}
    </section>
  );
}

"use client";

import { useState } from "react";
import { ListFilter, Search, SearchX, X } from "lucide-react";
import type { PautaRow } from "../_lib/get-reunioes-data";
import PautaCard from "./pauta-card";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function PautasLista({ pautas, meuUserId, isCoordenador, atasDisponiveis }: {
  pautas: PautaRow[];
  meuUserId: string;
  isCoordenador: boolean;
  atasDisponiveis: Array<{ id: number; titulo: string; data_reuniao: string }>;
}) {
  const [busca, setBusca] = useState("");
  const [minhas, setMinhas] = useState(false);
  const [prioridade, setPrioridade] = useState("todas");
  const filtradas = pautas.filter((pauta) =>
    (!minhas || pauta.criadoPor === meuUserId) &&
    (prioridade === "todas" || pauta.prioridade === prioridade) &&
    normalize(`${pauta.titulo} ${pauta.autor} ${pauta.contexto ?? ""}`).includes(normalize(busca.trim()))
  );
  const filtrosAtivos = Boolean(busca || minhas || prioridade !== "todas");
  const limpar = () => { setBusca(""); setMinhas(false); setPrioridade("todas"); };
  const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
        <div className="relative min-w-0 basis-full sm:min-w-52 sm:flex-1 sm:basis-auto">
          <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input aria-label="Buscar pautas pendentes" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar assunto, autor ou contexto" className={`min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 ${focus}`} />
          {busca && <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className={`absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 ${focus}`}><X size={16} /></button>}
        </div>
        <select aria-label="Filtrar por prioridade" value={prioridade} onChange={(event) => setPrioridade(event.target.value)} className={`min-h-11 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:flex-none ${focus}`}>
          <option value="todas">Todas as prioridades</option><option value="alta">Prioridade alta</option><option value="media">Prioridade média</option><option value="baixa">Prioridade baixa</option>
        </select>
        <button type="button" aria-pressed={minhas} onClick={() => setMinhas(!minhas)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium ${minhas ? "border-[#2195B9] bg-[#2195B9]/10 text-[#28627B]" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"} ${focus}`}><ListFilter size={16} aria-hidden="true" /> Minhas pautas</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm text-slate-500">{filtradas.length} de {pautas.length} {pautas.length === 1 ? "pauta pendente" : "pautas pendentes"}</p>
        {filtrosAtivos && <button type="button" onClick={limpar} className={`min-h-10 rounded-lg px-2 text-sm font-medium text-[#28627B] hover:underline ${focus}`}>Limpar filtros</button>}
      </div>
      {filtradas.length ? <ol className="flex flex-col gap-4">
        {filtradas.map((pauta) => <PautaCard key={pauta.id} pauta={pauta} numero={pautas.indexOf(pauta) + 1} meuUserId={meuUserId} isCoordenador={isCoordenador} atasDisponiveis={atasDisponiveis} />)}
      </ol> : <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-center">
        <SearchX size={28} className="text-slate-400" aria-hidden="true" />
        <p className="font-medium text-slate-700">Nenhuma pauta com esses filtros</p>
        <p className="text-sm text-slate-500">Tente outro termo ou limpe os filtros para ver todos os assuntos.</p>
      </div>}
    </div>
  );
}

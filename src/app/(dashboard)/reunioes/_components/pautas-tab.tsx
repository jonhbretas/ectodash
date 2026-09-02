"use client";
import { useMemo, useState } from "react";
import { Search, Clock, CheckCheck, FileText } from "lucide-react";
import Link from "next/link";
import type { PautaRow } from "../_lib/get-reunioes-data";

type Props = { pautas: PautaRow[] };

function Drawer({ pauta, onClose }: { pauta: PautaRow | null; onClose: () => void }) {
  if (!pauta) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div role="document" onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl">
        <button onClick={onClose} className="self-end rounded-lg border border-zinc-300 px-3 py-1 text-sm">Fechar</button>
        <h3 className="text-xl font-semibold text-zinc-900">{pauta.titulo}</h3>
        <p className="text-sm text-zinc-600">por {pauta.autor} · {pauta.status} {pauta.standBy ? "· em espera" : ""}</p>
        {pauta.contexto && <p className="whitespace-pre-wrap text-base text-zinc-700">{pauta.contexto}</p>}
        {pauta.ataDiscutidaTitulo && <p className="text-sm text-zinc-500">Discutida em: {pauta.ataDiscutidaTitulo}</p>}
        {pauta.ataDiscutidaId && <Link href={`/reunioes/${pauta.ataDiscutidaId}`} className="text-sm font-medium text-[#2195B9] hover:underline">Ver ata</Link>}
      </div>
    </div>
  );
}

export default function PautasTab({ pautas }: Props) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState<"todos" | "pendente" | "discutida" | "espera">("todos");
  const [drawer, setDrawer] = useState<PautaRow | null>(null);

  const filtradas = useMemo(() => {
    return pautas.filter((p) => {
      const hitBusca = !busca || p.titulo.toLowerCase().includes(busca.toLowerCase()) || p.autor.toLowerCase().includes(busca.toLowerCase());
      if (!hitBusca) return false;
      if (status === "pendente") return p.status === "pendente" && !p.standBy;
      if (status === "espera") return p.standBy;
      if (status === "discutida") return p.status === "discutida";
      return true;
    });
  }, [pautas, busca, status]);

  const chip = (label: string, value: typeof status) => (
    <button onClick={() => setStatus(value)} className={`rounded-full px-3 py-1 text-sm font-medium ${status === value ? "bg-[#2195B9] text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título ou autor" className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-base text-zinc-900 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]" />
        </div>
        <div className="flex flex-wrap gap-2">
          {chip("Todos", "todos")}
          {chip("Na próxima", "pendente")}
          {chip("Em espera", "espera")}
          {chip("Discutidas", "discutida")}
        </div>
        <p className="text-sm text-zinc-600">{filtradas.length} {filtradas.length === 1 ? "pauta" : "pautas"} · Todas as pautas já solicitadas. Use a busca para encontrar um assunto.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-600">
            <tr>
              <th className="px-4 py-3">Assunto</th>
              <th className="px-4 py-3">Autor</th>
              <th className="px-4 py-3">Reunião</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900"><button type="button" onClick={() => setDrawer(p)} className="text-left font-medium text-zinc-900 hover:text-[#2195B9] hover:underline">{p.titulo}</button></td>
                <td className="px-4 py-3 text-zinc-600">{p.autor}</td>
                <td className="px-4 py-3 text-zinc-600">{p.ataDiscutidaTitulo ?? p.reuniaoSelecionadaTitulo ?? "—"}</td>
                <td className="px-4 py-3">
                  {p.standBy ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"><Clock size={12} /> em espera</span> : p.status === "discutida" ? <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600"><CheckCheck size={12} /> discutida</span> : <span className="inline-flex items-center gap-1 rounded-full bg-[#2195B9]/10 px-2 py-0.5 text-xs font-medium text-[#28627B]">na próxima</span>}
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">Nenhuma pauta encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Drawer pauta={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

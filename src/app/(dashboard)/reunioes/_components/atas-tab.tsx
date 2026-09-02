"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Users, MessageSquareText, Search, Sparkles } from "lucide-react";
import { countLines, monthKey, monthLabel } from "../_lib/format-data";
import type { AtaRow } from "../_lib/get-reunioes-data";

const WEEKDAY_ABBR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function groupByMonth(rows: AtaRow[]) {
  const m = new Map<string, AtaRow[]>();
  for (const r of rows) {
    const k = monthKey(r.data_reuniao);
    const b = m.get(k) ?? [];
    b.push(r);
    m.set(k, b);
  }
  return [...m.entries()].map(([key, items]) => ({ key, rows: items }));
}

export default function AtasTab({ atas }: { atas: AtaRow[] }) {
  const [busca, setBusca] = useState("");
  const [filtroMes, setFiltroMes] = useState<string>("todos");

  const mesesDisponiveis = useMemo(() => [...new Set(atas.map((a) => monthKey(a.data_reuniao)))], [atas]);

  const filtradas = useMemo(() => {
    return atas.filter((a) => {
      const hitBusca = !busca || a.titulo.toLowerCase().includes(busca.toLowerCase()) || (a.resumo ?? "").toLowerCase().includes(busca.toLowerCase());
      if (!hitBusca) return false;
      if (filtroMes !== "todos" && monthKey(a.data_reuniao) !== filtroMes) return false;
      return true;
    });
  }, [atas, busca, filtroMes]);

  const grupos = groupByMonth(filtradas);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no resumo ou título" className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-base text-zinc-900 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]" />
        </div>
        <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} className="rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900">
          <option value="todos">Todos os meses</option>
          {mesesDisponiveis.map((k) => (
            <option key={k} value={k}>
              {monthLabel(k)}
            </option>
          ))}
        </select>
        <Link href="/reunioes/nova" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-base font-medium text-zinc-900 hover:bg-zinc-50">
          Registrar ata
        </Link>
      </div>

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-12 text-center ring-1 ring-zinc-200/60">
          <FileText size={36} className="text-zinc-400" />
          <p className="text-base text-zinc-600">Nenhuma ata encontrada.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {grupos.map((g) => (
            <div key={g.key} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="h-6 w-1 rounded-full bg-zinc-200" />
                <h3 className="text-lg font-semibold text-zinc-700">{monthLabel(g.key)}</h3>
              </div>
              <div className="flex flex-col gap-3">
                {g.rows.map((ata) => {
                  const d = new Date(`${ata.data_reuniao}T00:00:00`);
                  const part = countLines(ata.participantes);
                  const delib = countLines(ata.deliberacoes);
                  return (
                    <article key={ata.id} className="flex items-stretch gap-3">
                      <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white px-2 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 sm:w-20">
                        <span className="text-xs font-medium uppercase text-zinc-600">{WEEKDAY_ABBR[d.getDay()]}</span>
                        <span className="text-2xl font-semibold text-zinc-900">{d.getDate()}</span>
                        <span className="text-xs font-medium text-zinc-600">{MONTH_ABBR[d.getMonth()]}</span>
                        {ata.horario && <span className="mt-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">{ata.horario.slice(0, 5).replace(":", "h")}</span>}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 sm:p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link href={`/reunioes/${ata.id}`} className="text-base font-semibold text-zinc-900 hover:text-[#2195B9]">
                            {ata.titulo}
                          </Link>
                          <span className="flex flex-wrap items-center gap-1.5">
                            {part > 0 && <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"><Users size={12} /> {part} participantes</span>}
                            {delib > 0 && <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"><MessageSquareText size={12} /> {delib} tarefas</span>}
                            {ata.dipCount > 0 && <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-800 ring-1 ring-purple-200/60">{ata.dipCount} DIPs</span>}
                          </span>
                        </div>
                        {ata.resumo ? <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600">{ata.resumo}</p> : <p className="text-sm text-zinc-500">Sem resumo registrado.</p>}
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Link href={`/reunioes/${ata.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2195B9] underline decoration-[#2195B9]/40 underline-offset-4">
                            <FileText size={14} /> Ver ata completa
                          </Link>
                          <Link href={`/reunioes/analisar?ata=${ata.id}`} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                            <Sparkles size={12} /> Analisar por IA
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

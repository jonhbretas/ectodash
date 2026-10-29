"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, LockKeyhole, RefreshCw } from "lucide-react";

type Key = "extratos" | "recebimentos" | "conciliacao" | "cartao" | "notas" | "pagamentos";
type Item = { key: Key; label: string; help: string };
type Checklist = Record<Key, boolean>;
export default function PeriodClosePanel({ competencia, checklist: initial, fechado, closedAt, imports, openExceptions, checklistItems }: { competencia: string; checklist: Checklist; fechado: boolean; closedAt: string | null; imports: number; openExceptions: number; checklistItems: readonly Item[] }) {
  const [checklist, setChecklist] = useState(initial); const [pending, setPending] = useState(false); const [message, setMessage] = useState(""); const router = useRouter();
  const complete = Object.values(checklist).every(Boolean);
  async function send(action: "checklist" | "close") {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/financeiro/period", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competencia, action, ...(action === "checklist" ? { checklist } : {}) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível concluir a etapa.");
      setMessage(action === "close" ? "Mês fechado e registrado no histórico." : "Checklist salvo."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar."); }
    finally { setPending(false); }
  }
  return <section className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800"><CheckCircle2 size={20}/></span><div><h2 className="text-lg font-semibold text-zinc-900">Checklist de completude</h2><p className="text-sm text-zinc-600">Marque cada grupo somente depois de conferir que os documentos necessários foram enviados.</p></div></div>
    <div className="grid gap-3 md:grid-cols-2">{checklistItems.map((item) => <div key={item.key} className={`flex gap-3 rounded-xl border p-4 ${checklist[item.key] ? "border-emerald-200 bg-emerald-50/50" : "border-zinc-200"}`}><input id={`check-${item.key}`} type="checkbox" checked={checklist[item.key]} disabled={fechado || pending} onChange={(event) => setChecklist((current) => ({ ...current, [item.key]: event.target.checked }))} className="mt-1 size-4 accent-cyan-800"/><span><label htmlFor={`check-${item.key}`} className="block cursor-pointer font-semibold text-zinc-900">{item.label}</label><span className="text-sm text-zinc-600">{item.help}</span></span></div>)}</div>
    {!fechado ? <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={pending} onClick={() => send("checklist")} className="min-h-10 rounded-lg border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 disabled:opacity-60">Salvar checklist</button><button type="button" disabled={pending || !complete || imports === 0 || openExceptions > 0} onClick={() => send("close")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-800 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{pending ? <RefreshCw size={16} className="animate-spin"/> : <LockKeyhole size={16}/>} Fechar mês</button><span className="text-xs text-zinc-500">Requer checklist completo, arquivos importados e nenhuma pendência aberta.</span></div> : <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900">Fechado em {closedAt ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(new Date(closedAt)) : "data registrada"}. O período está bloqueado.</p>}
    {message && <p role="status" className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-950">{message}</p>}</section>;
}

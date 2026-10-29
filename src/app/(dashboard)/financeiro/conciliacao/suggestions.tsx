"use client";
import { useState } from "react";
import { Check, RefreshCw } from "lucide-react";

export type SuggestedMatch = { billedId: string; receivedId: string; provider: string; amount: number; billedDate: string; receivedDate: string; billedDescription: string; receivedDescription: string; dayDistance: number };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

export default function ReconciliationSuggestions({ suggestions }: { suggestions: SuggestedMatch[] }) {
  const [rows, setRows] = useState(suggestions); const [busy, setBusy] = useState<string | null>(null); const [message, setMessage] = useState("");
  async function confirm(row: SuggestedMatch) {
    setBusy(row.billedId); setMessage("");
    try {
      const response = await fetch("/api/financeiro/reconciliation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billedId: row.billedId, receivedId: row.receivedId }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Não foi possível conciliar este par.");
      setRows((current) => current.filter((item) => item.billedId !== row.billedId && item.receivedId !== row.receivedId)); setMessage("Conciliação registrada e auditada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao conciliar."); }
    finally { setBusy(null); }
  }
  return <section className="flex w-full flex-col gap-3"><div><h2 className="text-xl font-semibold text-zinc-900">Sugestões para conferência</h2><p className="text-sm text-zinc-500">O sistema não confirma nenhuma correspondência sem sua ação.</p></div>{message && <p role="status" className="rounded-lg bg-cyan-50 p-3 text-sm text-cyan-950">{message}</p>}{rows.length ? rows.map((row) => <article key={row.billedId} className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 md:grid-cols-[1fr_auto_1fr_auto] md:items-center"><div><p className="text-xs font-semibold uppercase text-cyan-800">{row.provider} · venda em {date(row.billedDate)}</p><p className="mt-1 font-medium text-zinc-900">{row.billedDescription}</p><p className="text-sm text-zinc-500">Líquido esperado: {money.format(row.amount)}</p></div><span aria-hidden="true" className="text-zinc-300">→</span><div><p className="text-xs font-semibold uppercase text-zinc-500">Crédito em {date(row.receivedDate)}</p><p className="mt-1 font-medium text-zinc-900">{row.receivedDescription}</p><p className="text-sm text-zinc-500">Mesmo valor · diferença de {row.dayDistance} dia(s)</p></div><button disabled={Boolean(busy)} onClick={() => confirm(row)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-800 px-4 text-sm font-semibold text-white disabled:opacity-60">{busy === row.billedId ? <RefreshCw size={16} className="animate-spin"/> : <Check size={16}/>} Confirmar</button></article>) : <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-5 py-10 text-center"><Check size={26} className="mx-auto text-zinc-400"/><p className="mt-2 font-medium text-zinc-800">Nenhuma correspondência única por valor e data</p><p className="mt-1 text-sm text-zinc-500">Isso pode indicar valor agregado, parcela, taxa, estorno ou ausência de dados da plataforma. Confira extratos e relatórios na revisão manual.</p></div>}</section>;
}

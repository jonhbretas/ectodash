"use client";
import { useState } from "react";

type Row = { id: string | null; exceptionId: string; problem: string; recommendation: string | null; movement_date: string; original_description: string; net_amount: number; drive_url: string | null; manual: boolean; type: string; resolveOnly?: boolean };
export default function ReviewList({ rows }: { rows: Row[] }) {
  const [items, setItems] = useState(rows); const [message, setMessage] = useState("");
  async function acknowledge(row: Row) {
    const response = await fetch("/api/financeiro/review", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exceptionId: row.exceptionId, resolveOnly: true }) });
    const result = await response.json(); if (!response.ok) { setMessage(result.error || "Falha ao salvar."); return; }
    setItems((current) => current.filter((item) => item.exceptionId !== row.exceptionId)); setMessage("Período conferido e registrado no histórico.");
  }
  async function save(form: FormData, row: Row) {
    const response = await fetch("/api/financeiro/review", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exceptionId: row.exceptionId, ledgerId: row.id, date: form.get("date"), description: form.get("description"), amount: Number(String(form.get("amount")).replace(",", ".")), type: form.get("type") }) });
    const result = await response.json(); if (!response.ok) { setMessage(result.error || "Falha ao salvar."); return; }
    setItems((current) => current.filter((item) => item.exceptionId !== row.exceptionId)); setMessage("Correção salva e registrada no histórico.");
  }
  return <div className="flex flex-col gap-4">{message && <p role="status" className="text-sm text-cyan-800">{message}</p>}{items.map((row) => <article key={row.exceptionId} className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
    <h2 className="font-semibold text-zinc-900">{row.problem}</h2>{row.recommendation && <p className="mt-1 text-sm text-zinc-600">{row.recommendation}</p>}
    {row.drive_url && <a className="mt-2 inline-block text-sm text-cyan-700 underline" href={row.drive_url} target="_blank" rel="noreferrer">Abrir documento original no Drive</a>}
    {row.resolveOnly ? <button type="button" onClick={() => acknowledge(row)} className="mt-4 min-h-10 rounded bg-cyan-700 px-4 font-medium text-white">Confirmar competência após conferir o documento</button> : <form action={(form) => save(form, row)} className="mt-4 grid gap-3 sm:grid-cols-4"><label className="text-sm">Data<input name="date" type="date" required defaultValue={row.movement_date} className="mt-1 min-h-10 w-full rounded border px-2" /></label><label className="text-sm">Descrição<input name="description" required defaultValue={row.original_description} className="mt-1 min-h-10 w-full rounded border px-2" /></label><label className="text-sm">Tipo<select name="type" defaultValue={row.type} className="mt-1 min-h-10 w-full rounded border px-2"><option value="RECEITA_RECEBIDA">Receita recebida</option><option value="RECEITA_FATURADA">Receita faturada</option><option value="DESPESA">Despesa</option><option value="TRANSFERENCIA_INTERNA">Transferência interna</option><option value="APLICACAO">Aplicação</option><option value="RESGATE">Resgate</option><option value="TARIFA">Tarifa</option><option value="ESTORNO">Estorno</option><option value="AJUSTE">Ajuste</option></select></label><label className="text-sm">Valor (R$)<input name="amount" type="number" step="0.01" min="0" required defaultValue={Number(row.net_amount).toFixed(2)} className="mt-1 min-h-10 w-full rounded border px-2" /></label><button className="min-h-10 rounded bg-cyan-700 px-4 font-medium text-white sm:col-span-4 sm:justify-self-start">Salvar conferência</button></form>}
  </article>)}{!items.length && <p className="rounded-xl bg-white p-6 text-zinc-600">Nenhum lançamento pendente de conferência.</p>}</div>;
}

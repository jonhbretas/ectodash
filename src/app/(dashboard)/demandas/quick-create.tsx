"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { criarTarefaCoordenacao, type QuickCreateInput, type QuickCreateResult } from "./quick-create-actions";

export type QuickCreateDefaults = Pick<QuickCreateInput, "area" | "projeto">;

export default function QuickCreate({ status = "pendente", prazo, area, projeto, compact = false, dialog = compact }: {
  status?: QuickCreateInput["status"];
  prazo?: string;
  compact?: boolean;
  dialog?: boolean;
} & QuickCreateDefaults) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [result, setResult] = useState<QuickCreateResult | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open && !dialog) inputRef.current?.focus(); }, [open, dialog]);

  function save(mesclarId?: number) {
    if (busy.current || !titulo.trim()) return;
    busy.current = true;
    startTransition(async () => {
      try {
        const response = await criarTarefaCoordenacao({ titulo, status, prazo, area, projeto, mesclarId });
        setResult(response);
        if (response.ok) {
          setTitulo("");
          if (dialog) setOpen(false);
          inputRef.current?.focus();
        }
      } catch {
        setResult({ ok: false, message: "Não foi possível salvar. Tente novamente." });
      } finally { busy.current = false; }
    });
  }

  const editor = (
        <form onSubmit={(event) => { event.preventDefault(); save(); }} className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-white p-2 shadow-sm">
          <input ref={inputRef} aria-label="Nome da tarefa" placeholder="Nome da tarefa…" maxLength={500}
            value={titulo} disabled={pending} onChange={(event) => { setTitulo(event.target.value); setResult(null); }}
            onKeyDown={(event) => { if (event.key === "Escape" && !pending) { setOpen(false); setTitulo(""); setResult(null); } }}
            className="min-h-10 w-full min-w-0 rounded-lg border border-zinc-300 px-2 text-base focus:outline-2 focus:outline-violet-500" />
          <div className="flex flex-wrap gap-1">
            <button disabled={pending || !titulo.trim()} className="min-h-9 rounded-lg bg-violet-700 px-3 text-sm font-medium text-white disabled:opacity-50">{pending ? "Salvando…" : "Adicionar"}</button>
            <button type="button" aria-label="Cancelar criação" disabled={pending} onClick={() => { setOpen(false); setTitulo(""); setResult(null); }} className="rounded-lg p-2 text-zinc-600"><X size={18} /></button>
          </div>
          {result && !result.ok && <p role="alert" className="text-sm text-red-700">{result.message}</p>}
          {result?.duplicates?.map((d) => <button type="button" disabled={pending} key={d.id} onClick={() => save(d.id)} className="rounded-lg border border-violet-300 p-2 text-left text-sm text-violet-900">Mesclar com “{d.titulo}” (#{d.id})</button>)}
        </form>
  );

  return (
    <div className={`min-w-0 w-full ${compact ? "flex flex-1 flex-col" : ""}`}>
      {dialog && <Dialog open={open} onOpenChange={(value) => { if (!pending) setOpen(value); }}><DialogContent><DialogTitle>Adicionar tarefa</DialogTitle><DialogDescription>{prazo ? `Prazo: ${prazo.split("-").reverse().join("/")}. ` : ""}Digite o nome. Os outros detalhes podem ficar para depois.</DialogDescription>{editor}</DialogContent></Dialog>}
      {open && !dialog ? editor : (
        <button type="button" onClick={() => { setOpen(true); setResult(null); }} aria-label={prazo ? `Adicionar tarefa em ${prazo}` : `Adicionar tarefa${status !== "pendente" ? `: ${status === "concluida" ? "Concluída" : "Em andamento"}` : ""}`}
          className={`flex w-full items-center gap-2 rounded-xl border border-dashed border-zinc-300 text-left text-zinc-500 transition-colors hover:border-violet-400 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-500 ${compact ? "min-h-9 flex-1 p-1 text-xs" : "min-h-14 p-3 text-base"}`}>
          <Plus size={compact ? 14 : 18} className="shrink-0" /><span className={compact ? "hidden sm:inline" : ""}>Adicionar tarefa</span>
        </button>
      )}
      {result?.ok && <p role="status" className="mt-2 text-sm text-violet-900">{result.message} <Link className="font-medium underline" href={`/demandas/${result.id}/editar`}>Abrir detalhes</Link></p>}
    </div>
  );
}

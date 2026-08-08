"use client";

import { useState } from "react";
import { RefreshCw, UploadCloud } from "lucide-react";

export default function FinancialAutomationPanel() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(form: FormData) {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/financeiro/import", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha na importação");
      const processed = result.results.filter((item: { status: string }) => item.status === "PROCESSED").length;
      const duplicates = result.results.filter((item: { status: string }) => item.status === "DUPLICATE").length;
      setMessage(`${processed} arquivo(s) processado(s). ${duplicates ? `${duplicates} duplicado(s) ignorado(s).` : ""}`);
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha na importação"); }
    finally { setPending(false); }
  }
  return <section className="flex w-full flex-col gap-3 rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
    <div className="flex items-center gap-3"><UploadCloud size={24} /><div><h2 className="text-xl font-semibold">Livro financeiro automatizado</h2><p className="text-sm text-slate-300">Arquivos preservados, classificados e rastreáveis até a linha original.</p></div></div>
    <form action={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input name="files" type="file" multiple accept=".csv,.xlsx,.xls,.ofx,.pdf" required className="min-h-12 flex-1 rounded-lg bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-700 file:px-3 file:py-2 file:font-medium file:text-white" />
      <button disabled={pending} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 font-medium hover:bg-cyan-500 disabled:opacity-60">{pending ? <RefreshCw className="animate-spin" size={18} /> : <UploadCloud size={18} />} {pending ? "Processando" : "Importar arquivos"}</button>
    </form>
    {message && <p aria-live="polite" className="text-sm text-cyan-100">{message}</p>}
  </section>;
}

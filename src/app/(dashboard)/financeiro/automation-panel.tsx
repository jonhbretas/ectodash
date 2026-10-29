"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, UploadCloud } from "lucide-react";

export default function FinancialAutomationPanel() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(form: FormData) {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/financeiro/import", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha na importação");
      const processed = result.results.filter((item: { status: string }) => item.status === "PROCESSED" || item.status === "PARTIAL").length;
      const duplicates = result.results.filter((item: { status: string }) => item.status === "DUPLICATE").length;
      const review = result.results.reduce((total: number, item: { uncertain?: number; warnings?: string[] }) => total + (item.uncertain ?? 0) + (item.warnings?.length ?? 0), 0);
      setMessage(`${processed} arquivo(s) arquivado(s) e processado(s). ${review ? `${review} item(ns) aguardam conferência em Financeiro > Conferência.` : ""} ${duplicates ? `${duplicates} duplicado(s) ignorado(s).` : ""}`);
      window.location.reload();
    } catch { setMessage("Falha na importação. Verifique o arquivo e tente novamente."); }
    finally { setPending(false); }
  }
  return <section className="flex w-full flex-col gap-3 rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      aria-expanded={open}
      aria-controls="livro-financeiro-automatizado"
      className="flex w-full items-center gap-3 text-left"
    >
      <UploadCloud size={24} aria-hidden="true" className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="text-xl font-semibold">Livro financeiro automatizado</h2>
        <p className="text-sm text-slate-300">Arquivos preservados, classificados e rastreáveis até a linha original.</p>
      </div>
      {open ? <ChevronUp size={20} aria-hidden="true" className="shrink-0" /> : <ChevronDown size={20} aria-hidden="true" className="shrink-0" />}
    </button>
    {open && (
      <div id="livro-financeiro-automatizado" className="flex flex-col gap-3">
        <form action={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-200">Competência
              <input name="competencia" type="month" defaultValue={new Date().toISOString().slice(0, 7)} required className="min-h-11 rounded-lg bg-white px-3 text-slate-900" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-200">Tipo de documento
              <select name="categoria" defaultValue="extrato" className="min-h-11 rounded-lg bg-white px-3 text-slate-900">
                <option value="nota_fiscal">Notas fiscais</option><option value="extrato">Extratos bancários</option><option value="recebimentos">Recebimentos e plataformas</option><option value="cartao">Cartões e faturas</option><option value="pagamentos">Pagamentos e comprovantes</option><option value="outros">Outros</option>
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input name="files" type="file" multiple accept=".csv,.xlsx,.xls,.ofx,.pdf" required className="min-h-12 flex-1 rounded-lg bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-700 file:px-3 file:py-2 file:font-medium file:text-white" />
          <button disabled={pending} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 font-medium hover:bg-cyan-500 disabled:opacity-60">{pending ? <RefreshCw className="animate-spin" size={18} /> : <UploadCloud size={18} />} {pending ? "Processando" : "Importar arquivos"}</button>
          </div>
        </form>
        <p className="text-xs text-slate-300">Os originais são arquivados na pasta financeira do mês escolhido. Documentos não legíveis e lançamentos incertos aparecem para conferência humana.</p>
        {message && <p aria-live="polite" className="text-sm text-cyan-100">{message}</p>}
      </div>
    )}
  </section>;
}

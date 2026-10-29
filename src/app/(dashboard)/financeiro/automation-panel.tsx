"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, CheckCircle2, ClipboardCheck, RefreshCw, ScanSearch, UploadCloud } from "lucide-react";

type ImportResult = { file?: string; status: string; uncertain?: number; warnings?: string[]; error?: string };

export default function FinancialAutomationPanel() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [stage, setStage] = useState(1);
  async function submit(form: FormData) {
    setPending(true); setMessage(""); setStage(2);
    try {
      const response = await fetch("/api/financeiro/import", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha no envio");
      const results = result.results as ImportResult[];
      const processed = results.filter((item) => item.status === "PROCESSED" || item.status === "PARTIAL").length;
      const errors = results.filter((item) => item.status === "FAILED").length;
      const review = results.some((item) => (item.uncertain ?? 0) > 0 || (item.warnings?.length ?? 0) > 0);
      setHasReview(review);
      setStage(errors ? 1 : review ? 3 : 4);
      const errorDetails = results.filter((item) => item.status === "FAILED").map((item) => `${item.file ?? "Arquivo"}: ${item.error ?? "falha no processamento"}`).join(" · ");
      setMessage(`${processed} arquivo(s) enviados e lidos. ${errors ? `${errors} arquivo(s) tiveram erro: ${errorDetails}.` : ""}${review ? " Há itens para conferir manualmente." : errors ? " Corrija os erros e tente novamente." : " Os dados estão disponíveis para análise."}`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha no envio. Verifique os arquivos e tente novamente."); }
    finally { setPending(false); }
  }

  const steps = ["Enviar arquivos", "Validar leitura", "Conferir pendências", "Analisar"];
  return <section className="flex w-full flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
    <ol aria-label="Etapas do processo" className="grid w-full gap-2 sm:grid-cols-2 xl:grid-cols-4">{steps.map((label, index) => { const number = index + 1; const complete = stage > number; const active = stage === number; return <li key={label} aria-current={active ? "step" : undefined} className={`flex items-center gap-2 rounded-lg border p-3 ${active ? "border-cyan-300 bg-cyan-50" : "border-zinc-200 bg-white"}`}><span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${complete ? "bg-emerald-100 text-emerald-800" : active ? "bg-cyan-800 text-white" : "bg-zinc-100 text-zinc-400"}`}>{complete ? <Check size={15}/> : index === 0 ? <UploadCloud size={15}/> : index === 1 ? <ScanSearch size={15}/> : index === 2 ? <ClipboardCheck size={15}/> : <CheckCircle2 size={15}/>}</span><span className={`text-xs font-semibold ${active ? "text-cyan-950" : "text-zinc-700"}`}>{label}</span></li>; })}</ol>
    <div><h2 className="text-lg font-semibold text-zinc-900">{stage === 1 ? "Etapa 1 · Envie os documentos" : stage === 2 ? "Etapa 2 · Validando a leitura" : stage === 3 ? "Etapa 3 · Confira as pendências" : "Etapa 4 · Dados disponíveis para análise"}</h2><p className="mt-1 text-sm text-zinc-600">Selecione a competência, indique o tipo e escolha os arquivos. O original fica arquivado no Drive.</p></div>
    <form action={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">Competência
          <input name="competencia" type="month" defaultValue={new Date().toISOString().slice(0, 7)} required className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-100" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">Tipo de documento
          <select name="categoria" defaultValue="extrato" className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 focus:border-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-100">
            <option value="nota_fiscal">Notas fiscais</option><option value="extrato">Extratos bancários</option><option value="recebimentos">Recebimentos e plataformas</option><option value="cartao">Cartões e faturas</option><option value="pagamentos">Pagamentos e comprovantes</option><option value="outros">Outros</option>
          </select>
        </label>
      </div>
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-5 text-center transition hover:border-cyan-500 hover:bg-cyan-50/50">
        <UploadCloud size={26} className="text-cyan-800"/><span className="font-medium text-zinc-800">Escolha ou arraste os arquivos aqui</span><span className="text-xs text-zinc-500">OFX, PDF, CSV ou Excel · até 10 MB cada</span>
        <input name="files" type="file" multiple accept=".csv,.xlsx,.xls,.ofx,.pdf" required className="mt-1 max-w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-800 file:px-3 file:py-2 file:font-medium file:text-white" />
      </label>
      <button disabled={pending} className="flex min-h-12 items-center justify-center gap-2 self-start rounded-lg bg-cyan-800 px-5 font-semibold text-white transition hover:bg-cyan-900 disabled:opacity-60">{pending ? <RefreshCw className="animate-spin" size={18}/> : <UploadCloud size={18}/>} {pending ? "Enviando e lendo arquivos…" : "Enviar e validar arquivos"}</button>
    </form>
    {message && <div aria-live="polite" className="flex flex-col gap-3 rounded-lg bg-cyan-50 p-4 text-sm text-cyan-950"><p className="flex items-start gap-2"><CheckCircle2 size={18} className="mt-0.5 shrink-0"/>{message}</p><div className="flex flex-wrap gap-3">{hasReview && <Link href="/financeiro/conferencia" className="inline-flex items-center gap-1 font-semibold underline">Ir para conferência <ArrowRight size={15}/></Link>}<Link href="/financeiro/analise" className="inline-flex items-center gap-1 font-semibold underline">Ver análise <ArrowRight size={15}/></Link></div></div>}
    <p className="text-xs leading-relaxed text-zinc-500">A leitura automática não substitui a conferência contábil. Datas, valores ou classificações incertas ficam sinalizados para revisão humana.</p>
  </section>;
}

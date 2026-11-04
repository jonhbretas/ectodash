"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRightLeft, CheckCircle2, FileSearch, LoaderCircle, LockKeyhole, Sparkles, UploadCloud } from "lucide-react";
import type { FinancialException, FinancialImport, Metrics, MonthlyAIReport } from "@/lib/financeiro/ai-report";
import type { DuplicateCandidate } from "@/lib/financeiro/duplicates";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
type Saved = { id: string; report: MonthlyAIReport };
type Props = { month: string; currentYear: number; configured: boolean; initialReport: Saved | null; closed: boolean; exceptions: FinancialException[]; imports: FinancialImport[] };
type FileResult = { file: string; status: string; rows?: number; error?: string; warnings?: string[]; information?: string[]; alerts?: string[]; duplicates?: number; suggestedCompetencia?: string | null };

async function post(body: Record<string, unknown>) {
  const response = await fetch("/api/financeiro/ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Não foi possível concluir esta ação.");
  return result;
}

export default function FinanceAIPanel(props: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState<Saved | null>(props.initialReport);
  const [closed, setClosed] = useState(props.closed);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<FileResult[]>([]);
  const [complete, setComplete] = useState(false);
  const running = useRef(false);

  async function run(task: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setMessage("");
    try { await task(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha de conexão. Confira os resultados antes de reenviar."); }
    finally { running.current = false; setBusy(""); router.refresh(); }
  }
  async function analyze() {
    setBusy("Conciliando recebimentos e gerando a análise mensal e anual…");
    const result = await post({ action: "analyze", competencia: props.month });
    setSaved({ id: result.id, report: result.report }); setClosed(result.closed); setComplete(false);
    setMessage(result.report.blockers.length ? "Análise concluída. Resolva as pendências indicadas antes de fechar o mês." : "Análise concluída. O mês está pronto para sua confirmação de fechamento.");
  }
  async function upload(form: FormData) {
    await run(async () => {
      const selected = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
      if (!selected.length) throw new Error("Escolha ao menos um documento do mês.");
      if (selected.some((file) => file.size > 3 * 1024 * 1024)) throw new Error("Cada arquivo deve ter até 3 MB. Divida PDFs maiores antes de enviar.");
      setSaved(null); setComplete(false); setFiles([]);
      const results: FileResult[] = [];
      for (const [index, file] of selected.entries()) {
        setBusy(`Lendo ${index + 1} de ${selected.length}: ${file.name}…`);
        const upload = new FormData(); upload.set("mode", "ia"); upload.set("competencia", props.month); upload.set("categoria", String(form.get("categoria") || "outros")); upload.set("files", file);
        const response = await fetch("/api/financeiro/import", { method: "POST", body: upload });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? `Falha ao enviar ${file.name}.`);
        results.push(...result.results); setFiles([...results]);
      }
      if (results.some((file) => file.status === "FAILED")) throw new Error("Alguns arquivos falharam. Confira os detalhes abaixo. Você pode gerar uma análise dos documentos disponíveis.");
      await analyze();
    });
  }
  async function merge(exceptionId: string, ledgerId: string) {
    await run(async () => {
      setBusy("Mesclando a origem com o lançamento existente…");
      await post({ action: "merge", competencia: props.month, exceptionId, ledgerId });
      setSaved(null); setComplete(false); setMessage("Origem mesclada ao lançamento existente, sem duplicar valores. Gere a análise novamente.");
    });
  }
  async function reprocess() {
    await run(async () => {
      const sources = props.imports.filter((item) => ["PARTIAL", "FAILED"].includes(item.status) && !item.metadata.ai_document);
      const results: FileResult[] = []; setFiles([]); setSaved(null); setComplete(false);
      for (const [index, source] of sources.entries()) {
        setBusy(`Relendo ${index + 1} de ${sources.length}: ${source.file_name}…`);
        const response = await fetch("/api/financeiro/ia/reprocess", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ importId: source.id }) });
        const result = await response.json();
        results.push(...(response.ok ? result.results : [{ file: source.file_name, status: "FAILED", error: result.error }])); setFiles([...results]);
      }
      if (results.some((item) => item.status === "FAILED")) throw new Error("Alguns arquivos não puderam ser relidos. Confira os detalhes e analise os dados disponíveis.");
      await analyze();
    });
  }
  async function close() {
    if (!saved) return;
    await run(async () => {
      setBusy("Validando os dados e registrando o fechamento…");
      await post({ action: "close", competencia: props.month, reportId: saved.id, documentsComplete: complete });
      setClosed(true); setMessage("Mês fechado. O relatório e a aprovação ficaram registrados no sistema.");
    });
  }
  async function moveImport(importId: string, form: FormData) {
    await run(async () => {
      setBusy("Ajustando a competência do documento, sem duplicar os lançamentos…");
      const month = String(form.get("documentMonth"));
      await post({ action: "moveImport", competencia: month, importId });
      setSaved(null); setComplete(false);
      setMessage(`Documento vinculado à competência ${month}. Os valores e o original foram preservados.`);
    });
  }
  async function acknowledgeIssue(exceptionId: string, form: FormData) {
    await run(async () => {
      setBusy("Registrando a conferência sem criar novos movimentos…");
      await post({ action: "acknowledgeIssue", competencia: props.month, exceptionId, reason: String(form.get("reason") ?? "") });
      setSaved(null); setComplete(false); setMessage("Conferência registrada no histórico. Nenhum lançamento foi criado. Gere a análise novamente.");
    });
  }
  async function reviewNote(importId: string, form: FormData) {
    await run(async () => {
      setBusy("Salvando a conferência documental…");
      const value = (key: string) => String(form.get(key) ?? "").trim();
      await post({ action: "reviewNote", competencia: props.month, importId, documentsComplete: form.get("confirmed") === "on", note: {
        number: value("number"), issuer: value("issuer"), issuerDocument: value("issuerDocument"), issueDate: value("issueDate"), total: Number(value("total")),
        recipient: value("recipient") || null, recipientDocument: value("recipientDocument") || null, accessKey: value("accessKey") || null,
      } });
      setSaved(null); setComplete(false); setMessage("Nota conferida e salva. Gere novamente a análise para atualizar o fechamento.");
    });
  }

  const duplicates = props.exceptions.flatMap((exception) => (exception.alternatives ?? []).flatMap((value) => {
    const candidate = value as DuplicateCandidate;
    return candidate?.kind === "POSSIBLE_DUPLICATE" && Array.isArray(candidate.candidates) ? [{ exceptionId: exception.id, ...candidate }] : [];
  }));
  const report = saved?.report;

  return <div className="flex w-full flex-col gap-5">
    <section className="flex flex-col gap-4 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-5 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="font-semibold text-cyan-950">Um mês por vez, com visão do ano</h2><p className="mt-1 max-w-xl text-sm text-zinc-600">O fechamento usa a competência selecionada. A análise anual considera os registros disponíveis de {props.currentYear}.</p></div>
      <form action="/financeiro/ia" className="flex flex-wrap items-end gap-2"><label className="text-sm font-medium">Competência<input name="mes" type="month" defaultValue={props.month} required className="mt-1 block min-h-11 rounded-lg border border-zinc-300 bg-white px-3" /></label><button disabled={Boolean(busy)} className="min-h-11 rounded-lg bg-cyan-900 px-4 text-sm font-semibold text-white disabled:opacity-50">Abrir mês</button></form>
    </section>
    <ol aria-label="Etapas do Financeiro com IA" className="grid gap-3 sm:grid-cols-3">{[{ label: "1. Ler os documentos", Icon: FileSearch, text: "Extratos, notas e comprovantes, incluindo PDFs digitalizados e imagens." }, { label: "2. Conferir e conciliar", Icon: ArrowRightLeft, text: "Cruzar notas e pagamentos, identificar duplicatas e conciliar pares únicos." }, { label: "3. Fechar e analisar", Icon: LockKeyhole, text: "Relatório do mês e do ano, com pendências e confirmação do fechamento." }].map(({ label, Icon, text }) => <li key={label} className="rounded-xl border border-zinc-200 bg-white p-4"><Icon size={21} className="text-cyan-800" aria-hidden="true"/><h3 className="mt-3 font-semibold">{label}</h3><p className="mt-1 text-sm text-zinc-600">{text}</p></li>)}</ol>
    {!props.configured && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">A chave OpenAI precisa estar configurada no servidor para processar os documentos e gerar a análise. <Link href="/configuracoes" className="font-semibold underline">Abrir configurações</Link></p>}
    {closed ? <p role="status" className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 font-medium text-emerald-900"><CheckCircle2 size={20}/> Competência {props.month} fechada. Os registros estão protegidos contra alteração.</p> : <form action={upload} className="rounded-2xl border border-zinc-200 bg-white p-5">
      <fieldset disabled={Boolean(busy) || !props.configured} className="flex flex-col gap-4">
        <legend className="text-lg font-semibold">Envie os arquivos do mês</legend>
        <label className="text-sm font-medium">Tipo de documento<select name="categoria" defaultValue="outros" className="mt-1 block min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 sm:max-w-sm"><option value="outros">Identificar pelo conteúdo</option><option value="extrato">Extratos bancários</option><option value="recebimentos">Relatórios de plataformas</option><option value="nota_fiscal">Notas fiscais</option><option value="pagamentos">Comprovantes de pagamento</option><option value="cartao">Faturas</option></select></label>
        <label className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 p-5"><span className="flex items-center gap-2 font-medium"><UploadCloud size={22}/> Escolha os documentos</span><span className="text-sm text-zinc-600">PDF, XML de notas, JPG, PNG, WebP, CSV, XLSX ou OFX · até 3 MB por arquivo. Os arquivos são processados individualmente e os originais ficam no Drive.</span><input type="file" name="files" multiple required accept=".pdf,.xml,.jpg,.jpeg,.png,.webp,.csv,.xlsx,.ofx" className="max-w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-800 file:px-3 file:py-2 file:text-white" /></label>
        <p className="text-xs text-zinc-500">Os documentos serão enviados à OpenAI para leitura. Notas, comprovantes e faturas são cruzados com os movimentos; o total desses documentos não é somado novamente ao caixa.</p>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-lg bg-cyan-800 px-5 font-semibold text-white disabled:opacity-50"><Sparkles size={18}/> Ler arquivos e processar o mês</button>
      </fieldset>
    </form>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-zinc-600">{props.imports.length} documento(s) já enviados nesta competência.</p><button disabled={Boolean(busy) || !props.configured} onClick={() => run(analyze)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-cyan-300 bg-white px-4 text-sm font-semibold text-cyan-900 disabled:opacity-50"><Sparkles size={17}/>{closed ? "Atualizar análise dos dados" : "Conciliar e analisar os dados já enviados"}</button></div>
    {props.imports.length > 0 && <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Documentos arquivados e competências</h2><p className="mt-1 text-sm text-zinc-600">A data de envio pode ser diferente do mês dos movimentos. Ajuste a competência dos documentos de outubro que foram enviados em novembro. Observações documentais não exigem criar novos lançamentos.</p><div className="mt-3 divide-y">{props.imports.map((item) => {
      const open = props.exceptions.filter((exception) => exception.import_id === item.id).length;
      const position = item.metadata.ai_document?.kind === "POSICAO_INVESTIMENTO";
      const suggested = (position ? item.metadata.ai_document?.issueDate : item.period_start ?? item.metadata.ai_document?.issueDate)?.slice(0, 7) ?? props.month;
      const info = item.metadata.information ?? item.metadata.ai_document?.findings ?? [];
      return <details key={item.id} className="py-3"><summary className="cursor-pointer text-sm font-medium">{item.file_name} · {position ? "Posição de investimento, sem fluxo de caixa" : item.status === "FAILED" ? "Falha de processamento" : open ? `${open} pendência(s)` : "Leitura concluída"}</summary><div className="mt-3 flex flex-col gap-2 text-sm">{item.metadata.drive_url && <a href={item.metadata.drive_url} target="_blank" rel="noreferrer" className="text-cyan-800 underline">Abrir original no Drive</a>}{item.period_start && !position && <p className="text-zinc-600">Movimentos de {item.period_start} até {item.period_end ?? item.period_start}.</p>}{position && item.metadata.ai_document?.total != null && <p className="text-zinc-600">Posição informada: {money.format(item.metadata.ai_document.total)}. Esse valor não é uma entrada ou saída do mês.</p>}{info.length > 0 && <AnalysisList title="Informações do documento" items={info}/>}<AnalysisList title="Alertas" items={item.metadata.alerts ?? []}/>{!closed && <form action={(form) => moveImport(item.id, form)} className="mt-2 flex flex-wrap items-end gap-2"><label className="text-sm">Competência do documento<input type="month" name="documentMonth" defaultValue={/^\d{4}-(0[1-9]|1[0-2])$/.test(suggested) ? suggested : props.month} required disabled={Boolean(busy)} className="mt-1 block min-h-10 rounded-lg border px-3"/></label><button disabled={Boolean(busy)} className="min-h-10 rounded-lg border border-cyan-300 px-3 font-semibold text-cyan-900">Ajustar competência</button></form>}</div></details>;
    })}</div></section>}
    {!closed && props.imports.some((item) => ["PARTIAL", "FAILED"].includes(item.status) && !item.metadata.ai_document) && <div className="flex flex-col gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-sm text-cyan-950">Há arquivos anteriores sem leitura pela IA. Você pode recuperar os originais do Drive e reler os que ainda não possuem lançamentos ou conferências, sem enviar cópias.</p><button disabled={Boolean(busy) || !props.configured} onClick={reprocess} className="min-h-11 shrink-0 rounded-lg bg-cyan-800 px-4 text-sm font-semibold text-white disabled:opacity-50">Reler arquivos arquivados com IA</button></div>}
    {busy && <p role="status" className="flex items-center gap-2 rounded-xl bg-cyan-50 p-4 text-sm text-cyan-950"><LoaderCircle className="shrink-0 animate-spin" size={19}/>{busy}</p>}
    {message && <p role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950">{message}</p>}
    {files.length > 0 && <ul className="divide-y rounded-xl border bg-white">{files.map((file, index) => <li key={`${file.file}:${index}`} className="p-4 text-sm"><p className="font-semibold">{file.file} · {file.status === "DUPLICATE" ? "Arquivo já registrado" : file.status === "PROCESSED" ? "Processado" : file.status === "PARTIAL" ? "Requer conferência" : "Falha"}</p><p className="mt-1 text-zinc-600">{file.error ?? (file.status === "DUPLICATE" ? "Este arquivo já foi lido antes; os lançamentos existentes foram mantidos, sem duplicar." : `${file.rows ?? 0} movimento(s) extraído(s).`)}</p>{file.information?.length ? <AnalysisList title="Informa??es do documento" items={file.information}/> : null}{file.alerts?.length ? <AnalysisList title="Alertas" items={file.alerts}/> : null}{file.suggestedCompetencia && file.suggestedCompetencia !== props.month && <p className="mt-2 text-amber-900">Os movimentos s?o de {file.suggestedCompetencia}. Ajuste a compet?ncia na lista de documentos arquivados.</p>}{file.warnings?.map((warning, i) => <p key={i} className="mt-1 text-amber-800">{warning}</p>)}</li>)}</ul>}
    {duplicates.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-lg font-semibold">Possíveis duplicatas — escolha a mesclagem</h2><p className="mt-1 text-sm text-zinc-600">Esses movimentos ficaram fora do caixa até a conferência. A mesclagem preserva o valor existente e registra o novo documento como origem.</p><div className="mt-4 flex flex-col gap-3">{duplicates.map((duplicate, index) => <article key={`${duplicate.exceptionId}:${index}`} className="rounded-lg bg-white p-4"><p className="font-medium">{duplicate.row.description} · {money.format(duplicate.row.net)} · {duplicate.row.date}</p><div className="mt-3 flex flex-wrap gap-2">{duplicate.candidates.map((candidate) => <button key={candidate.id} disabled={Boolean(busy) || closed} onClick={() => merge(duplicate.exceptionId, candidate.id)} className="min-h-10 rounded-lg border border-amber-300 px-3 text-sm font-semibold disabled:opacity-50">Mesclar com registro de {candidate.movement_date} · {candidate.id.slice(0, 8)}</button>)}</div></article>)}</div></section>}
    {!closed && props.exceptions.some((item) => !(item.ledger_ids?.length) && !(item.alternatives ?? []).some((value) => (value as { kind?: string })?.kind === "POSSIBLE_DUPLICATE")) && <section className="rounded-xl border border-amber-200 bg-white p-5"><h2 className="text-lg font-semibold">Conferência documental sem novo lançamento</h2><p className="mt-1 text-sm text-zinc-600">Se uma divergência já foi explicada por outro documento ou por um movimento existente, registre como conferiu. Não crie entradas ou saídas apenas para compensar totalizadores. Para mês incorreto, use Ajustar competência.</p>{props.exceptions.filter((item) => !(item.ledger_ids?.length) && !(item.alternatives ?? []).some((value) => (value as { kind?: string })?.kind === "POSSIBLE_DUPLICATE")).map((item) => <details key={item.id} className="mt-3 rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{item.problem}</summary><form action={(form) => acknowledgeIssue(item.id, form)} className="mt-3 flex flex-col gap-2"><label className="text-sm">Como esta pendência foi conferida?<textarea name="reason" required minLength={20} maxLength={3000} disabled={Boolean(busy)} className="mt-1 min-h-20 w-full rounded-lg border p-2"/></label><button disabled={Boolean(busy)} className="min-h-10 self-start rounded-lg border border-cyan-300 px-3 text-sm font-semibold text-cyan-900">Registrar conferência sem criar movimento</button></form></details>)}</section>}
    {!closed && props.imports.some((item) => item.metadata.ai_document?.kind === "NOTA_FISCAL") && <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Revisar dados extraídos das notas</h2><p className="mt-1 text-sm text-zinc-600">Complete campos ilegíveis ou corrija a extração após conferir o original. Isso não consulta a autenticidade fiscal.</p>{props.imports.filter((item) => item.metadata.ai_document?.kind === "NOTA_FISCAL").map((item) => { const note = item.metadata.ai_document!; return <details key={item.id} className="mt-3 rounded-lg border p-4"><summary className="cursor-pointer font-medium">{item.file_name} · nota {note.number ?? "sem número"}</summary><form action={(form) => reviewNote(item.id, form)} className="mt-4"><fieldset disabled={Boolean(busy)} className="grid gap-3 sm:grid-cols-2">{[{ name: "number", label: "Número da nota", value: note.number, required: true }, { name: "issuer", label: "Emitente", value: note.issuer, required: true }, { name: "issuerDocument", label: "CPF/CNPJ do emitente", value: note.issuerDocument, required: true }, { name: "issueDate", label: "Data de emissão", value: note.issueDate, type: "date", required: true }, { name: "total", label: "Total (R$)", value: note.total, type: "number", required: true }, { name: "recipient", label: "Destinatário", value: note.recipient }, { name: "recipientDocument", label: "CPF/CNPJ do destinatário", value: note.recipientDocument }, { name: "accessKey", label: "Chave de acesso (se houver)", value: note.accessKey }].map((field) => <label key={field.name} className="text-sm">{field.label}<input name={field.name} type={field.type ?? "text"} defaultValue={field.value ?? ""} required={field.required} step={field.type === "number" ? "0.01" : undefined} min={field.type === "number" ? 0 : undefined} className="mt-1 min-h-10 w-full rounded-lg border px-3" /></label>)}<label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="confirmed" required className="mt-1"/>Conferi os campos acima no documento original.</label><button className="min-h-10 justify-self-start rounded-lg bg-cyan-800 px-4 text-sm font-semibold text-white">Salvar dados conferidos</button></fieldset></form></details>; })}</section>}
    {report && <>
      <section className="rounded-2xl border border-zinc-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-cyan-800">Relatório salvo · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(report.generatedAt))}</p><h2 className="mt-1 text-2xl font-semibold">Fechamento de {report.competencia}</h2></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${closed ? "bg-emerald-50 text-emerald-900" : report.blockers.length ? "bg-amber-50 text-amber-900" : "bg-cyan-50 text-cyan-900"}`}>{closed ? "Fechado" : report.blockers.length ? "Com pendências" : "Pronto para confirmar"}</span></div><p className="mt-4 whitespace-pre-wrap text-zinc-700">{report.narrative.summary}</p><MetricsGrid metrics={report.monthly}/><AnalysisList title="Análise do mês" items={report.narrative.monthlyAnalysis}/><p className="mt-4 text-sm text-zinc-500">{report.reconciled} par(es) conciliado(s) nesta execução. Apenas correspondências únicas com valor, data e evidência da plataforma são efetivadas automaticamente.</p></section>
      {report.notes.length > 0 && <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Conferência de notas fiscais</h2><p className="mt-1 text-sm text-zinc-600">Compatibilidade documental e financeira. Autenticidade fiscal não consultada em órgãos oficiais.</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{report.notes.map((note) => <article key={note.importId} className="rounded-lg border p-4"><h3 className="font-semibold">{note.number ? `Nota ${note.number}` : note.file}</h3><p className="mt-1 text-sm">{note.issuer ?? "Emitente não identificado"} · {note.total === null ? "Total ilegível" : money.format(note.total)}</p><p className="mt-2 text-sm font-medium text-cyan-900">{({ PAGAMENTO_COMPATIVEL: "Pagamento compatível encontrado", SEM_PAGAMENTO_IDENTIFICADO: "Pagamento não identificado", PAGAMENTO_AMBIGUO: "Mais de um pagamento compatível", INCOMPLETA: "Dados incompletos", POSSIVEL_DUPLICATA: "Possível nota duplicada" })[note.status]}</p>{note.url && <a href={note.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-cyan-800 underline">Abrir documento original</a>}</article>)}</div></section>}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5"><h2 className="text-2xl font-semibold">Ano vigente · {report.analysisYear}</h2><p className="mt-1 text-sm text-zinc-600">{report.months.filter((month) => month.hasData).length} de 12 meses com dados. Os totais consideram somente o livro financeiro automatizado.</p><MetricsGrid metrics={report.annual}/><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm"><caption className="sr-only">Cobertura e resultado por mês do ano</caption><thead className="border-b text-zinc-500"><tr><th className="py-2 pr-4">Mês</th><th className="py-2 pr-4">Cobertura</th><th className="py-2 pr-4 text-right">Entradas operacionais</th><th className="py-2 pr-4 text-right">Saídas operacionais</th><th className="py-2 text-right">Resultado de caixa</th></tr></thead><tbody>{report.months.map((item) => <tr key={item.month} className="border-b last:border-0"><td className="py-2 pr-4">{item.month}</td><td className="py-2 pr-4">{item.hasData ? `${item.metrics.count} registros` : "Sem dados"}</td><td className="py-2 pr-4 text-right">{item.hasData ? money.format(item.metrics.operatingIn) : "—"}</td><td className="py-2 pr-4 text-right">{item.hasData ? money.format(item.metrics.operatingOut) : "—"}</td><td className="py-2 text-right">{item.hasData ? money.format(item.metrics.result) : "—"}</td></tr>)}</tbody></table></div><AnalysisList title="Leitura do ano" items={report.narrative.annualAnalysis}/></section>
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><AnalysisList title="Pendências para fechar" items={report.blockers}/>{!report.blockers.length && <p className="mt-2 text-sm text-emerald-900">Nenhum bloqueio identificado nos dados processados.</p>}<AnalysisList title="Limites e pontos de atenção" items={report.warnings}/><AnalysisList title="Próximas ações" items={report.narrative.recommendations}/><Link href="/financeiro/conferencia" className="mt-4 inline-block text-sm font-semibold text-cyan-900 underline">Abrir conferência humana</Link></section>
      {!closed && <section className="rounded-xl border border-zinc-200 bg-white p-5"><h2 className="text-xl font-semibold">Confirmar fechamento</h2><p className="mt-1 text-sm text-zinc-600">A IA não consegue saber se algum documento deixou de ser enviado. Confirme a completude; o sistema revalida as pendências e bloqueia o período após fechar.</p><label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={complete} onChange={(event) => setComplete(event.target.checked)} disabled={Boolean(busy)} className="mt-1 size-4"/><span>Enviei e conferi todos os extratos, recebimentos, notas, faturas e comprovantes aplicáveis a este mês, inclusive os itens sem movimentação.</span></label><button disabled={Boolean(busy) || !complete || report.blockers.length > 0} onClick={close} className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-lg bg-emerald-800 px-5 font-semibold text-white disabled:opacity-50"><LockKeyhole size={18}/> Confirmar e fechar {props.month}</button></section>}
    </>}
  </div>;
}

function MetricsGrid({ metrics }: { metrics: Metrics }) {
  return <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ label: "Entradas de caixa", value: metrics.cashIn }, { label: "Saídas de caixa", value: metrics.cashOut }, { label: "Resultado operacional de caixa", value: metrics.result }, { label: "A receber das plataformas", value: metrics.outstanding }].map(({ label, value }) => <div key={label} className="rounded-xl bg-zinc-50 p-3"><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 text-lg font-semibold text-zinc-900">{money.format(value)}</dd></div>)}</dl>;
}
function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return <div className="mt-4 first:mt-0"><h3 className="font-semibold text-zinc-900">{title}</h3>{items.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>}</div>;
}

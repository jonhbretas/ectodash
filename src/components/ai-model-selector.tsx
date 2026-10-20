"use client";

import { useActionState, useEffect, useState } from "react";
import { Cpu, RefreshCw, Save, ShieldCheck, Loader2 } from "lucide-react";
import { getAIStatus, setAIModel, testAIModel } from "@/lib/ai/ai-config-actions";

type Status = Awaited<ReturnType<typeof getAIStatus>>;
type TestResult = Awaited<ReturnType<typeof testAIModel>>;

export function AIModelSelector() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [selected, setSelected] = useState("");

  const [saveState, saveAction, saving] = useActionState(async (_: unknown, fd: FormData) => {
    const result = await setAIModel(fd);
    if (result.ok) {
      try {
        const next = await getAIStatus();
        setStatus(next);
        setSelected(next.modelo);
        setTest(null);
      } catch {
        return { ok: false, message: "Modelo salvo. Recarregue a página para atualizar a configuração exibida." };
      }
    }
    return result;
  }, null as { ok: boolean; message: string } | null);

  useEffect(() => {
    let active = true;
    getAIStatus().then((next) => {
      if (!active) return;
      setStatus(next);
      setSelected(next.modelo);
    }).catch((err: unknown) => {
      if (active) setLoadError(err instanceof Error ? err.message : "Não foi possível carregar a configuração de IA.");
    });
    return () => { active = false; };
  }, []);

  async function handleTest() {
    setTesting(true);
    try {
      setTest(await testAIModel(selected));
    } catch {
      setTest({ ok: false, latencyMs: 0, message: "Não foi possível testar a conexão. Tente novamente." });
    } finally {
      setTesting(false);
    }
  }

  if (loadError) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</p>;
  if (!status) return <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando configuração de IA...</div>;

  const connection = !status.keyConfigured ? "Chave pendente" : testing ? "Testando…" : test ? (test.ok ? "Conectada" : "Falha na conexão") : "Aguardando teste";
  const color = !status.keyConfigured || test?.ok === false ? "bg-amber-500" : test?.ok ? "bg-emerald-500" : "bg-slate-300";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2195B9]"><Cpu size={16} className="text-white" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Modelo de IA · OpenAI</h3>
          <p className="text-xs text-slate-500">{status.modelo}</p>
        </div>
        <button type="button" onClick={handleTest} disabled={testing || saving || !status.keyConfigured} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          {testing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Testar conexão
        </button>
      </header>
      <p role="status" className="flex items-center gap-2 text-xs text-slate-600"><span aria-hidden className={`h-2.5 w-2.5 rounded-full ${color}`} />{connection}</p>
      {!status.keyConfigured && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Configure OPENAI_API_KEY no servidor e reinicie a aplicação ou faça um novo deploy para ativar a IA.</p>}
      {test && <p role="status" className={`rounded-lg px-3 py-2 text-xs ${test.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{test.message}</p>}
      <form action={saveAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700">Modelo OpenAI</span>
          <select name="modelo" value={selected} onChange={(event) => { setSelected(event.target.value); setTest(null); }} disabled={!status.canEdit || saving || testing} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 disabled:opacity-60">
            {status.catalog.map((model) => <option key={model.id} value={model.id}>{model.label} — {model.desc}</option>)}
          </select>
        </label>
        {selected !== status.modelo && <p className="text-xs text-amber-700">Seleção ainda não salva. O teste usa o modelo selecionado.</p>}
        {!status.canEdit && <p className="flex items-center gap-1 text-xs text-amber-600"><ShieldCheck size={12} /> Apenas coordenador geral pode alterar o modelo.</p>}
        {status.canEdit && <button type="submit" disabled={saving || testing} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-4 text-sm font-medium text-white hover:bg-[#28627B] disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {saving ? "Salvando…" : "Salvar modelo"}</button>}
        {saveState && <p role="status" className={`text-xs ${saveState.ok ? "text-emerald-600" : "text-red-600"}`}>{saveState.message}</p>}
      </form>
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <p>Usa <code>OPENAI_API_KEY</code> configurada no .env.local ou nas variáveis de ambiente da Vercel.</p>
        <p>O consumo da API é cobrado pela OpenAI e pode ser consultado no painel da sua conta.</p>
        <a href="https://platform.openai.com/usage" target="_blank" rel="noreferrer" className="font-medium text-[#2195B9] hover:underline">Ver uso na OpenAI</a>
      </div>
    </div>
  );
}

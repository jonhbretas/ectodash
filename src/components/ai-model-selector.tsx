"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Cpu, Circle, RefreshCw, Save, ShieldCheck, Loader2 } from "lucide-react";
import { getAIStatus, getAIUsage, setAIModel, testAIModel, type AIUsage } from "@/lib/ai/ai-config-actions";

type Status = Awaited<ReturnType<typeof getAIStatus>>;

function Dot({ state }: { state: "ok" | "warn" | "error" | "idle" }) {
  const color =
    state === "ok" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : state === "warn" ? "bg-amber-500" : state === "error" ? "bg-red-500" : "bg-slate-300";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />;
}

function UsageBar({ label, percent, resetsAt }: { label: string; percent: number; resetsAt: string }) {
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  const reset = (() => {
    try {
      const d = new Date(resetsAt);
      const diff = d.getTime() - Date.now();
      if (diff <= 0) return "reiniciando";
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
      return `${h}h ${m}m`;
    } catch {
      return "";
    }
  })();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{pct}% · reseta em {reset}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function AIModelSelector() {
  const [status, setStatus] = useState<Status | null>(null);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [test, setTest] = useState<{ ok: boolean; latencyMs: number; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [pending, startTransition] = useTransition();

  const [saveState, saveAction] = useActionState(async (_: unknown, fd: FormData) => {
    const r = await setAIModel(fd);
    if (r.ok) {
      const s = await getAIStatus();
      setStatus(s);
      setSelected(s.modelo);
    }
    return r;
  }, null as unknown as { ok: boolean; message: string } | null);

  useEffect(() => {
    (async () => {
      const s = await getAIStatus();
      setStatus(s);
      setSelected(s.modelo);
      const u = await getAIUsage();
      if (u.ok && u.usage) setUsage(u.usage);
      else setUsageError(u.error ?? "Uso indisponível");
      const t = await testAIModel(s.modelo);
      setTest(t);
    })();
  }, []);

  async function handleTest() {
    if (!status) return;
    setTesting(true);
    const target = selected || status.modelo;
    const t = await testAIModel(target);
    setTest(t);
    setTesting(false);
  }

  async function refreshUsage() {
    startTransition(async () => {
      const u = await getAIUsage();
      if (u.ok && u.usage) {
        setUsage(u.usage);
        setUsageError(null);
      } else setUsageError(u.error ?? "Uso indisponível");
    });
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Carregando configuração de IA...
      </div>
    );
  }

  const dot: "ok" | "warn" | "error" | "idle" = !test ? "idle" : test.ok ? (test.latencyMs > 3000 ? "warn" : "ok") : "error";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#2195B9] to-[#28627B]">
          <Cpu size={16} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            Modelo de IA
            <Dot state={dot} />
            <span className={`text-xs font-normal ${dot === "ok" ? "text-emerald-600" : dot === "warn" ? "text-amber-600" : dot === "error" ? "text-red-600" : "text-slate-400"}`}>
              {dot === "idle" ? "verificando…" : dot === "ok" ? "online" : dot === "warn" ? "lento" : "offline"}
            </span>
          </h3>
          <p className="truncate text-xs text-slate-500">
            {status.modelo} <span className="text-slate-400">· {status.source === "db" ? "config do banco" : "variável de ambiente"} · {status.url.includes("/responses") ? "/responses" : status.url.includes("/messages") ? "/messages" : "/chat/completions"}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={testing}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Circle size={14} />}
          Testar
        </button>
      </header>

      {test && (
        <p className={`rounded-lg px-3 py-2 text-xs ${test.ok ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200"}`}>
          {test.message}
          {!test.ok && <span className="ml-2 text-red-500">Verifique OPENCODE_API_KEY e o modelo.</span>}
        </p>
      )}

      <form action={saveAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-700">Seletor de modelo</span>
          <select
            name="modelo"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!status.canEdit}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:bg-slate-50 disabled:text-slate-400"
          >
            {status.catalog.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.desc}
              </option>
            ))}
          </select>
          {!status.canEdit && <span className="flex items-center gap-1 text-xs text-amber-600"><ShieldCheck size={12} /> Apenas coordenador geral pode alterar.</span>}
        </label>

        {status.canEdit && (
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2195B9] to-[#28627B] px-4 text-sm font-medium text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)] hover:from-[#28627B] hover:to-[#28627B] disabled:opacity-60"
          >
            <Save size={16} /> Salvar modelo
          </button>
        )}
        {saveState && <p className={`text-xs ${saveState.ok ? "text-emerald-600" : "text-red-600"}`}>{saveState.message}</p>}
      </form>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-900">Nível de uso (Go)</h4>
          <button
            type="button"
            onClick={refreshUsage}
            disabled={pending}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={12} className={pending ? "animate-spin" : ""} /> Atualizar
          </button>
        </div>
        {usage ? (
          <div className="flex flex-col gap-3">
            <UsageBar label="Janela 5h" percent={usage.rolling.percent} resetsAt={usage.rolling.resetsAt} />
            <UsageBar label="Semanal" percent={usage.weekly.percent} resetsAt={usage.weekly.resetsAt} />
            <UsageBar label="Mensal" percent={usage.monthly.percent} resetsAt={usage.monthly.resetsAt} />
            <p className="text-xs text-slate-400">Fonte: GET /zen/go/v1/usage · Limites Go: $12/5h · $30/semana · $60/mês (varia por modelo)</p>
          </div>
        ) : (
          <p className="text-xs text-amber-600">{usageError ?? "Carregando uso..."}</p>
        )}
      </div>
    </div>
  );
}

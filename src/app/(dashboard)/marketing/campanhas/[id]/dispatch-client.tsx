"use client";

// Disparo fatiado: enfileira (snapshot) → dispara em lotes de 200 com
// barra de progresso. Cada chamada é curta p/ caber no timeout Vercel.
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCampaign,
  dispatchChunk,
  finalizeQueue,
  queueCampaignChunk,
  sendTestEmail,
  type ActionState,
} from "../../actions";

const testInitial: ActionState = { ok: false, message: "" };

export default function DispatchClient({
  campaignId,
  status,
  total,
  sentCount,
  failedCount,
  skippedCount,
}: {
  campaignId: number;
  status: string;
  total: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}) {
  const [testState, testAction, testPending] = useActionState(sendTestEmail, testInitial);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(status === "sent");
  const router = useRouter();

  const isDraft = status === "draft" || status === "queued";
  const isSending = status === "sending";

  async function handleDispatch() {
    setRunning(true);
    setError(null);
    try {
      // 1. Snapshot dos leads ativos
      let queued = 0;
      for (;;) {
        setPhase("Montando a fila de destinatários…");
        const q = await queueCampaignChunk(campaignId);
        if (!q.ok) throw new Error(q.message);
        queued += q.queued;
        setProgress({ done: queued, total: 0 });
        if (q.done) break;
      }
      const fin = await finalizeQueue(campaignId);
      if (!fin.ok) throw new Error(fin.message);
      const grandTotal = fin.total ?? 0;

      // 2. Disparo em lotes
      let sent = 0;
      for (;;) {
        setPhase("Disparando… (não feche esta aba)");
        const d = await dispatchChunk(campaignId);
        if (!d.ok) throw new Error(d.message);
        sent += d.sent;
        setProgress({ done: sent, total: grandTotal });
        if (d.done) break;
      }
      setPhase("");
      setFinished(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no disparo.");
      setPhase("");
    } finally {
      setRunning(false);
    }
  }

  async function handleResume() {
    setRunning(true);
    setError(null);
    try {
      let sent = sentCount;
      for (;;) {
        setPhase("Retomando disparo… (não feche esta aba)");
        const d = await dispatchChunk(campaignId);
        if (!d.ok) throw new Error(d.message);
        sent += d.sent;
        setProgress({ done: sent, total });
        if (d.done) break;
      }
      setPhase("");
      setFinished(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no disparo.");
      setPhase("");
    } finally {
      setRunning(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Excluir este rascunho?")) return;
    const r = await deleteCampaign(campaignId);
    if (r.ok) router.push("/marketing");
    else setError(r.message);
  }

  return (
    <div className="flex flex-col gap-6">
      {(isDraft || isSending) && !finished && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-xl font-semibold text-zinc-900">
            {isDraft ? "Disparar para a base" : "Disparo em andamento"}
          </h3>
          <p className="mt-1 text-base text-zinc-500">
            {isDraft
              ? "Congela os leads ativos do momento e envia em lotes. Quem se descadastrar no meio do caminho é pulado automaticamente."
              : "O disparo foi interrompido antes do fim. Retome de onde parou — ninguém recebe duplicado."}
          </p>
          <div className="mt-3">
            <button
              onClick={() => void (isDraft ? handleDispatch() : handleResume())}
              disabled={running}
              className="inline-flex h-12 items-center rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white disabled:opacity-50 hover:bg-[#1a7a98]"
            >
              {running ? "Trabalhando…" : isDraft ? "Enfileirar e disparar" : "Retomar disparo"}
            </button>
            {isDraft && (
              <button onClick={() => void handleDelete()} disabled={running} className="ml-3 inline-flex h-12 items-center rounded-xl border border-red-200 px-6 text-lg font-medium text-red-600 hover:bg-red-50">
                Excluir rascunho
              </button>
            )}
          </div>
          {phase && <p className="mt-3 text-lg text-zinc-600" role="status">{phase}</p>}
          {progress.total > 0 && (
            <div className="mt-2">
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#2195B9] transition-all" style={{ width: `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%` }} />
              </div>
              <p className="mt-1 text-base text-zinc-600">{progress.done.toLocaleString("pt-BR")} de {progress.total.toLocaleString("pt-BR")}</p>
            </div>
          )}
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-lg text-red-700" role="alert">{error}</p>}
        </div>
      )}

      {finished && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-lg font-medium text-emerald-800">
            Disparo concluído: {sentCount.toLocaleString("pt-BR")} enviados
            {failedCount > 0 && ` · ${failedCount} falharam`}
            {skippedCount > 0 && ` · ${skippedCount} pulados (descadastrados no meio do caminho)`}
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-semibold text-zinc-900">E-mail de teste</h3>
        <p className="mt-1 text-base text-zinc-500">Envia como vai ficar (o link de descadastro no teste é só ilustrativo).</p>
        <form action={testAction} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="campaignId" value={campaignId} />
          <label className="flex flex-col gap-1 text-base font-medium text-zinc-700">
            Enviar para
            <input name="to" type="email" required placeholder="voce@exemplo.com" className="h-11 w-72 rounded-xl border border-slate-200 px-3 text-base font-normal" />
          </label>
          <button type="submit" disabled={testPending} className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-base font-medium text-slate-700 hover:bg-slate-50">
            {testPending ? "Enviando…" : "Enviar teste"}
          </button>
        </form>
        {testState.message && (
          <p className={`mt-2 text-base ${testState.ok ? "text-emerald-700" : "text-red-600"}`} role={testState.ok ? "status" : "alert"}>{testState.message}</p>
        )}
      </div>
    </div>
  );
}

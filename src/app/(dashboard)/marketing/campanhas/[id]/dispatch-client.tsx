"use client";

// Disparo simples ou teste A/B, sempre fatiado (lotes curtos p/ caber no
// timeout Vercel):
// - Simples (1 assunto): enfileirar → disparar.
// - A/B (2–10 assuntos): amostra de 100/variante → aguardar aberturas →
//   apurar vencedora → disparar o restante com ela.
import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  declareWinner,
  deleteCampaign,
  dispatchChunk,
  finalizeQueue,
  finalizeTestQueue,
  queueCampaignChunk,
  queueRemainderChunk,
  queueTestChunk,
  sendTestEmail,
  tallyAb,
  type ActionState,
  type TallyResult,
} from "../../actions";

const testInitial: ActionState = { ok: false, message: "" };

async function loopUntilDone<T>(
  step: () => Promise<T & { ok: boolean; message: string; done: boolean }>,
  onProgress: (label: string) => void,
  label: string
): Promise<void> {
  for (;;) {
    onProgress(label);
    const r = await step();
    if (!r.ok) throw new Error(r.message);
    if (r.done) return;
  }
}

export default function DispatchClient({
  campaignId,
  status,
  total,
  sentCount,
  failedCount,
  skippedCount,
  abTest,
  subjects,
  winnerSubject,
}: {
  campaignId: number;
  status: string;
  total: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  abTest: boolean;
  subjects: string[];
  winnerSubject: string | null;
}) {
  const [testState, testAction, testPending] = useActionState(sendTestEmail, testInitial);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(status === "sent");
  const [testing, setTesting] = useState(status === "testing");
  const [tally, setTally] = useState<TallyResult | null>(null);
  const [tallying, setTallying] = useState(false);
  const router = useRouter();

  const isDraft = status === "draft" || status === "queued";
  const isSending = status === "sending";

  async function dispatchLoop(totalHint: number, startSent: number) {
    let sent = startSent;
    for (;;) {
      setPhase("Disparando… (não feche esta aba)");
      const d = await dispatchChunk(campaignId);
      if (!d.ok) throw new Error(d.message);
      sent += d.sent;
      if (totalHint > 0) setProgress({ done: sent, total: totalHint });
      if (d.done) return;
    }
  }

  async function handleSimpleDispatch() {
    setRunning(true);
    setError(null);
    try {
      await loopUntilDone(
        () => queueCampaignChunk(campaignId),
        () => setPhase("Montando a fila de destinatários…"),
        "Montando a fila de destinatários…"
      );
      const fin = await finalizeQueue(campaignId);
      if (!fin.ok) throw new Error(fin.message);
      await dispatchLoop(fin.total ?? 0, 0);
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

  async function handleStartTest() {
    setRunning(true);
    setError(null);
    try {
      await loopUntilDone(
        () => queueTestChunk(campaignId),
        () => setPhase("Montando a amostra do teste…"),
        "Montando a amostra do teste…"
      );
      const fin = await finalizeTestQueue(campaignId);
      if (!fin.ok) throw new Error(fin.message);
      await dispatchLoop(subjects.length * 100, 0);
      setPhase("");
      setTesting(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no teste.");
      setPhase("");
    } finally {
      setRunning(false);
    }
  }

  async function handleRefreshTally() {
    setTallying(true);
    const t = await tallyAb(campaignId);
    setTallying(false);
    if (t.ok) setTally(t);
    else setError(t.message);
  }

  async function handleDeclareWinner(variant?: string) {
    setRunning(true);
    setError(null);
    try {
      const w = await declareWinner(campaignId, variant);
      if (!w.ok) throw new Error(w.message);
      setPhase(`Vencedora apurada. Enfileirando o restante…`);
      await loopUntilDone(
        () => queueRemainderChunk(campaignId),
        () => setPhase("Enfileirando o restante da base…"),
        "Enfileirando o restante da base…"
      );
      const fin = await finalizeQueue(campaignId);
      if (!fin.ok) throw new Error(fin.message);
      await dispatchLoop(fin.total ?? 0, sentCount);
      setPhase("");
      setFinished(true);
      setTesting(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na apuração.");
      setPhase("");
    } finally {
      setRunning(false);
    }
  }

  async function handleComplete() {
    // Busca demais contatos (novos desde o snapshot ou fila interrompida)
    // sem repetir quem já recebeu: só entra quem não é destinatário ainda.
    setRunning(true);
    setError(null);
    try {
      await loopUntilDone(
        () => queueRemainderChunk(campaignId),
        () => setPhase("Buscando demais contatos da base…"),
        "Buscando demais contatos da base…"
      );
      const fin = await finalizeQueue(campaignId);
      if (!fin.ok) throw new Error(fin.message);
      if ((fin.total ?? 0) === 0) {
        setPhase("");
        setError(null);
      }
      await dispatchLoop(fin.total ?? 0, sentCount);
      setPhase("");
      setFinished(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao completar.");
      setPhase("");
    } finally {
      setRunning(false);
    }
  }

  async function handleResume() {
    setRunning(true);
    setError(null);
    try {
      await dispatchLoop(total, sentCount);
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
      {isDraft && !abTest && !finished && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-xl font-semibold text-zinc-900">Disparar para a base</h3>
          <p className="mt-1 text-base text-zinc-500">
            Congela os leads ativos do momento e envia em lotes. Quem se descadastrar no meio do caminho é pulado automaticamente.
          </p>
          <div className="mt-3">
            <button
              onClick={() => void handleSimpleDispatch()}
              disabled={running}
              className="inline-flex h-12 items-center rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white disabled:opacity-50 hover:bg-[#1a7a98]"
            >
              {running ? "Trabalhando…" : "Enfileirar e disparar"}
            </button>
            <button onClick={() => void handleDelete()} disabled={running} className="ml-3 inline-flex h-12 items-center rounded-xl border border-red-200 px-6 text-lg font-medium text-red-600 hover:bg-red-50">
              Excluir rascunho
            </button>
          </div>
          {phase && <p className="mt-3 text-lg text-zinc-600" role="status">{phase}</p>}
          {progress.total > 0 && (
            <ProgressBar done={progress.done} total={progress.total} />
          )}
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-lg text-red-700" role="alert">{error}</p>}
        </div>
      )}

      {isDraft && abTest && !testing && !finished && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-xl font-semibold text-zinc-900">Teste A/B de assunto</h3>
          <p className="mt-1 text-base text-zinc-500">
            Envia <strong>100 e-mails por assunto</strong> ({subjects.length * 100} no total) e mede a
            abertura de cada um. Depois você apura a vencedora e dispara o restante da base com ela.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {subjects.map((s, i) => (
              <li key={i} className="text-base text-zinc-700">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-sm font-bold">{String.fromCharCode(65 + i)}</span>
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <button
              onClick={() => void handleStartTest()}
              disabled={running}
              className="inline-flex h-12 items-center rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white disabled:opacity-50 hover:bg-[#1a7a98]"
            >
              {running ? "Trabalhando…" : `Iniciar teste (${subjects.length * 100} e-mails)`}
            </button>
            <button onClick={() => void handleDelete()} disabled={running} className="ml-3 inline-flex h-12 items-center rounded-xl border border-red-200 px-6 text-lg font-medium text-red-600 hover:bg-red-50">
              Excluir rascunho
            </button>
          </div>
          {phase && <p className="mt-3 text-lg text-zinc-600" role="status">{phase}</p>}
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-lg text-red-700" role="alert">{error}</p>}
        </div>
      )}

      {testing && !finished && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-xl font-semibold text-zinc-900">Teste no ar — aguardando aberturas</h3>
          <p className="mt-1 text-base text-zinc-500">
            Amostra enviada. Aguarde <strong>4 a 6 horas</strong> (um dia é ainda melhor) para as
            aberturas chegarem, atualize a apuração e dispare o restante com a vencedora.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button onClick={() => void handleRefreshTally()} disabled={tallying || running} className="inline-flex h-11 items-center rounded-xl border border-slate-200 px-4 text-base font-medium text-slate-700 hover:bg-slate-50">
              {tallying ? "Atualizando…" : "Atualizar apuração"}
            </button>
            <button onClick={() => void handleDeclareWinner()} disabled={running} className="inline-flex h-11 items-center rounded-xl bg-[#2195B9] px-4 text-base font-medium text-white disabled:opacity-50 hover:bg-[#1a7a98]">
              {running ? "Trabalhando…" : "Apurar vencedora e disparar restante"}
            </button>
          </div>
          {phase && <p className="mt-3 text-lg text-zinc-600" role="status">{phase}</p>}
          {progress.total > 0 && <ProgressBar done={progress.done} total={progress.total} />}
          {tally && tally.tally.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-base">
                <thead>
                  <tr className="text-slate-500">
                    <th className="py-1 pr-3">Var.</th>
                    <th className="py-1 pr-3">Assunto</th>
                    <th className="py-1 pr-3">Enviados</th>
                    <th className="py-1 pr-3">Aberturas</th>
                    <th className="py-1 pr-3">Taxa</th>
                    <th className="py-1" />
                  </tr>
                </thead>
                <tbody>
                  {tally.tally.map((t) => {
                    const isWin = tally.winner?.variant === t.variant;
                    return (
                      <tr key={t.variant} className={isWin ? "bg-emerald-50 font-medium" : ""}>
                        <td className="py-1.5 pr-3 font-bold">{t.variant}{isWin ? " ★" : ""}</td>
                        <td className="py-1.5 pr-3">{t.subject}</td>
                        <td className="py-1.5 pr-3">{t.sent}</td>
                        <td className="py-1.5 pr-3">{t.opened}</td>
                        <td className="py-1.5 pr-3">{(t.rate * 100).toFixed(1)}%</td>
                        <td className="py-1.5">
                          <button onClick={() => void handleDeclareWinner(t.variant)} disabled={running} className="text-base text-[#2195B9] underline hover:text-[#1a7a98]">
                            usar este
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-lg text-red-700" role="alert">{error}</p>}
        </div>
      )}

      {isSending && !finished && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-xl font-semibold text-zinc-900">Disparo em andamento</h3>
          <p className="mt-1 text-base text-zinc-500">
            {winnerSubject ? <>Assunto vencedor: <strong>{winnerSubject}</strong>. </> : null}
            Retome de onde parou — ninguém recebe duplicado.
          </p>
          <button onClick={() => void handleResume()} disabled={running} className="mt-3 inline-flex h-12 items-center rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white disabled:opacity-50 hover:bg-[#1a7a98]">
            {running ? "Trabalhando…" : "Retomar disparo"}
          </button>
          {phase && <p className="mt-3 text-lg text-zinc-600" role="status">{phase}</p>}
          {progress.total > 0 && <ProgressBar done={progress.done} total={progress.total} />}
          {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-lg text-red-700" role="alert">{error}</p>}
        </div>
      )}

      {finished && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-lg font-medium text-emerald-800">
            Disparo concluído: {sentCount.toLocaleString("pt-BR")} enviados
            {winnerSubject ? <> com <strong>{winnerSubject}</strong></> : null}
            {failedCount > 0 && ` · ${failedCount} falharam`}
            {skippedCount > 0 && ` · ${skippedCount} pulados (descadastrados no meio do caminho)`}
          </p>
          <div>
            <p className="text-base text-emerald-700">
              Faltou gente? Busca os demais contatos da base (inclusive novos) sem repetir quem já recebeu.
            </p>
            <button onClick={() => void handleComplete()} disabled={running} className="mt-2 inline-flex h-11 items-center rounded-xl bg-emerald-600 px-4 text-base font-medium text-white disabled:opacity-50 hover:bg-emerald-700">
              {running ? "Trabalhando…" : "Disparar para os demais"}
            </button>
          </div>
          {phase && <p className="text-lg text-emerald-700" role="status">{phase}</p>}
          {progress.total > 0 && <ProgressBar done={progress.done} total={progress.total} />}
          {error && <p className="rounded-xl bg-red-50 p-3 text-lg text-red-700" role="alert">{error}</p>}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-semibold text-zinc-900">E-mail de teste</h3>
        <p className="mt-1 text-base text-zinc-500">Envia com o primeiro assunto (o link de descadastro no teste é só ilustrativo).</p>
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

function ProgressBar({ done, total }: { done: number; total: number }) {
  return (
    <div className="mt-2">
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#2195B9] transition-all" style={{ width: `${Math.min(100, Math.round((done / total) * 100))}%` }} />
      </div>
      <p className="mt-1 text-base text-zinc-600">{done.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}</p>
    </div>
  );
}

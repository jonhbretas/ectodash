"use client";

// src/app/(dashboard)/financeiro/propostas/propostas-sync.tsx
// Painel de sincronização com o Google Planilhas: PULL (puxar da planilha
// → sistema) e PUSH (gravar o estado do sistema na planilha). Mostra o
// formato esperado das colunas e a última sincronização.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Table2 } from "lucide-react";
import { exportarParaPlanilha, sincronizarPlanilha } from "./actions";

export default function PropostasSync({
  ultimaSincronizacao,
  planilhaConfigurada,
}: {
  ultimaSincronizacao: string | null;
  planilhaConfigurada: boolean;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<"pull" | "push" | null>(null);
  const [, startTransition] = useTransition();

  function executar(tipo: "pull" | "push") {
    setOcupado(tipo);
    setFeedback(null);
    startTransition(async () => {
      const res =
        tipo === "pull" ? await sincronizarPlanilha() : await exportarParaPlanilha();
      setOcupado(null);
      setFeedback(res.message);
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="sync-titulo"
      className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="sync-titulo" className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <Table2 size={24} aria-hidden="true" className="text-[#2195B9]" />
            Google Planilhas
          </h2>
          <p className="max-w-2xl text-lg text-zinc-600">
            {planilhaConfigurada ? (
              <>
                Puxe as linhas preenchidas na planilha ou grave o estado do
                sistema nela — acesso externo facilitado.
                {ultimaSincronizacao && (
                  <> Última sincronização: <strong>{ultimaSincronizacao}</strong>.</>
                )}
              </>
            ) : (
              <>
                Defina <code className="rounded bg-zinc-100 px-1">PROPOSTAS_SHEET_ID</code> nas
                variáveis de ambiente e compartilhe a planilha com o e-mail da
                service account (leitor para puxar, editor para gravar).
              </>
            )}
          </p>
          <p className="text-base text-zinc-500">
            Colunas da aba: aluno | email | curso/evento/atividade | valor |
            método | prazo | pago | observações (1ª linha = cabeçalho).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => executar("pull")}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-[#2195B9] px-5 text-lg font-medium text-white transition-colors hover:bg-[#28627B] disabled:opacity-60"
          >
            <ArrowDownToLine size={18} aria-hidden="true" />
            {ocupado === "pull" ? "Puxando…" : "Puxar da planilha"}
          </button>
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => executar("push")}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60"
          >
            <ArrowUpFromLine size={18} aria-hidden="true" />
            {ocupado === "push" ? "Gravando…" : "Gravar na planilha"}
          </button>
        </div>
      </div>
      {feedback && (
        <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-lg text-zinc-700">
          {feedback}
        </p>
      )}
    </section>
  );
}

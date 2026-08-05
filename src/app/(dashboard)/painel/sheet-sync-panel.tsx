// Financeiro/coordenador-visible sheets-sync run log (FIN-03) — a Server
// Component receiving pre-fetched rows as a prop, mirroring
// reminder-runs-panel.tsx's exact prop-driven pattern: the query lives in
// the page, never here. Renders structurally only inside the /painel
// coordinator branch AND the /financeiro page's role branch, backstopped by
// sheet_sync_runs' own financeiro/coordenador-only SELECT RLS policy
// (migration 0006). Icon+label always paired, never color alone, matching
// the established convention. className lets callers opt out of the default
// max-w-4xl constraint (the full-width /financeiro layout).
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type SheetSyncStatus = "running" | "success" | "failed";

export type SheetSyncRunRow = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: SheetSyncStatus;
  entriesCount: number;
  errorMessage: string | null;
};

export type SheetSyncPanelProps = {
  runs: SheetSyncRunRow[];
  className?: string;
};

const STATUS_CONFIG: Record<
  SheetSyncStatus,
  { label: string; Icon: typeof Clock; className: string }
> = {
  success: {
    label: "Sucesso",
    Icon: CheckCircle2,
    className: "text-green-700",
  },
  failed: {
    label: "Falha",
    Icon: XCircle,
    className: "text-red-700",
  },
  running: {
    label: "Em execução",
    Icon: Clock,
    className: "text-zinc-700",
  },
};

function formatStartedAt(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function SyncRunRow({
  run,
  showCount,
}: {
  run: SheetSyncRunRow;
  showCount: boolean;
}) {
  const { label, Icon, className } = STATUS_CONFIG[run.status];
  return (
    <div className="flex flex-col gap-1 border-b border-zinc-200 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xl text-zinc-900">
            {formatStartedAt(run.startedAt)}
          </span>
          <span
            className={`flex items-center gap-1 text-xl font-semibold ${className}`}
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </span>
        </div>
        {showCount && run.status === "success" && (
          <span className="shrink-0 text-base text-zinc-700">
            {run.entriesCount} lançamentos
          </span>
        )}
      </div>
      {run.status === "failed" && run.errorMessage && (
        <p className="text-base text-red-700">{run.errorMessage}</p>
      )}
    </div>
  );
}

export default function SheetSyncPanel({ runs, className }: SheetSyncPanelProps) {
  const lastRun = runs[0] ?? null;

  return (
    <section
      className={cn(
        "flex w-full max-w-4xl flex-col gap-2",
        className
      )}
      aria-label="Sincronização com a planilha"
    >
      <h2 className="text-2xl font-semibold text-zinc-900">
        Sincronização com a planilha de fluxo de caixa
      </h2>

      {!lastRun ? (
        <p className="text-xl text-zinc-700">
          Nenhuma sincronização registrada ainda.
        </p>
      ) : (
        <>
          <div className="flex flex-col rounded-xl border border-zinc-300 bg-white p-4">
            <SyncRunRow run={lastRun} showCount />
          </div>

          {runs.length > 1 && (
            <details className="group">
              <summary className="min-h-14 cursor-pointer list-none rounded-lg px-2 text-xl font-medium text-zinc-900 marker:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]">
                Histórico de sincronizações
              </summary>
              <div className="flex flex-col">
                {runs.slice(1).map((run) => (
                  <SyncRunRow key={run.id} run={run} showCount={false} />
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}

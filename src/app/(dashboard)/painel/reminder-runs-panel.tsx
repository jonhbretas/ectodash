// Coordenador-visible reminder-job run log (LEMB-04) — a Server Component
// receiving pre-fetched rows as a prop, matching AreaSummary/
// ResponsavelSummary's existing prop-driven pattern: the query itself lives
// in page.tsx, never here. This component performs NO role check of its own
// — it structurally only ever renders inside page.tsx's existing
// coordinator-only branch, backstopped by reminder_runs' own coordenador-
// only SELECT RLS policy (migration 0005). Icon+label always paired, never
// color alone, mirroring status-badge.tsx/overdue-badge.tsx's established
// convention.
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type ReminderRunStatus =
  | "running"
  | "success"
  | "partial_failure"
  | "failed";

export type ReminderRunRow = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: ReminderRunStatus;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  errorMessage: string | null;
};

export type ReminderRunsPanelProps = {
  runs: ReminderRunRow[];
};

const STATUS_CONFIG: Record<
  ReminderRunStatus,
  { label: string; Icon: typeof Clock; className: string }
> = {
  success: {
    label: "Sucesso",
    Icon: CheckCircle2,
    className: "text-green-700",
  },
  partial_failure: {
    label: "Falha parcial",
    Icon: AlertTriangle,
    className: "text-amber-700",
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

export default function ReminderRunsPanel({ runs }: ReminderRunsPanelProps) {
  return (
    <section className="flex w-full max-w-4xl flex-col gap-2">
      <h2 className="text-2xl font-semibold text-zinc-900">
        Execuções de lembretes
      </h2>

      {runs.length === 0 ? (
        <p className="text-xl text-zinc-700">
          Nenhuma execução de lembretes registrada ainda.
        </p>
      ) : (
        <div className="flex flex-col">
          {runs.map((run) => {
            const { label, Icon, className } = STATUS_CONFIG[run.status];
            const startedAtFormatted = format(
              new Date(run.startedAt),
              "dd/MM/yyyy HH:mm",
              { locale: ptBR }
            );

            return (
              <div
                key={run.id}
                className="flex flex-col gap-1 border-b border-zinc-200 py-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xl text-zinc-900">
                      {startedAtFormatted}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-xl font-semibold ${className}`}
                    >
                      <Icon size={20} aria-hidden="true" />
                      {label}
                    </span>
                  </div>
                  <span className="shrink-0 text-base text-zinc-700">
                    {run.sentCount} enviados · {run.failedCount} falharam ·{" "}
                    {run.skippedCount} ignorados
                  </span>
                </div>
                {run.status === "failed" && run.errorMessage && (
                  <p className="text-base text-red-700">{run.errorMessage}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

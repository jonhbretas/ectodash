// Aba "Log de ações" do painel do coordenador — Server Component que recebe
// linhas pré-buscadas por prop, seguindo o padrão prop-driven de
// ReminderRunsPanel/SheetSyncPanel: a query vive em page.tsx, nunca aqui.
// Sem role check próprio — só renderiza dentro do branch coordenador-only de
// page.tsx, com respaldo da policy de SELECT coordenador-only do
// audit_log (migração 0059). Filtros e paginação via searchParams
// (/painel?busca=...&entidade=...&pagina=...) renderizados pela barra client.
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollText, UserRound } from "lucide-react";
import {
  ACAO_AUDIT_CONFIG,
  auditEntidadeLabel,
} from "@/lib/audit-labels";
import type { AcaoAudit } from "@/lib/audit-labels";
import type { LogAcoesFilters } from "./log-acoes-filter-schema";
import LogAcoesFiltersBar from "./log-acoes-filters";
import LogAcoesDetails from "./log-acoes-details";

export type LogAcoesRow = {
  id: number;
  profileId: string | null;
  acao: AcaoAudit;
  entidade: string;
  entidadeId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
  usuario: string | null;
};

export type LogAcoesPanelProps = {
  rows: LogAcoesRow[];
  total: number;
  totalPages: number;
  filters: LogAcoesFilters;
};

export default function LogAcoesPanel({
  rows,
  total,
  totalPages,
  filters,
}: LogAcoesPanelProps) {
  const temFiltro = Boolean(filters.busca || filters.entidade);

  return (
    <section className="flex w-full max-w-4xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <ScrollText size={24} className="text-[#2195B9]" aria-hidden="true" />
          Log de ações
        </h2>
        <p className="text-base text-zinc-600">
          Quem criou, alterou ou removeu registros nas tabelas de negócio
          (demandas, voluntários, eventos, reuniões, áreas, contratos,
          utilidades, PROEP e perfis). Ações de sistema (crons e sincronizações)
          aparecem como Sistema.
        </p>
      </div>

      <LogAcoesFiltersBar
        currentFilters={filters}
        total={total}
        totalPages={totalPages}
      />

      {rows.length === 0 ? (
        <p className="text-xl text-zinc-700">
          {temFiltro
            ? "Nenhuma ação encontrada com os filtros atuais."
            : "Nenhuma ação registrada ainda."}
        </p>
      ) : (
        <div className="flex flex-col">
          {rows.map((row) => {
            const { label, Icon, className } = ACAO_AUDIT_CONFIG[row.acao];
            return (
              <div
                key={row.id}
                className="flex flex-col gap-2 border-b border-zinc-200 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`flex items-center gap-1.5 text-lg font-semibold ${className}`}
                    >
                      <Icon size={20} aria-hidden="true" />
                      {label}
                    </span>
                    <span className="text-lg text-zinc-900">
                      {auditEntidadeLabel(row.entidade)}
                      {row.entidadeId ? ` #${row.entidadeId}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-zinc-600">
                    <span className="flex items-center gap-1.5">
                      <UserRound size={16} aria-hidden="true" />
                      {row.usuario ?? "Sistema"}
                    </span>
                    <span>
                      {format(
                        new Date(row.createdAt),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )}
                    </span>
                  </div>
                </div>
                <LogAcoesDetails
                  acao={row.acao}
                  entidade={row.entidade}
                  entidadeId={row.entidadeId}
                  beforeData={row.beforeData}
                  afterData={row.afterData}
                  createdAt={row.createdAt}
                  usuario={row.usuario ?? "Sistema"}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

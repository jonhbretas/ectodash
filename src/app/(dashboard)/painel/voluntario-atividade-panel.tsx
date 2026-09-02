import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, Activity, Clock3 } from "lucide-react";

export type VoluntarioAtividadeRow = {
  id: number;
  acao: "INSERT" | "UPDATE" | "DELETE";
  entidade: string;
  entidadeId: string | null;
  createdAt: string;
  usuario: string | null;
  detalhe: string | null;
};

export type VoluntarioResumo = {
  total: number;
  ativos: number;
  recentes: VoluntarioAtividadeRow[];
};

function formatarData(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

const ACAO_LABEL: Record<string, string> = {
  INSERT: "criou",
  UPDATE: "atualizou",
  DELETE: "removeu",
};

export default function VoluntarioAtividadePanel({
  resumo,
}: {
  resumo: VoluntarioResumo;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2195B9]/10 text-[#2195B9]">
            <Users size={20} aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm text-zinc-500">Total de voluntários</span>
            <span className="text-2xl font-semibold text-zinc-900">{resumo.total}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700">
            <Activity size={20} aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <span className="text-sm text-zinc-500">Atividades recentes</span>
            <span className="text-2xl font-semibold text-zinc-900">{resumo.recentes.length}</span>
          </div>
        </div>
      </div>

      {resumo.recentes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-300 bg-white py-12 text-center">
          <Clock3 size={36} className="text-zinc-300" aria-hidden="true" />
          <p className="text-sm text-zinc-600">Nenhuma atividade de voluntários registrada ainda.</p>
        </div>
      ) : (
        <div className="flex flex-col rounded-xl border border-zinc-300 bg-white">
          {resumo.recentes.map((r, idx) => (
            <div
              key={r.id}
              className={`flex flex-col gap-1 p-4 ${idx > 0 ? "border-t border-zinc-200" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    r.acao === "INSERT"
                      ? "bg-green-50 text-green-700"
                      : r.acao === "DELETE"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {ACAO_LABEL[r.acao] ?? r.acao}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                  {r.entidade}
                </span>
                {r.entidadeId && (
                  <span className="text-xs text-zinc-500">#{r.entidadeId}</span>
                )}
                <span className="ml-auto text-xs text-zinc-500">{formatarData(r.createdAt)}</span>
              </div>
              <p className="text-sm text-zinc-700">
                {r.usuario ? (
                  <>
                    <span className="font-medium text-zinc-900">{r.usuario}</span> {ACAO_LABEL[r.acao] ?? r.acao} {r.entidade}
                  </>
                ) : (
                  <>Sistema {ACAO_LABEL[r.acao] ?? r.acao} {r.entidade}</>
                )}
                {r.detalhe ? ` · ${r.detalhe}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-zinc-500">
        Fonte: audit_log (entidades voluntarios, voluntario_areas, profiles) · atualização ao recarregar o painel.
      </p>
    </div>
  );
}

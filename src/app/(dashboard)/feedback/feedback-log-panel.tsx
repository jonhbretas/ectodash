"use client";

// src/app/(dashboard)/feedback/feedback-log-panel.tsx
// Aba de logs para coordenador: linha do tempo de envios + mudanças de status.
// Usa os próprios registros de feedback (created_at) e, quando existir,
// o audit_log da entidade feedback (migration futura). Enquanto audit_log
// não estiver populado, o painel ainda é útil como histórico cronológico.
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bug, Lightbulb, Clock3, Eye, CheckCircle2, History } from "lucide-react";
import { cn } from "@/lib/utils";

export type FeedbackLogRow = {
  id: string;
  tipo: "bug" | "sugestao";
  mensagem: string;
  status: "novo" | "visto" | "resolvido";
  createdAt: string;
  autor: string;
  pagina: string | null;
};

function formatarData(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

const TIPO_ICON: Record<string, typeof Bug> = {
  bug: Bug,
  sugestao: Lightbulb,
};

const STATUS_META: Record<string, { label: string; Icon: typeof Clock3; className: string }> = {
  novo: { label: "Novo", Icon: Clock3, className: "bg-[#2195B9]/10 text-[#2195B9]" },
  visto: { label: "Visto", Icon: Eye, className: "bg-zinc-100 text-zinc-600" },
  resolvido: { label: "Resolvido", Icon: CheckCircle2, className: "bg-green-50 text-green-700" },
};

export default function FeedbackLogPanel({ relatos }: { relatos: FeedbackLogRow[] }) {
  if (relatos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-300 bg-white py-16 text-center">
        <History size={48} className="text-zinc-300" aria-hidden="true" />
        <h2 className="text-2xl font-semibold text-zinc-900">Nenhum registro ainda</h2>
        <p className="max-w-md text-lg text-zinc-600">
          Quando houver envios, o histórico cronológico aparece aqui.
        </p>
      </div>
    );
  }

  // Ordena por data mais recente primeiro (mesma ordem do arquivo já vem)
  const ordenados = [...relatos].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <History size={16} aria-hidden="true" />
        <span>
          {ordenados.length} {ordenados.length === 1 ? "registro" : "registros"} · do mais recente ao mais antigo
        </span>
      </div>

      <div className="flex flex-col rounded-xl border border-zinc-300 bg-white">
        {ordenados.map((r, idx) => {
          const TipoIcon = TIPO_ICON[r.tipo] ?? Bug;
          const status = STATUS_META[r.status] ?? STATUS_META.novo;
          const preview = r.mensagem.length > 120 ? `${r.mensagem.slice(0, 120)}…` : r.mensagem;
          return (
            <div
              key={r.id}
              className={cn(
                "flex gap-3 p-4",
                idx > 0 && "border-t border-zinc-200"
              )}
            >
              {/* Linha do tempo: ponto + linha */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full",
                    r.tipo === "bug" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                  )}
                >
                  <TipoIcon size={16} aria-hidden="true" />
                </span>
                {idx < ordenados.length - 1 && (
                  <span className="mt-1 w-px flex-1 bg-zinc-200" aria-hidden="true" />
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      r.tipo === "bug" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    )}
                  >
                    {r.tipo === "bug" ? "Bug" : "Sugestão"}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                      status.className
                    )}
                  >
                    <status.Icon size={12} aria-hidden="true" />
                    {status.label}
                  </span>
                  <span className="text-xs text-zinc-500">{formatarData(r.createdAt)}</span>
                </div>
                <p className="break-words text-sm leading-relaxed text-zinc-900" title={r.mensagem}>
                  {preview}
                </p>
                <p className="text-xs text-zinc-500">
                  por <span className="font-medium text-zinc-700">{r.autor}</span>
                  {r.pagina ? ` · em ${r.pagina}` : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

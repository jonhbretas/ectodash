"use client";

import { useState, useTransition } from "react";
import { Check, X, Users, Loader2 } from "lucide-react";
import { marcarDisponibilidade, marcarDisponibilidadeTodos } from "./actions";

type DisponibilidadeVoluntario = {
  voluntario_id: number;
  disponivel: boolean;
  motivo: string | null;
  voluntario_nome: string;
};

export default function DisponibilidadePanel({
  escalaId,
  disponibilidades,
  totalVoluntarios,
  isCoordenador,
  status,
  voluntarioAtualId,
}: {
  escalaId: number;
  disponibilidades: DisponibilidadeVoluntario[];
  totalVoluntarios: number;
  isCoordenador: boolean;
  status: string;
  voluntarioAtualId: number | null;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const registroAtual = disponibilidades.find(
    (d) => voluntarioAtualId !== null && d.voluntario_id === voluntarioAtualId
  );

  // Estado atual: null = não votou, true = disponível, false = indisponível
  const estadoAtual = optimistic !== null ? optimistic : registroAtual?.disponivel ?? null;

  const totalDisponiveis = disponibilidades.filter((d) => d.disponivel).length;
  const totalIndisponiveis = disponibilidades.filter((d) => !d.disponivel).length;
  const totalRespondeu = disponibilidades.length;

  function handleMarcar(disponivel: boolean) {
    if (voluntarioAtualId === null) return;
    setOptimistic(disponivel);
    startTransition(async () => {
      const result = await marcarDisponibilidade(escalaId, voluntarioAtualId, disponivel);
      if (!result.ok) {
        setOptimistic(null);
      }
    });
  }

  function handleMarcarTodos(disponivel: boolean) {
    startTransition(async () => {
      await marcarDisponibilidadeTodos(escalaId, disponivel);
    });
  }

  if (status === "cancelada") return null;

  return (
    <div className="rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60 p-5">
      <div className="flex flex-col gap-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-zinc-500" />
            <h3 className="text-lg font-semibold text-zinc-900">
              Disponibilidade
            </h3>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-emerald-600">
              <Check size={14} />
              {totalDisponiveis} disponível{totalDisponiveis !== 1 && "eis"}
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <X size={14} />
              {totalIndisponiveis} não pode{totalIndisponiveis !== 1 && "m"}
            </span>
            <span className="text-zinc-400">
              {totalRespondeu}/{totalVoluntarios}
            </span>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
            style={{
              width: totalVoluntarios > 0
                ? `${(totalDisponiveis / totalVoluntarios) * 100}%`
                : "0%",
            }}
          />
        </div>

        {/* Botões do voluntário atual */}
        {status !== "publicada" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleMarcar(true)}
              disabled={pending || estadoAtual === true}
              className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-base font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                estadoAtual === true
                  ? "bg-emerald-600 text-white shadow-[0_1px_3px_rgba(16,185,129,0.3)]"
                  : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {pending && estadoAtual === true ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Posso ir
            </button>
            <button
              onClick={() => handleMarcar(false)}
              disabled={pending || estadoAtual === false}
              className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-base font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 ${
                estadoAtual === false
                  ? "bg-red-500 text-white shadow-[0_1px_3px_rgba(239,68,68,0.3)]"
                  : "border border-red-200 bg-white text-red-600 hover:bg-red-50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {pending && estadoAtual === false ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <X size={16} />
              )}
              Não posso ir
            </button>
          </div>
        )}

        {/* Ações do coordenador */}
        {isCoordenador && status !== "publicada" && (
          <div className="flex items-center gap-3 border-t border-zinc-100 pt-3">
            <span className="text-sm text-zinc-500">Coordenador:</span>
            <button
              onClick={() => handleMarcarTodos(true)}
              disabled={pending}
              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              Marcar todos disponíveis
            </button>
            <button
              onClick={() => handleMarcarTodos(false)}
              disabled={pending}
              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              Marcar todos indisponíveis
            </button>
          </div>
        )}

        {/* Lista de quem já respondeu (colapsável) */}
        {totalRespondeu > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-700 transition-colors">
              Ver quem já respondeu ({totalRespondeu})
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {disponibilidades.map((d) => (
                <span
                  key={d.voluntario_id}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm ${
                    d.disponivel
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  {d.disponivel ? (
                    <Check size={12} />
                  ) : (
                    <X size={12} />
                  )}
                  {d.voluntario_nome}
                </span>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

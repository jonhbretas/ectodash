"use client";

// src/app/(dashboard)/financeiro/pagar/pagar-list.tsx
// Cards das contas a pagar da Ectolab: selo de situação, vencimento com
// destaque de atraso, método + ações (dar baixa, editar, excluir).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BadgeCheck, Pencil, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { alternarContaPaga, excluirConta } from "./actions";
import PagarForm, { type Conta } from "./pagar-form";
import { METODO_LABELS } from "../propostas/proposta-schema";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatarData(iso: string | null): string {
  if (!iso) return "Sem vencimento";
  return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

export default function PagarList({ contas }: { contas: Conta[] }) {
  const router = useRouter();
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [agindoId, setAgindoId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function comTransicao(id: number, fn: () => Promise<{ ok: boolean; message: string }>) {
    setAgindoId(id);
    setFeedback(null);
    startTransition(async () => {
      const res = await fn();
      setAgindoId(null);
      setFeedback(res.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {feedback && (
        <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-lg text-zinc-700">
          {feedback}
        </p>
      )}
      {contas.map((c) => {
        const atrasada = c.status === "pendente" && c.vencimento !== null && c.vencimento < hoje();
        const agindo = agindoId === c.id;
        const editando = editandoId === c.id;
        return (
          <article
            key={c.id}
            className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-xl font-semibold text-zinc-900">{c.titulo}</h3>
                {c.fornecedor && <p className="text-lg text-zinc-600">{c.fornecedor}</p>}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {c.status === "pago" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-base font-medium text-green-700 ring-1 ring-green-200/60">
                      <BadgeCheck size={15} aria-hidden="true" />
                      Pago
                    </span>
                  ) : c.status === "cancelado" ? (
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-500 ring-1 ring-zinc-200">
                      Cancelado
                    </span>
                  ) : atrasada ? (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-base font-semibold text-red-700 ring-1 ring-red-200">
                      Vencida
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-700 ring-1 ring-amber-200/60">
                      Pendente
                    </span>
                  )}
                  <span className="rounded-full bg-[#2195B9]/10 px-2.5 py-0.5 text-base font-medium text-[#28627B]">
                    {METODO_LABELS[c.metodo]}
                  </span>
                  <span className={cn("text-base", atrasada ? "font-semibold text-red-700" : "text-zinc-500")}>
                    Vence: {formatarData(c.vencimento)}
                  </span>
                </div>
              </div>
              <p className="whitespace-nowrap text-2xl font-semibold text-zinc-900">
                {brl.format(c.valor)}
              </p>
            </div>

            {c.observacoes && (
              <p className="whitespace-pre-wrap break-words text-lg text-zinc-600">{c.observacoes}</p>
            )}

            {editando ? (
              <div className="border-t border-zinc-100 pt-3">
                <PagarForm conta={c} />
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setEditandoId(null)}
                    className="min-h-11 rounded-lg px-4 text-lg text-zinc-600 transition-colors hover:bg-zinc-100"
                  >
                    Fechar edição
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
                {c.status !== "cancelado" && (
                  <button
                    type="button"
                    disabled={agindo}
                    onClick={() => comTransicao(c.id, () => alternarContaPaga(c.id, c.status !== "pago"))}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg px-4 text-lg font-medium text-white transition-colors disabled:opacity-60",
                      c.status === "pago"
                        ? "bg-zinc-500 hover:bg-zinc-600"
                        : "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    {c.status === "pago" ? (
                      <Undo2 size={18} aria-hidden="true" />
                    ) : (
                      <BadgeCheck size={18} aria-hidden="true" />
                    )}
                    {agindo ? "Salvando…" : c.status === "pago" ? "Voltar para pendente" : "Marcar como paga"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditandoId(c.id)}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-lg font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                >
                  <Pencil size={18} aria-hidden="true" />
                  Editar
                </button>
                <button
                  type="button"
                  disabled={agindo}
                  onClick={() => {
                    if (window.confirm(`Excluir "${c.titulo}"? Não dá para desfazer.`)) {
                      comTransicao(c.id, () => excluirConta(c.id));
                    }
                  }}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-lg font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 size={18} aria-hidden="true" />
                  Excluir
                </button>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

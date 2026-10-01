"use client";

// src/app/(dashboard)/financeiro/propostas/propostas-list.tsx
// Lista de propostas em cards com foco no ALUNO: nome + curso em
// destaque, selo de situação (pendente/pago/atrasada/cancelado), método,
// prazo, valor + ações (marcar pago/pendente, editar, excluir, abrir
// planilha). Origem 'planilha' ganha selo verde de sincronizada.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BadgeCheck,
  ExternalLink,
  Pencil,
  Table2,
  Trash2,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { alternarPago, alternarParcela, excluirProposta } from "./actions";
import PropostaForm from "./proposta-form";
import {
  METODO_LABELS,
  STATUS_LABELS,
  estaAtrasada,
  type AlunoSugestao,
  type EventoOpcao,
  type Proposta,
} from "./proposta-schema";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function Selo({ proposta }: { proposta: Proposta }) {
  if (proposta.status === "pago") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-base font-medium text-green-700 ring-1 ring-green-200/60">
        <BadgeCheck size={15} aria-hidden="true" />
        Pago
      </span>
    );
  }
  if (proposta.status === "cancelado") {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-base font-medium text-zinc-500 ring-1 ring-zinc-200">
        Cancelado
      </span>
    );
  }
  if (estaAtrasada(proposta)) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-base font-semibold text-red-700 ring-1 ring-red-200">
        Atrasada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-base font-medium text-amber-700 ring-1 ring-amber-200/60">
      Pendente
    </span>
  );
}

function formatarPrazo(iso: string | null): string {
  if (!iso) return "Sem prazo";
  return format(new Date(`${iso}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
}

type Props = {
  propostas: Proposta[];
  alunos: AlunoSugestao[];
  eventos: EventoOpcao[];
  cursosSugeridos: string[];
};

export default function PropostasList({ propostas, alunos, eventos, cursosSugeridos }: Props) {
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

  function handleExcluir(p: Proposta) {
    if (!window.confirm(`Excluir a proposta de "${p.aluno_nome}"? Não dá para desfazer.`)) return;
    comTransicao(p.id, () => excluirProposta(p.id));
  }

  return (
    <div className="flex flex-col gap-3">
      {feedback && (
        <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-lg text-zinc-700">
          {feedback}
        </p>
      )}
      {propostas.map((p) => {
        const editando = editandoId === p.id;
        const agindo = agindoId === p.id;
        return (
          <article
            key={p.id}
            className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-xl font-semibold text-zinc-900">{p.aluno_nome}</h3>
                <p className="text-lg text-zinc-600">{p.curso_atividade}</p>
                {p.aluno_email && (
                  <p className="text-base text-zinc-500">{p.aluno_email}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Selo proposta={p} />
                  <span className="rounded-full bg-[#2195B9]/10 px-2.5 py-0.5 text-base font-medium text-[#28627B]">
                    {METODO_LABELS[p.metodo]}
                  </span>
                  {p.parcelas.length > 1 && (
                    <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-base font-semibold text-violet-700 ring-1 ring-violet-200/60">
                      {p.parcelas.length}x de {brl.format(p.parcelas[0].valor)}
                    </span>
                  )}
                  {p.origem === "planilha" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-base font-medium text-green-700 ring-1 ring-green-200/60">
                      <Table2 size={14} aria-hidden="true" />
                      Planilha
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-base",
                      estaAtrasada(p) ? "font-semibold text-red-700" : "text-zinc-500"
                    )}
                  >
                    Prazo: {formatarPrazo(p.prazo)}
                  </span>
                  <span className="sr-only">Situação: {STATUS_LABELS[p.status]}</span>
                </div>
              </div>
              <p className="whitespace-nowrap text-2xl font-semibold text-zinc-900">
                {brl.format(p.valor)}
              </p>
            </div>

            {(p.evento_titulo || p.descricao || p.observacoes) && (
              <div className="flex flex-col gap-1 text-lg text-zinc-700">
                {p.evento_titulo && (
                  <p className="text-zinc-600">
                    Evento: <strong>{p.evento_titulo}</strong>
                  </p>
                )}
                {p.descricao && <p className="whitespace-pre-wrap break-words">{p.descricao}</p>}
                {p.observacoes && (
                  <p className="whitespace-pre-wrap break-words text-zinc-600">
                    <strong>Obs.:</strong> {p.observacoes}
                  </p>
                )}
              </div>
            )}

            {p.pago_em && (
              <p className="text-base text-green-700">
                Pago em {formatarPrazo(p.pago_em)}.
              </p>
            )}

            {p.parcelas.length > 1 && (
              <details className="rounded-lg bg-zinc-50 px-3 py-2">
                <summary className="cursor-pointer text-lg font-medium text-zinc-800">
                  {p.parcelas.length} parcelas mensais (
                  {p.parcelas.filter((x) => x.status === "pago").length} pagas)
                </summary>
                <ul className="flex flex-col gap-1 pt-2">
                  {p.parcelas.map((parc) => {
                    const atrasada =
                      parc.status === "pendente" && parc.vencimento < new Date().toISOString().slice(0, 10);
                    return (
                      <li
                        key={parc.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-zinc-200/60"
                      >
                        <span className="text-lg text-zinc-800">
                          {parc.numero}/{p.parcelas.length} · {formatarPrazo(parc.vencimento)} ·{" "}
                          <strong>{brl.format(parc.valor)}</strong>{" "}
                          {parc.status === "pago" ? (
                            <span className="text-base font-medium text-green-700">paga</span>
                          ) : atrasada ? (
                            <span className="text-base font-semibold text-red-700">atrasada</span>
                          ) : (
                            <span className="text-base text-amber-700">pendente</span>
                          )}
                        </span>
                        {p.status !== "cancelado" && (
                          <button
                            type="button"
                            disabled={agindo}
                            onClick={() =>
                              comTransicao(p.id, () =>
                                alternarParcela(parc.id, parc.status !== "pago")
                              )
                            }
                            className={cn(
                              "flex min-h-10 items-center rounded-lg px-3 text-base font-medium transition-colors disabled:opacity-60",
                              parc.status === "pago"
                                ? "text-zinc-600 hover:bg-zinc-100"
                                : "bg-green-600 text-white hover:bg-green-700"
                            )}
                          >
                            {parc.status === "pago" ? "Desmarcar" : "Dar baixa"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}

            {editando ? (
              <div className="border-t border-zinc-100 pt-3">
                <PropostaForm proposta={p} alunos={alunos} eventos={eventos} cursosSugeridos={cursosSugeridos} />
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
                {p.status !== "cancelado" && (
                  <button
                    type="button"
                    disabled={agindo}
                    onClick={() => comTransicao(p.id, () => alternarPago(p.id, p.status !== "pago"))}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg px-4 text-lg font-medium text-white transition-colors disabled:opacity-60",
                      p.status === "pago"
                        ? "bg-zinc-500 hover:bg-zinc-600"
                        : "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    {p.status === "pago" ? (
                      <Undo2 size={18} aria-hidden="true" />
                    ) : (
                      <BadgeCheck size={18} aria-hidden="true" />
                    )}
                    {agindo
                      ? "Salvando…"
                      : p.status === "pago"
                        ? "Voltar para pendente"
                        : "Marcar como pago"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditandoId(p.id)}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-lg font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
                >
                  <Pencil size={18} aria-hidden="true" />
                  Editar
                </button>
                {p.sheet_url && (
                  <a
                    href={p.sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-lg font-medium text-[#2195B9] transition-colors hover:bg-[#2195B9]/10"
                  >
                    <ExternalLink size={18} aria-hidden="true" />
                    Abrir planilha
                  </a>
                )}
                <button
                  type="button"
                  disabled={agindo}
                  onClick={() => handleExcluir(p)}
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

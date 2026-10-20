"use client";

// src/app/(dashboard)/financeiro/pagar/pagar-list.tsx
// Cards das contas a pagar da Ectolab: selo de situação, vencimento com
// destaque de atraso, método + ações (dar baixa, editar, excluir).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BadgeCheck, CheckCircle2, Pencil, Search, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { alternarContaPaga, excluirConta, excluirDebito } from "./actions";
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

function mesDaConta(vencimento: string | null): string {
  return vencimento ? vencimento.slice(0, 7) : "sem-vencimento";
}

function rotuloMes(mes: string): string {
  if (mes === "sem-vencimento") return "Sem vencimento";
  const rotulo = format(new Date(`${mes}-01T00:00:00`), "MMMM 'de' yyyy", {
    locale: ptBR,
  });
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

export default function PagarList({ contas }: { contas: Conta[] }) {
  const router = useRouter();
  const meses = [...new Set(contas.map((conta) => mesDaConta(conta.vencimento)))].sort(
    (a, b) => {
      if (a === "sem-vencimento") return 1;
      if (b === "sem-vencimento") return -1;
      return a.localeCompare(b);
    }
  );
  const mesAtual = hoje().slice(0, 7);
  const mesInicial = meses.includes(mesAtual) ? mesAtual : meses[0] ?? "todos";
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [agindoId, setAgindoId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"pendente" | "atrasada" | "pago" | "todos">("pendente");
  const [mesSelecionado, setMesSelecionado] = useState(mesInicial);
  const [, startTransition] = useTransition();

  // Posição dentro da repetição mensal (2/12 etc.), calculada pela mãe
  // do débito; grupos legados continuam funcionando até serem migrados.
  const posicaoNoGrupo = new Map<number, { indice: number; total: number }>();
  const grupos = new Map<string, typeof contas>();
  for (const c of contas) {
    const chave = c.debito_id ? `debito-${c.debito_id}` : c.grupo_recorrencia;
    if (!chave) continue;
    const lista = grupos.get(chave) ?? [];
    lista.push(c);
    grupos.set(chave, lista);
  }
  for (const lista of grupos.values()) {
    const ordenada = [...lista].sort((a, b) =>
      (a.vencimento ?? "").localeCompare(b.vencimento ?? "")
    );
    ordenada.forEach((c, i) => posicaoNoGrupo.set(c.id, { indice: i + 1, total: ordenada.length }));
  }

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

  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const contasFiltradas = contas.filter((conta) => {
    const atrasada = conta.status === "pendente" && Boolean(conta.vencimento && conta.vencimento < hoje());
    const passaFiltro =
      filtro === "todos" ||
      (filtro === "pendente" && conta.status === "pendente") ||
      (filtro === "atrasada" && atrasada) ||
      (filtro === "pago" && conta.status === "pago");
    const texto = `${conta.titulo} ${conta.fornecedor ?? ""}`.toLocaleLowerCase("pt-BR");
    const passaMes = mesSelecionado === "todos" || mesDaConta(conta.vencimento) === mesSelecionado;
    return passaMes && passaFiltro && (!termo || texto.includes(termo));
  });

  return (
    <div className="flex flex-col gap-3">
      {feedback && (
        <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-lg text-zinc-700">
          {feedback}
        </p>
      )}
      <section aria-label="Selecionar mês" className="rounded-2xl bg-white p-3 ring-1 ring-zinc-200/60">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {meses.map((mes) => {
            const quantidade = contas.filter((conta) => mesDaConta(conta.vencimento) === mes).length;
            return (
              <button
                key={mes}
                type="button"
                onClick={() => setMesSelecionado(mes)}
                aria-pressed={mesSelecionado === mes}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-base font-medium transition-colors",
                  mesSelecionado === mes
                    ? "bg-[#2195B9] text-white"
                    : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                )}
              >
                {rotuloMes(mes)}
                <span className={cn("rounded-full px-2 py-0.5 text-sm", mesSelecionado === mes ? "bg-white/20" : "bg-zinc-200 text-zinc-600")}>
                  {quantidade}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 ring-1 ring-zinc-200/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar por conta ou fornecedor"
            aria-label="Buscar conta ou fornecedor"
            className="min-h-11 w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-3 text-lg text-zinc-900 outline-none transition-colors focus:border-[#2195B9] focus:ring-2 focus:ring-[#2195B9]/20"
          />
        </div>
        <div className="flex flex-wrap gap-1" aria-label="Filtrar contas">
          {([
            ["pendente", "Em aberto"],
            ["atrasada", "Atrasadas"],
            ["pago", "Pagas"],
            ["todos", "Todas"],
          ] as const).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              aria-pressed={filtro === valor}
              className={cn(
                "min-h-10 rounded-lg px-3 text-base font-medium transition-colors",
                filtro === valor ? "bg-[#2195B9] text-white" : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>
      <p className="text-base text-zinc-500">
        {rotuloMes(mesSelecionado)} · {contasFiltradas.length === 1 ? "1 conta encontrada" : `${contasFiltradas.length} contas encontradas`}
      </p>
      {contasFiltradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-10 text-center">
          <CheckCircle2 size={32} aria-hidden="true" className="mx-auto text-zinc-400" />
          <p className="mt-3 text-lg font-medium text-zinc-700">Nenhuma conta nesta visão</p>
          <p className="mt-1 text-base text-zinc-500">Ajuste a busca ou escolha outro filtro.</p>
        </div>
      ) : contasFiltradas.map((c) => {
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
                  {posicaoNoGrupo.has(c.id) && (
                    <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-base font-medium text-violet-700 ring-1 ring-violet-200/60">
                      Mensal {posicaoNoGrupo.get(c.id)!.indice}/{posicaoNoGrupo.get(c.id)!.total}
                    </span>
                  )}
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
                    if (window.confirm(`Excluir somente a parcela "${c.titulo}"? Não dá para desfazer.`)) {
                      comTransicao(c.id, () => excluirConta(c.id));
                    }
                  }}
                  className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-lg font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 size={18} aria-hidden="true" />
                  Excluir parcela
                </button>
                {c.debito_id && (posicaoNoGrupo.get(c.id)?.total ?? 0) > 1 && (
                  <button
                    type="button"
                    disabled={agindo}
                    onClick={() => {
                      const total = posicaoNoGrupo.get(c.id)?.total ?? 0;
                      if (window.confirm(`Excluir o débito inteiro e suas ${total} parcelas? Esta ação não pode ser desfeita.`)) {
                        comTransicao(c.debito_id!, () => excluirDebito(c.debito_id!));
                      }
                    }}
                    className="flex min-h-11 items-center gap-2 rounded-lg bg-red-700 px-4 text-lg font-medium text-white transition-colors hover:bg-red-800 disabled:opacity-60"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                    Excluir débito inteiro
                  </button>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

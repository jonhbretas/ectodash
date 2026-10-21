// Detalhe de um formulário de contrato: link para copiar/compartilhar,
// configurações, respostas com ações e inscritos que ainda não preencheram.
"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, Download, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { formatarCpf, formatarTelefone } from "@/lib/contratos/aluno";
import type { SaldoCota } from "@/lib/contratos/cota";
import {
  aprovarResposta,
  atualizarFormulario,
  cancelarResposta,
  reenviarEmailAdmin,
} from "../../formularios-actions";
import type { ContratoActionState } from "../../actions";
import CamposConfig, { type FormularioConfig } from "../campos-config";

export type RespostaLinha = {
  id: number;
  status: string;
  erro: string | null;
  nome: string;
  email: string;
  cpf: string;
  telefone: string | null;
  criadoEm: string;
  contratoId: number | null;
  contratoStatus: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  recebido: { label: "Recebido", cls: "bg-zinc-100 text-zinc-700 ring-zinc-200" },
  aguardando_aprovacao: { label: "Aguardando você", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  enviado: { label: "Enviado para assinar", cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  erro_envio: { label: "Erro no envio", cls: "bg-red-50 text-red-800 ring-red-200" },
  cancelado: { label: "Cancelado", cls: "bg-zinc-100 text-zinc-500 ring-zinc-200" },
  assinado: { label: "Assinado", cls: "bg-green-50 text-green-800 ring-green-200" },
  recusado: { label: "Recusado", cls: "bg-red-50 text-red-800 ring-red-200" },
};

const initial: ContratoActionState = { ok: true, message: "" };

function statusExibido(r: RespostaLinha): string {
  if (r.status === "enviado" && (r.contratoStatus === "assinado" || r.contratoStatus === "recusado")) {
    return r.contratoStatus;
  }
  return r.status;
}

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function baixarCsv(nome: string, linhas: string[][]) {
  const csv = linhas.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FormularioDetalheClient({
  formulario,
  respostas,
  inscritosSemResposta,
  saldo,
  eventoId,
}: {
  formulario: FormularioConfig & { id: number; link: string; ativo: boolean };
  respostas: RespostaLinha[];
  inscritosSemResposta: Array<{ nome: string; email: string }> | null;
  saldo: SaldoCota | null;
  eventoId: number | null;
}) {
  const [copiado, setCopiado] = useState(false);
  const [config, configAction, configPending] = useActionState(
    atualizarFormulario.bind(null, formulario.id),
    initial
  );
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  const [emAcao, setEmAcao] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filtro, setFiltro] = useState<string>("todos");

  const ativas = respostas.filter((r) => r.status !== "cancelado");
  const pendentes = ativas.filter((r) => r.status === "aguardando_aprovacao" || r.status === "erro_envio");
  const assinados = ativas.filter((r) => r.contratoStatus === "assinado").length;
  const visiveis = respostas.filter((r) => {
    if (filtro === "todos") return true;
    if (filtro === "pendentes") return r.status === "aguardando_aprovacao" || r.status === "erro_envio";
    return statusExibido(r) === filtro;
  });

  function copiar() {
    navigator.clipboard.writeText(formulario.link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  }

  function acao(id: number, fn: (id: number) => Promise<{ ok: boolean; message: string }>, confirmar?: string) {
    if (confirmar && !window.confirm(confirmar)) return;
    setEmAcao(id);
    startTransition(async () => {
      const r = await fn(id);
      setMensagem({ ok: r.ok, texto: r.message });
      setEmAcao(null);
    });
  }

  function aprovarTodos() {
    const restantes = saldo?.restantes ?? 0;
    if (pendentes.length > restantes) {
      setMensagem({ ok: false, texto: `Há ${pendentes.length} pendentes e só ${restantes} envios na cota deste mês.` });
      return;
    }
    if (!window.confirm(`Enviar ${pendentes.length} contrato(s) para assinatura? Usa ${pendentes.length} da cota.`)) return;
    startTransition(async () => {
      let ok = 0;
      for (const r of pendentes) {
        setEmAcao(r.id);
        const res = await aprovarResposta(r.id);
        if (res.ok) ok++;
      }
      setEmAcao(null);
      setMensagem({ ok: ok === pendentes.length, texto: `${ok} de ${pendentes.length} enviados.` });
    });
  }

  const mensagemWhats = encodeURIComponent(
    `Olá! Para emitir seu contrato, preencha seus dados neste link (leva 2 minutos): ${formulario.link}\nDepois é só abrir o e-mail da Assinafy e assinar.`
  );

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Link */}
      <section className="flex flex-col gap-3 rounded-2xl bg-[#e8f4f8] p-5 ring-1 ring-[#2195B9]/20">
        <h2 className="text-xl font-semibold text-zinc-900">
          Link para os alunos {formulario.ativo ? "" : "(encerrado — não aceita respostas)"}
        </h2>
        <p className="break-all rounded-xl bg-white px-4 py-3 font-mono text-base text-zinc-900 ring-1 ring-zinc-200">
          {formulario.link}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copiar}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-[#2195B9] px-5 text-lg font-medium text-white hover:bg-[#28627B]"
          >
            {copiado ? <Check size={20} aria-hidden="true" /> : <Copy size={20} aria-hidden="true" />}
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
          <a
            href={`https://wa.me/?text=${mensagemWhats}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-900 hover:bg-zinc-50"
          >
            <MessageCircle size={20} aria-hidden="true" />
            Enviar no WhatsApp
          </a>
          <a
            href={formulario.link}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-900 hover:bg-zinc-50"
          >
            <ExternalLink size={20} aria-hidden="true" />
            Abrir como aluno
          </a>
        </div>
      </section>

      {/* Resumo */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Preencheram", ativas.length],
          ["Aguardando você", pendentes.length],
          ["Assinados", assinados],
          ["Cota restante", saldo ? `${saldo.restantes}/${saldo.limite}` : "—"],
        ].map(([label, valor]) => (
          <div key={label as string} className="flex flex-col gap-1 rounded-2xl bg-white p-4 ring-1 ring-zinc-200/60">
            <span className="text-base text-zinc-500">{label}</span>
            <span className="text-3xl font-semibold text-zinc-900">{valor}</span>
          </div>
        ))}
      </section>

      {mensagem && (
        <p
          className={`rounded-xl px-4 py-3 text-lg ${mensagem.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
          role="status"
        >
          {mensagem.texto}
        </p>
      )}

      {/* Respostas */}
      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-zinc-900">Quem preencheu</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label="Filtrar respostas"
              className="min-h-12 rounded-xl border border-zinc-200 bg-white px-3 text-base"
            >
              <option value="todos">Todos</option>
              <option value="pendentes">Aguardando você / erro</option>
              <option value="enviado">Enviado para assinar</option>
              <option value="assinado">Assinado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            {pendentes.length > 0 && (
              <button
                type="button"
                onClick={aprovarTodos}
                disabled={isPending}
                className="min-h-12 rounded-xl bg-[#2195B9] px-4 text-base font-medium text-white hover:bg-[#28627B] disabled:opacity-60"
              >
                Aprovar e enviar {pendentes.length} pendente(s)
              </button>
            )}
            {respostas.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  baixarCsv(`respostas-${formulario.id}.csv`, [
                    ["Nome", "CPF", "E-mail", "Telefone", "Preenchido em", "Situação"],
                    ...respostas.map((r) => [
                      r.nome,
                      formatarCpf(r.cpf),
                      r.email,
                      r.telefone ? formatarTelefone(r.telefone) : "",
                      dataHora(r.criadoEm),
                      STATUS[statusExibido(r)]?.label ?? r.status,
                    ]),
                  ])
                }
                className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium hover:bg-zinc-50"
              >
                <Download size={18} aria-hidden="true" />
                Baixar lista
              </button>
            )}
          </div>
        </div>

        {visiveis.length === 0 ? (
          <p className="text-lg text-zinc-500">Ninguém por aqui ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100">
            {visiveis.map((r) => {
              const st = STATUS[statusExibido(r)] ?? STATUS.recebido;
              const carregando = isPending && emAcao === r.id;
              return (
                <li key={r.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-lg font-semibold text-zinc-900">{r.nome}</p>
                    <p className="break-all text-base text-zinc-600">
                      CPF {formatarCpf(r.cpf)} · {r.email}
                      {r.telefone ? ` · ${formatarTelefone(r.telefone)}` : ""}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Preencheu em {dataHora(r.criadoEm)}
                      {r.contratoId ? (
                        <>
                          {" · "}
                          <Link href={`/api/contratos/${r.contratoId}/pdf`} className="underline" prefetch={false}>
                            contrato nº {r.contratoId}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    {r.erro && r.status !== "enviado" && <p className="text-sm text-red-700">{r.erro}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${st.cls}`}>{st.label}</span>
                    {carregando && <Loader2 size={18} className="animate-spin text-[#2195B9]" aria-label="Processando" />}
                    {(r.status === "aguardando_aprovacao" || r.status === "erro_envio") && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          acao(r.id, aprovarResposta, `Enviar o contrato de ${r.nome} para assinatura? Usa 1 da cota.`)
                        }
                        className="min-h-11 rounded-lg bg-[#2195B9] px-3 text-base font-medium text-white disabled:opacity-60"
                      >
                        Aprovar e enviar
                      </button>
                    )}
                    {r.status === "enviado" && r.contratoStatus === "assinando" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => acao(r.id, reenviarEmailAdmin)}
                        className="min-h-11 rounded-lg border border-zinc-300 px-3 text-base font-medium disabled:opacity-60"
                      >
                        Reenviar e-mail
                      </button>
                    )}
                    {r.status !== "cancelado" && r.contratoStatus !== "assinado" && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          acao(
                            r.id,
                            cancelarResposta,
                            `Cancelar a resposta de ${r.nome}? A pessoa poderá preencher de novo (ex.: para corrigir dados).`
                          )
                        }
                        className="min-h-11 rounded-lg px-3 text-base font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Inscritos sem resposta */}
      <section className="flex flex-col gap-3 rounded-2xl bg-white p-5 ring-1 ring-zinc-200/60">
        <h2 className="text-2xl font-semibold text-zinc-900">Inscritos que ainda não preencheram</h2>
        {inscritosSemResposta === null ? (
          <p className="text-lg text-zinc-600">
            {eventoId ? (
              <>
                Vincule os produtos da loja a este evento para comparar inscritos com quem preencheu —{" "}
                <Link href={`/eventos/${eventoId}/contratos`} className="font-medium text-[#2195B9] underline">
                  contratos do evento
                </Link>
                .
              </>
            ) : (
              "Formulário sem evento: não há lista de inscritos para comparar."
            )}
          </p>
        ) : inscritosSemResposta.length === 0 ? (
          <p className="text-lg text-emerald-700">Todos os inscritos da loja já preencheram.</p>
        ) : (
          <>
            <p className="text-base text-zinc-600">
              {inscritosSemResposta.length} comprador(es) do evento sem resposta (comparado pelo e-mail da compra —
              quem preencheu com outro e-mail aparece aqui também).
            </p>
            <ul className="flex max-h-96 flex-col divide-y divide-zinc-100 overflow-y-auto">
              {inscritosSemResposta.map((i) => (
                <li key={i.email} className="flex flex-wrap items-center justify-between gap-2 py-2 text-base">
                  <span className="font-medium text-zinc-900">{i.nome || "—"}</span>
                  <span className="break-all text-zinc-600">{i.email}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Configurações */}
      <details className="rounded-2xl bg-white ring-1 ring-zinc-200/60">
        <summary className="flex min-h-16 cursor-pointer items-center px-5 text-xl font-semibold text-zinc-900">
          Configurações do formulário
        </summary>
        <form action={configAction} className="flex flex-col gap-4 border-t border-zinc-100 p-5">
          <label className="flex items-center gap-3 text-lg font-medium text-zinc-800">
            <input type="checkbox" name="ativo" defaultChecked={formulario.ativo} className="h-6 w-6 accent-[#2195B9]" />
            Aceitando respostas
          </label>
          <CamposConfig valores={formulario} />
          {config.message && (
            <p className={`text-lg ${config.ok ? "text-green-700" : "text-red-700"}`} role="status">
              {config.message}
            </p>
          )}
          <button
            type="submit"
            disabled={configPending}
            className="min-h-14 rounded-xl bg-[#2195B9] px-6 text-lg font-medium text-white hover:bg-[#28627B] disabled:opacity-60"
          >
            {configPending ? "Salvando..." : "Salvar configurações"}
          </button>
        </form>
      </details>
    </div>
  );
}

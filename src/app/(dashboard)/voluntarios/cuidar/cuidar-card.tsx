"use client";

// src/app/(dashboard)/voluntarios/cuidar/cuidar-card.tsx
// Cartão de UMA pessoa para a coordenação de voluntariado: feito para mãos
// idosas e celular — botões grandes (min-h-14), textos grandes, 1 ação por
// vez. WhatsApp abre a conversa com mensagem pronta; "Registrei contato"
// marca a data; "Mudar situação" expande o resto (status, área, afastar,
// desligar, volta).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCheck,
  ChevronDown,
  MessageCircle,
  PencilLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { telefoneParaWhatsApp } from "@/lib/telefone";
import { registrarCuidado } from "./actions";
import type { Engajamento } from "./tipos";

export type Pessoa = {
  id: number;
  nome: string;
  area: string | null;
  situacao: string | null;
  engajamento: Engajamento;
  ultimo_contato_em: string | null;
  telefone1: string | null;
  telefone2: string | null;
  dias_sem_contato: number | null;
};

const SELO: Record<Engajamento, { rotulo: string; cls: string }> = {
  engajado: { rotulo: "Em dia", cls: "bg-green-50 text-green-700 ring-green-200/60" },
  atencao: { rotulo: "Precisa de atenção", cls: "bg-amber-50 text-amber-800 ring-amber-200/70" },
  sumido: { rotulo: "Sumido", cls: "bg-red-50 text-red-700 ring-red-200/70" },
  afastado: { rotulo: "Afastado", cls: "bg-zinc-100 text-zinc-600 ring-zinc-300" },
};

function mensagemWhats(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] || nome;
  return (
    `Olá, ${primeiro}! Aqui é da coordenação de voluntariado da Ectolab. ` +
    `Passando para saber como você está e se está conseguindo contribuir. Pode me contar?`
  );
}

function linkComTexto(phone: string, nome: string): string | null {
  const digitos = telefoneParaWhatsApp(phone);
  if (!digitos) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensagemWhats(nome))}`;
}

export default function CuidarCard({ pessoa, areas }: { pessoa: Pessoa; areas: string[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [novaArea, setNovaArea] = useState("");
  const [, startTransition] = useTransition();

  const selo = SELO[pessoa.engajamento];
  const zap = pessoa.telefone1
    ? linkComTexto(pessoa.telefone1, pessoa.nome)
    : pessoa.telefone2
      ? linkComTexto(pessoa.telefone2, pessoa.nome)
      : null;

  const contatoTexto =
    pessoa.dias_sem_contato === null
      ? "Nunca registramos contato"
      : pessoa.dias_sem_contato === 0
        ? "Contato hoje"
        : pessoa.dias_sem_contato === 1
          ? "Contato ontem"
          : `Sem contato há ${pessoa.dias_sem_contato} dias`;
  const precisaContato =
    pessoa.engajamento !== "afastado" &&
    (pessoa.dias_sem_contato === null || pessoa.dias_sem_contato >= 30);

  function executar(
    tipo: Parameters<typeof registrarCuidado>[1],
    opts?: Parameters<typeof registrarCuidado>[2]
  ) {
    setOcupado(true);
    setFeedback(null);
    startTransition(async () => {
      const res = await registrarCuidado(pessoa.id, tipo, opts);
      setOcupado(false);
      setFeedback(res.message);
      if (res.ok) {
        setMotivo("");
        setNovaArea("");
        router.refresh();
      }
    });
  }

  const btnBase =
    "flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-xl font-semibold transition-colors disabled:opacity-60";

  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
      <div className="flex flex-col gap-1">
        <h3 className="text-2xl font-semibold text-zinc-900">{pessoa.nome}</h3>
        <p className="text-lg text-zinc-600">
          {pessoa.area ?? "Sem área"}
          {pessoa.situacao === "ocioso" ? " · sem atividade" : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className={cn("rounded-full px-3 py-1 text-lg font-semibold ring-1", selo.cls)}>
            {selo.rotulo}
          </span>
          <span className={cn("text-lg", precisaContato ? "font-semibold text-red-700" : "text-zinc-500")}>
            {contatoTexto}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {zap ? (
          <a
            href={zap}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(btnBase, "bg-green-600 text-white hover:bg-green-700")}
          >
            <MessageCircle size={22} aria-hidden="true" />
            WhatsApp
          </a>
        ) : (
          <span className="flex min-h-14 flex-1 items-center justify-center rounded-xl bg-zinc-100 px-4 text-xl text-zinc-500">
            Sem telefone
          </span>
        )}
        <button
          type="button"
          disabled={ocupado}
          onClick={() => executar("contato")}
          className={cn(btnBase, "bg-[#2195B9] text-white hover:bg-[#28627B]")}
        >
          <CheckCheck size={22} aria-hidden="true" />
          {ocupado ? "Salvando…" : "Registrei contato"}
        </button>
      </div>

      {feedback && (
        <p role="status" className="rounded-lg bg-zinc-100 px-3 py-2 text-lg text-zinc-700">
          {feedback}
        </p>
      )}

      <details className="rounded-xl bg-zinc-50 px-3 py-2">
        <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-xl font-medium text-zinc-800">
          <PencilLine size={20} aria-hidden="true" />
          Mudar situação
          <ChevronDown size={18} aria-hidden="true" className="text-zinc-400" />
        </summary>
        <div className="flex flex-col gap-3 pt-3">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Engajamento">
            {(
              [
                ["engajado", "Em dia"],
                ["atencao", "Atenção"],
                ["sumido", "Sumido"],
                ["afastado", "Afastado"],
              ] as Array<[Engajamento, string]>
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                disabled={ocupado || pessoa.engajamento === valor}
                onClick={() => executar("ajuste", { engajamento: valor })}
                className={cn(
                  "min-h-14 rounded-xl border px-3 text-xl font-medium transition-colors disabled:opacity-50",
                  pessoa.engajamento === valor
                    ? "border-[#2195B9] bg-[#2195B9]/10 text-[#28627B]"
                    : "border-zinc-300 bg-white text-zinc-800"
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`area-${pessoa.id}`} className="text-lg font-medium text-zinc-700">
              Trocar de área
            </label>
            <div className="flex gap-2">
              <input
                id={`area-${pessoa.id}`}
                value={novaArea}
                onChange={(e) => setNovaArea(e.target.value)}
                list={`areas-${pessoa.id}`}
                placeholder="Nova área…"
                className="min-h-14 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-xl text-zinc-900"
              />
              <datalist id={`areas-${pessoa.id}`}>
                {areas.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
              <button
                type="button"
                disabled={ocupado || novaArea.trim().length < 2}
                onClick={() => executar("troca_area", { area: novaArea.trim() })}
                className="min-h-14 rounded-xl bg-zinc-900 px-5 text-xl font-medium text-white disabled:opacity-50"
              >
                Trocar
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={`motivo-${pessoa.id}`} className="text-lg font-medium text-zinc-700">
              Afastar ou desligar (escreva o motivo)
            </label>
            <input
              id={`motivo-${pessoa.id}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: pediu um tempo por saúde…"
              maxLength={500}
              className="min-h-14 rounded-xl border border-zinc-300 bg-white px-4 text-xl text-zinc-900"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={ocupado || motivo.trim().length < 3}
                onClick={() => executar("afastamento", { detalhes: motivo.trim() })}
                className="min-h-14 flex-1 rounded-xl border border-amber-300 bg-amber-50 px-3 text-xl font-medium text-amber-900 disabled:opacity-50"
              >
                Afastar
              </button>
              <button
                type="button"
                disabled={ocupado || motivo.trim().length < 3}
                onClick={() => {
                  if (window.confirm(`Desligar ${pessoa.nome}? Dá para reativar depois.`)) {
                    executar("desligamento", { detalhes: motivo.trim() });
                  }
                }}
                className="min-h-14 flex-1 rounded-xl border border-red-300 bg-red-50 px-3 text-xl font-medium text-red-800 disabled:opacity-50"
              >
                Desligar
              </button>
              {pessoa.engajamento === "afastado" && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => executar("retorno")}
                  className="min-h-14 flex-1 rounded-xl bg-green-600 px-3 text-xl font-medium text-white disabled:opacity-50"
                >
                  Voltou
                </button>
              )}
            </div>
          </div>
        </div>
      </details>
    </article>
  );
}

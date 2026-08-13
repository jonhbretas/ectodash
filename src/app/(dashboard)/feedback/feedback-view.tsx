"use client";

// src/app/(dashboard)/feedback/feedback-view.tsx
// Listagem dos relatos com filtros por tipo e status. O coordenador geral
// vê o autor e pode trocar o status de acompanhamento via formulário
// nativo (server action) — o restante vê somente os próprios envios.
import { useMemo, useState } from "react";
import { Bug, CheckCircle2, Clock3, Eye, Lightbulb, MessageSquareWarning } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { atualizarStatusFeedback } from "./feedback-actions";

export type RelatoRow = {
  id: string;
  tipo: "bug" | "sugestao";
  mensagem: string;
  pagina: string | null;
  navegador: string | null;
  status: "novo" | "visto" | "resolvido";
  createdAt: string;
  autor: string;
  anexos: { nome: string; url: string }[];
};

type FiltroTipo = "todos" | "bug" | "sugestao";
type FiltroStatus = "todos" | "novo" | "visto" | "resolvido";

const TIPO_CONFIG: Record<
  "bug" | "sugestao",
  { label: string; Icon: typeof Bug; className: string }
> = {
  bug: { label: "Bug", Icon: Bug, className: "text-red-700" },
  sugestao: { label: "Sugestão", Icon: Lightbulb, className: "text-amber-600" },
};

const STATUS_CONFIG: Record<
  "novo" | "visto" | "resolvido",
  { label: string; Icon: typeof Clock3; className: string }
> = {
  novo: { label: "Novo", Icon: Clock3, className: "text-[#2195B9]" },
  visto: { label: "Visto", Icon: Eye, className: "text-zinc-600" },
  resolvido: { label: "Resolvido", Icon: CheckCircle2, className: "text-green-700" },
};

function formatarData(iso: string): string {
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function FiltroBotao({
  ativo,
  onClick,
  label,
  contagem,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
  contagem?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]",
        ativo
          ? "bg-[#2195B9] text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)]"
          : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      {label}
      {contagem !== undefined && contagem > 0 && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            ativo ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
          )}
        >
          {contagem}
        </span>
      )}
    </button>
  );
}

export default function FeedbackView({
  relatos,
  isCoordenador,
}: {
  relatos: RelatoRow[];
  isCoordenador: boolean;
}) {
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");

  const filtrados = useMemo(() => {
    return relatos.filter((r) => {
      if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
      if (filtroStatus !== "todos" && r.status !== filtroStatus) return false;
      return true;
    });
  }, [relatos, filtroTipo, filtroStatus]);

  const contar = (tipo: FiltroTipo, status: FiltroStatus) =>
    relatos.filter(
      (r) => (tipo === "todos" || r.tipo === tipo) && (status === "todos" || r.status === status)
    ).length;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <FiltroBotao
          ativo={filtroTipo === "todos"}
          onClick={() => setFiltroTipo("todos")}
          label="Todos"
          contagem={contar("todos", "todos")}
        />
        <FiltroBotao
          ativo={filtroTipo === "bug"}
          onClick={() => setFiltroTipo("bug")}
          label="Bugs"
          contagem={contar("bug", "todos")}
        />
        <FiltroBotao
          ativo={filtroTipo === "sugestao"}
          onClick={() => setFiltroTipo("sugestao")}
          label="Sugestões"
          contagem={contar("sugestao", "todos")}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FiltroBotao
          ativo={filtroStatus === "todos"}
          onClick={() => setFiltroStatus("todos")}
          label="Qualquer status"
        />
        {(["novo", "visto", "resolvido"] as const).map((s) => (
          <FiltroBotao
            key={s}
            ativo={filtroStatus === s}
            onClick={() => setFiltroStatus(s)}
            label={STATUS_CONFIG[s].label}
            contagem={contar("todos", s)}
          />
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-300 bg-white py-16 text-center">
          <MessageSquareWarning size={48} className="text-zinc-300" aria-hidden="true" />
          <h2 className="text-2xl font-semibold text-zinc-900">
            Nenhum relato por aqui ainda
          </h2>
          <p className="max-w-md text-lg text-zinc-600">
            {isCoordenador
              ? "Quando alguém enviar um bug ou sugestão pelo botão flutuante, ele aparece nesta tela."
              : "Use o botão flutuante no canto inferior direito para reportar um bug ou sugerir uma melhoria."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col rounded-xl border border-zinc-300 bg-white">
          {filtrados.map((r, idx) => {
            const tipo = TIPO_CONFIG[r.tipo];
            const status = STATUS_CONFIG[r.status];
            return (
              <article
                key={r.id}
                className={cn(
                  "flex flex-col gap-3 p-4",
                  idx > 0 && "border-t border-zinc-200"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                        r.tipo === "bug"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      )}
                    >
                      <tipo.Icon size={16} aria-hidden="true" />
                      {tipo.label}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                        r.status === "novo"
                          ? "bg-[#2195B9]/10 text-[#2195B9]"
                          : r.status === "visto"
                            ? "bg-zinc-100 text-zinc-600"
                            : "bg-green-50 text-green-700"
                      )}
                    >
                      <status.Icon size={16} aria-hidden="true" />
                      {status.label}
                    </span>
                  </div>
                  <span className="text-sm text-zinc-500">
                    {formatarData(r.createdAt)}
                    {isCoordenador && <span className="text-zinc-400"> · {r.autor}</span>}
                  </span>
                </div>

                <p className="whitespace-pre-wrap break-words text-xl leading-relaxed text-zinc-900">
                  {r.mensagem}
                </p>

                {r.anexos.length > 0 && (
                  <ul
                    className="grid grid-cols-3 gap-2"
                    aria-label="Imagens anexadas ao relato"
                  >
                    {r.anexos.map((anexo) => (
                      <li key={anexo.url}>
                        <a
                          href={anexo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Abrir ${anexo.nome} em nova aba`}
                          className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                        >
                          <img
                            src={anexo.url}
                            alt={`Imagem anexada: ${anexo.nome}`}
                            className="h-32 w-full rounded-lg border border-zinc-300 bg-zinc-100 object-cover transition-opacity hover:opacity-80"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}

                {(r.pagina || r.navegador) && (
                  <dl className="flex flex-col gap-1 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                    {r.pagina && (
                      <div className="flex flex-wrap gap-1">
                        <dt className="font-medium text-zinc-500">Página:</dt>
                        <dd className="break-all">{r.pagina}</dd>
                      </div>
                    )}
                    {r.navegador && (
                      <div className="flex flex-wrap gap-1">
                        <dt className="font-medium text-zinc-500">Navegador:</dt>
                        <dd className="break-all" title={r.navegador}>
                          {r.navegador.length > 120
                            ? `${r.navegador.slice(0, 120)}…`
                            : r.navegador}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}

                {isCoordenador && (
                  <form
                    action={atualizarStatusFeedback}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="id" value={r.id} />
                    <label
                      htmlFor={`status-${r.id}`}
                      className="text-sm font-medium text-zinc-600"
                    >
                      Status
                    </label>
                    <select
                      id={`status-${r.id}`}
                      name="status"
                      defaultValue={r.status}
                      className="min-h-10 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-sm text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                    >
                      <option value="novo">Novo</option>
                      <option value="visto">Visto</option>
                      <option value="resolvido">Resolvido</option>
                    </select>
                    <button
                      type="submit"
                      className="flex min-h-10 items-center justify-center rounded-lg bg-[#2195B9] px-4 text-sm font-medium text-white transition-colors hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
                    >
                      Salvar
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

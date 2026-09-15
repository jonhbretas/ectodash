"use client";

// src/app/(dashboard)/ouvidoria/ouvidoria-colegiado.tsx
// Painel do colegiado gestor: ciclos mensais (lacrado → aberto →
// concluído), leitura ANONIMIZADA dos relatos e quebra de sigilo
// exclusiva do coordenador geral (com motivo + auditoria).
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive,
  Eye,
  EyeOff,
  FolderLock,
  History,
  LockOpen,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  abrirCiclo,
  atualizarRelato,
  concluirCiclo,
  listarQuebras,
  listarRelatosAnonimos,
  revelarIdentidade,
  type ActionResult,
  type QuebraRow,
  type RelatoAnonimo,
} from "./ouvidoria-actions";
import { CATEGORIA_LABELS, SENTIMENTO_LABELS } from "./ouvidoria-form";

export type CicloColegiado = {
  id: string;
  referencia: string;
  status: string;
  total_relatos: number;
  total_novos: number;
  opened_at: string | null;
  closed_at: string | null;
  resumo_colegiado: string | null;
  encaminhamentos: string | null;
};

const STATUS_CICLO: Record<string, { label: string; className: string }> = {
  coletando: { label: "Lacrado — coletando", className: "bg-zinc-100 text-zinc-600" },
  aberto: { label: "Aberto — em análise", className: "bg-[#2195B9]/10 text-[#2195B9]" },
  concluido: { label: "Concluído", className: "bg-green-50 text-green-700" },
};

const STATUS_RELATO: Record<string, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  encaminhado: "Encaminhado",
  concluido: "Concluído",
};

function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

function formatarReferencia(ref: string): string {
  const [ano, mes] = ref.split("-");
  const nome = format(new Date(Number(ano), Number(mes) - 1, 1), "MMMM/yyyy", {
    locale: ptBR,
  });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

const CONCLUIR_INICIAL: ActionResult = { ok: false };
const ATUALIZAR_INICIAL: ActionResult = { ok: false };

function RelatoCard({
  relato,
  isGeral,
}: {
  relato: RelatoAnonimo;
  isGeral: boolean;
}) {
  const [estado, acao, pendente] = useActionState(atualizarRelato, ATUALIZAR_INICIAL);
  const [motivo, setMotivo] = useState("");
  const [revelando, setRevelando] = useState(false);
  const [revelado, setRevelado] = useState<string | null>(null);
  const [erroRevelar, setErroRevelar] = useState<string | null>(null);
  const [mostrarQuebra, setMostrarQuebra] = useState(false);

  async function handleRevelar() {
    setErroRevelar(null);
    setRevelando(true);
    const res = await revelarIdentidade(relato.id, motivo);
    setRevelando(false);
    if (!res.ok) {
      setErroRevelar(res.error ?? "Falha na quebra de sigilo.");
      return;
    }
    setRevelado(
      res.autor
        ? `${res.autor.full_name?.trim() || "Nome não cadastrado"}${res.autor.email ? ` · ${res.autor.email}` : ""}`
        : "Identidade revelada e registrada em auditoria."
    );
    setMostrarQuebra(false);
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700">
            {CATEGORIA_LABELS[relato.categoria] ?? relato.categoria}
          </span>
          {relato.sentimento && (
            <span className="rounded-full bg-[#2195B9]/10 px-3 py-1 text-sm font-medium text-[#28627B]">
              Sente-se: {SENTIMENTO_LABELS[relato.sentimento] ?? relato.sentimento}
            </span>
          )}
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
            {STATUS_RELATO[relato.status] ?? relato.status}
          </span>
          {relato.identidade_revelada && (
            <span className="flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
              <ShieldAlert size={14} aria-hidden="true" />
              Sigilo quebrado (auditoria)
            </span>
          )}
        </div>
        <span className="text-sm text-zinc-500">{formatarData(relato.created_at)}</span>
      </div>

      <p className="whitespace-pre-wrap break-words text-xl leading-relaxed text-zinc-900">
        {relato.mensagem}
      </p>

      {relato.nota_colegiado && (
        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-lg text-zinc-700">
          <strong>Nota do colegiado:</strong> {relato.nota_colegiado}
        </p>
      )}

      <form action={acao} className="flex flex-wrap items-end gap-2 border-t border-zinc-100 pt-3">
        <input type="hidden" name="relato_id" value={relato.id} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`status-${relato.id}`} className="text-sm font-medium text-zinc-600">
            Acompanhamento
          </label>
          <select
            id={`status-${relato.id}`}
            name="status"
            defaultValue={relato.status}
            className="min-h-10 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-sm text-zinc-900"
          >
            {Object.entries(STATUS_RELATO).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-52 flex-1 flex-col gap-1">
          <label htmlFor={`nota-${relato.id}`} className="text-sm font-medium text-zinc-600">
            Nota do colegiado
          </label>
          <input
            id={`nota-${relato.id}`}
            name="nota"
            defaultValue={relato.nota_colegiado ?? ""}
            placeholder="Encaminhamento, cuidado combinado…"
            maxLength={2000}
            className="min-h-10 rounded-lg border border-zinc-400 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
          />
        </div>
        <button
          type="submit"
          disabled={pendente}
          className="flex min-h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {pendente ? "Salvando…" : "Salvar"}
        </button>
        {estado.error && (
          <p role="alert" className="w-full text-sm text-red-700">
            {estado.error}
          </p>
        )}
      </form>

      {isGeral && (
        <div className="flex flex-col gap-2 rounded-lg bg-red-50/60 px-3 py-2">
          {!mostrarQuebra && !revelado && (
            <button
              type="button"
              onClick={() => setMostrarQuebra(true)}
              className="flex w-fit items-center gap-2 text-sm font-medium text-red-700 hover:underline"
            >
              <Eye size={15} aria-hidden="true" />
              Quebrar sigilo (excepcional, com auditoria)
            </button>
          )}
          {mostrarQuebra && !revelado && (
            <div className="flex flex-col gap-2">
              <label htmlFor={`motivo-${relato.id}`} className="text-sm text-red-800">
                Motivo da quebra (mínimo 10 caracteres — fica registrado com seu nome em
                auditoria):
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id={`motivo-${relato.id}`}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: relato com indícios de mau uso reiterado…"
                  maxLength={1000}
                  className="min-h-10 min-w-52 flex-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-zinc-900"
                />
                <button
                  type="button"
                  disabled={revelando || motivo.trim().length < 10}
                  onClick={handleRevelar}
                  className="flex min-h-10 items-center rounded-lg bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
                >
                  {revelando ? "Revelando…" : "Confirmar quebra"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarQuebra(false);
                    setMotivo("");
                    setErroRevelar(null);
                  }}
                  className="flex min-h-10 items-center rounded-lg px-3 text-sm text-zinc-600 hover:bg-red-100"
                >
                  Cancelar
                </button>
              </div>
              {erroRevelar && (
                <p role="alert" className="text-sm text-red-700">
                  {erroRevelar}
                </p>
              )}
            </div>
          )}
          {revelado && (
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-red-800">
              <EyeOff size={15} aria-hidden="true" />
              Autor: {revelado}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function OuvidoriaColegiado({
  ciclos,
  isGeral,
}: {
  ciclos: CicloColegiado[];
  isGeral: boolean;
}) {
  const router = useRouter();
  const [cicloId, setCicloId] = useState<string>(() => {
    const aberto = ciclos.find((c) => c.status === "aberto");
    if (aberto) return aberto.id;
    return ciclos[0]?.id ?? "";
  });
  const [relatos, setRelatos] = useState<RelatoAnonimo[] | null>(null);
  const [carregando, setCarregando] = useState(() => {
    const aberto = ciclos.find((c) => c.status === "aberto");
    const inicial = aberto ?? ciclos[0];
    return Boolean(inicial && inicial.status !== "coletando");
  });
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, startAbrir] = useTransition();
  const [quebras, setQuebras] = useState<QuebraRow[] | null>(null);
  const [estadoConcluir, acaoConcluir] = useActionState(concluirCiclo, CONCLUIR_INICIAL);

  const ciclo = ciclos.find((c) => c.id === cicloId) ?? null;
  const cicloStatus = ciclo?.status ?? null;

  function selecionarCiclo(id: string) {
    const alvo = ciclos.find((c) => c.id === id);
    setCicloId(id);
    setRelatos(null);
    setErro(null);
    setCarregando(Boolean(alvo && alvo.status !== "coletando"));
  }

  useEffect(() => {
    if (!cicloId || cicloStatus === "coletando" || cicloStatus === null) {
      return;
    }
    let vivo = true;
    listarRelatosAnonimos(cicloId).then((res) => {
      if (!vivo) return;
      setCarregando(false);
      if (!res.ok) {
        setErro(res.error ?? "Falha ao carregar.");
        setRelatos(null);
        return;
      }
      setRelatos(res.relatos ?? []);
    });
    return () => {
      vivo = false;
    };
  }, [cicloId, cicloStatus]);

  useEffect(() => {
    if (!isGeral) return;
    listarQuebras().then((res) => {
      if (res.ok) setQuebras(res.quebras ?? []);
    });
  }, [isGeral]);

  function handleAbrir() {
    if (!cicloId) return;
    startAbrir(async () => {
      const res = await abrirCiclo(cicloId);
      if (!res.ok) {
        setErro(res.error ?? "Falha ao abrir.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="colegiado-titulo"
      className="flex flex-col gap-4 rounded-xl border border-zinc-300 bg-white p-5"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="colegiado-titulo"
          className="flex items-center gap-2 text-2xl font-semibold text-zinc-900"
        >
          <FolderLock size={24} aria-hidden="true" className="text-[#2195B9]" />
          Colegiado gestor — caixinha mensal
        </h2>
        <p className="text-lg text-zinc-600">
          Abertura uma vez por mês, em reunião. Ciclos lacrados não mostram conteúdo.
        </p>
      </div>

      {ciclos.length === 0 ? (
        <p className="text-lg text-zinc-600">
          Nenhum ciclo ainda — o primeiro se forma no primeiro relato enviado.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ciclos mensais">
            {ciclos.map((c) => {
              const cfg = STATUS_CICLO[c.status] ?? STATUS_CICLO.coletando;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === cicloId}
                  onClick={() => selecionarCiclo(c.id)}
                  className={cn(
                    "flex min-h-10 flex-col items-start rounded-xl border px-4 py-2 text-left transition-colors",
                    c.id === cicloId
                      ? "border-[#2195B9] bg-[#2195B9]/5"
                      : "border-zinc-300 bg-white hover:bg-zinc-50"
                  )}
                >
                  <span className="text-base font-semibold text-zinc-900">
                    {formatarReferencia(c.referencia)}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", cfg.className)}>
                    {cfg.label} · {c.total_relatos} relato(s)
                  </span>
                </button>
              );
            })}
          </div>

          {ciclo && (
            <div className="flex flex-col gap-3 rounded-lg bg-zinc-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-lg text-zinc-700">
                  <strong>{formatarReferencia(ciclo.referencia)}</strong> —{" "}
                  {ciclo.total_relatos} relato(s), {ciclo.total_novos} novo(s).
                  {ciclo.opened_at && (
                    <> Aberto em {formatarData(ciclo.opened_at)}.</>
                  )}
                  {ciclo.closed_at && (
                    <> Concluído em {formatarData(ciclo.closed_at)}.</>
                  )}
                </p>
                {ciclo.status === "coletando" && (
                  <button
                    type="button"
                    onClick={handleAbrir}
                    disabled={abrindo}
                    className="flex min-h-10 items-center gap-2 rounded-lg bg-[#2195B9] px-4 text-sm font-medium text-white hover:bg-[#28627B] disabled:opacity-60"
                  >
                    <LockOpen size={16} aria-hidden="true" />
                    {abrindo ? "Abrindo…" : "Abrir caixinha em reunião"}
                  </button>
                )}
              </div>

              {ciclo.status === "coletando" && (
                <p className="flex items-center gap-2 text-lg text-zinc-600">
                  <FolderLock size={18} aria-hidden="true" />
                  Lacrado: o conteúdo só aparece após a abertura em reunião do colegiado.
                </p>
              )}

              {ciclo.status === "aberto" && (
                <form action={acaoConcluir} className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
                  <input type="hidden" name="ciclo_id" value={ciclo.id} />
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
                    <Archive size={18} aria-hidden="true" />
                    Concluir ciclo com resumo da reunião
                  </h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm text-zinc-600">
                      O que o colegiado percebeu?
                      <textarea
                        name="resumo"
                        rows={3}
                        maxLength={4000}
                        defaultValue={ciclo.resumo_colegiado ?? ""}
                        placeholder="Síntese respeitosa, sem expor pessoas…"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-zinc-600">
                      Encaminhamentos (reciclagem institucional)
                      <textarea
                        name="encaminhamentos"
                        rows={3}
                        maxLength={4000}
                        defaultValue={ciclo.encaminhamentos ?? ""}
                        placeholder="O que vamos melhorar no próximo mês…"
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
                      />
                    </label>
                  </div>
                  {estadoConcluir.error && (
                    <p role="alert" className="text-sm text-red-700">
                      {estadoConcluir.error}
                    </p>
                  )}
                  <div>
                    <button
                      type="submit"
                      className="flex min-h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700"
                    >
                      Concluir ciclo
                    </button>
                  </div>
                </form>
              )}

              {(ciclo.status === "concluido" ||
                (ciclo.status === "aberto" &&
                  (ciclo.resumo_colegiado || ciclo.encaminhamentos))) &&
                (ciclo.resumo_colegiado || ciclo.encaminhamentos) && (
                  <div className="flex flex-col gap-1 text-lg text-zinc-700">
                    {ciclo.resumo_colegiado && (
                      <p>
                        <strong>Resumo:</strong> {ciclo.resumo_colegiado}
                      </p>
                    )}
                    {ciclo.encaminhamentos && (
                      <p>
                        <strong>Encaminhamentos:</strong> {ciclo.encaminhamentos}
                      </p>
                    )}
                  </div>
                )}
            </div>
          )}

          {erro && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-lg text-red-700">
              {erro}
            </p>
          )}
          {carregando && <p className="text-lg text-zinc-500">Abrindo relatos…</p>}
          {relatos && relatos.length === 0 && (
            <p className="text-lg text-zinc-600">Nenhum relato neste ciclo.</p>
          )}
          {relatos && relatos.length > 0 && (
            <div className="flex flex-col gap-3">
              {relatos.map((r) => (
                <RelatoCard key={r.id} relato={r} isGeral={isGeral} />
              ))}
            </div>
          )}
        </>
      )}

      {isGeral && quebras && quebras.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <History size={18} aria-hidden="true" />
            Quebras de sigilo registradas ({quebras.length})
          </h3>
          <ul className="flex flex-col gap-1 text-base text-zinc-600">
            {quebras.map((q) => (
              <li key={q.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                {formatarData(q.created_at)} — revelado por{" "}
                <strong>{q.revelado_por_nome ?? "?"}</strong>, autor{" "}
                <strong>{q.autor_nome ?? "?"}</strong>. Motivo: {q.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

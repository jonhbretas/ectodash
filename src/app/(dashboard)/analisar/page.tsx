"use client";

// /analisar — full-width review screen: the AI result is distributed in
// columns (Ata da reunião / Eventos / Demandas, plus a Financeiro column
// when the content had financial entries, and DIPs/Atualizações sections
// below), each with its own scroll. The ata fields and the demandas
// responsáveis/prazos are editable before saving; a single sticky
// "Salvar tudo" footer persists everything at once (salvarTudoDaAnalise).
import { useActionState, useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  Sparkles,
  Upload,
  Wallet,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Save,
  Loader2,
  NotebookPen,
  Users,
  MessageSquareText,
} from "lucide-react";
import {
  analisarComIA,
  salvarTudoDaAnalise,
  type AnalisarState,
  type SaveState,
} from "./actions";

const initialState: AnalisarState = {
  ok: false,
  message: "",
  tipo: null,
  titulo: null,
  resumo: null,
  financeiro: null,
  eventos: null,
  demandas: null,
  ata: null,
  dips: null,
  atualizacoes: null,
  profiles: [],
};

const EMPTY_INPUT = "Cole um texto ou envie um arquivo antes de analisar.";

function prazoFallback(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-3 text-xl font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <Sparkles size={22} aria-hidden="true" />
      {pending ? "Analisando com IA..." : "Analisar com IA"}
    </button>
  );
}

function PendingHint() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p className="text-center text-base text-zinc-700">
      A IA está lendo o conteúdo. Isso pode levar alguns segundos...
    </p>
  );
}

const tipoLabels: Record<string, { label: string; Icon: typeof Wallet }> = {
  financeiro: { label: "Financeiro", Icon: Wallet },
  eventos: { label: "Eventos", Icon: CalendarDays },
  transcricao_reuniao: {
    label: "Transcricao de reuniao",
    Icon: ClipboardList,
  },
  ata_reuniao: { label: "Ata de reuniao", Icon: FileText },
  outro: { label: "Outro", Icon: FileText },
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function AnalisarPage() {
  // Bumping this key remounts the whole flow (action state included), which
  // is what actually returns the user to the input form after
  // "Analisar outro conteúdo" — no effect-synced flags needed.
  const [flowKey, setFlowKey] = useState(0);

  return <AnalyseFlow key={flowKey} onRestart={() => setFlowKey((k) => k + 1)} />;
}

// One full analyse flow: input form → AI call (useActionState) → review
// screen. Remounting this component (key bump) resets the action state.
function AnalyseFlow({ onRestart }: { onRestart: () => void }) {
  const [state, formAction] = useActionState(analisarComIA, initialState);
  const [resetKey, setResetKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);

  const isError = !state.ok && state.message !== "" && state.message !== EMPTY_INPUT;
  const isEmpty = !state.ok && state.message === EMPTY_INPUT;
  const hasResults = state.ok && state.tipo !== null;

  function resetForm() {
    setResetKey((key) => key + 1);
    setArquivoNome(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  if (hasResults) {
    return (
      <ResultsScreen
        key={resetKey}
        state={state}
        onReset={() => {
          resetForm();
          onRestart();
        }}
      />
    );
  }

  // ── Input form screen ──
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 pb-20 pt-8"
    >
      <form
        key={resetKey}
        action={formAction}
        className="flex w-full max-w-md flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <Sparkles size={28} className="text-blue-700" aria-hidden="true" />
            Analisar com IA
          </h1>
          <p className="text-base text-zinc-700">
            Cole um texto ou envie um arquivo (.txt, .csv, .xlsx).
            A IA identifica automaticamente se e financeiro, eventos ou
            atas de reuniao e extrai os dados para voce revisar e salvar.
          </p>
        </div>

        {/* File upload */}
        <div className="flex flex-col gap-2">
          <span className="text-xl font-medium text-zinc-900">
            Arquivo (opcional)
          </span>
          <div className="flex items-center gap-3">
            <label
              htmlFor="arquivo-input"
              className="flex min-h-14 cursor-pointer items-center gap-2 rounded-lg border border-zinc-400 bg-white px-4 py-3 text-lg text-zinc-700 transition-colors hover:bg-zinc-100 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-700"
            >
              <Upload size={20} aria-hidden="true" />
              Escolher arquivo
              <input
                ref={fileInputRef}
                id="arquivo-input"
                type="file"
                name="arquivo"
                accept=".txt,.csv,.xlsx,.xls,.md"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setArquivoNome(file ? file.name : null);
                }}
              />
            </label>
            {arquivoNome ? (
              <span className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-lg text-blue-800">
                {arquivoNome}
                <button
                  type="button"
                  onClick={() => {
                    setArquivoNome(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded text-blue-600 hover:bg-blue-100"
                  aria-label="Remover arquivo"
                >
                  <X size={18} />
                </button>
              </span>
            ) : null}
          </div>
        </div>

        {/* Textarea */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="texto"
            className="text-xl font-medium text-zinc-900"
          >
            Ou cole o conteudo
          </label>
          <textarea
            id="texto"
            name="texto"
            readOnly={false}
            placeholder="Cole aqui o conteudo para a IA analisar..."
            className="min-h-40 w-full rounded-lg border border-zinc-400 bg-white px-4 py-3 text-xl text-zinc-900 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
          {isEmpty && (
            <span className="text-base text-red-700">{state.message}</span>
          )}
        </div>

        {isError && (
          <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle
                size={24}
                className="text-red-700"
                aria-hidden="true"
              />
              <h2 className="text-lg font-semibold text-red-800">
                Nao foi possivel analisar
              </h2>
            </div>
            <p className="text-base text-red-700">{state.message}</p>
          </div>
        )}

        <SubmitButton />

        <div aria-live="polite">
          <PendingHint />
        </div>
      </form>

      {/* Info card about model */}
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white px-5 py-3 text-sm text-zinc-600">
        <p>
          A IA classifica e extrai automaticamente dados financeiros, eventos
          e tarefas de reunioes. O modelo em uso e o configurado na variavel{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">
            AI_MODEL
          </code>{" "}
          no .env (atualmente: mimo-v2.5, gateway OpenCode Go).
        </p>
      </div>
    </main>
  );
}

// ── Results screen ──

type AtaEdit = {
  titulo: string;
  data: string;
  horario: string;
  participantes: string;
  pontos_principais: string;
  deliberacoes: string;
  resumo: string;
};

type DemandaEdit = {
  key: string;
  titulo: string;
  responsavelId: string;
  prazo: string;
  responsavelTexto: string;
  responsavelEncontrado: boolean;
};

type DipEdit = {
  key: string;
  localidade: string;
  pais: string;
  data: string;
  participantes: string;
  observacoes: string;
};

const fieldClassName =
  "min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

function ResultsScreen({
  state,
  onReset,
}: {
  state: AnalisarState;
  onReset: () => void;
}) {
  const temFinanceiro = Boolean(state.financeiro && state.financeiro.length > 0);
  const temEventos = Boolean(state.eventos && state.eventos.length > 0);
  const temDemandas = Boolean(state.demandas && state.demandas.length > 0);
  const temAta = state.ata !== null;
  const temDips = Boolean(state.dips && state.dips.length > 0);
  const temAtualizacoes = Boolean(
    state.atualizacoes && state.atualizacoes.length > 0
  );
  const temAlgo =
    temFinanceiro || temEventos || temDemandas || temAta || temDips || temAtualizacoes;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<
    (SaveState & { ataId: number | null }) | null
  >(null);

  const [ataEdit, setAtaEdit] = useState<AtaEdit>(() => ({
    titulo: state.ata?.titulo ?? "",
    data: state.ata?.data ?? new Date().toISOString().slice(0, 10),
    horario: state.ata?.horario ?? "",
    participantes: (state.ata?.participantes ?? []).join("\n"),
    pontos_principais: (state.ata?.pontos_principais ?? []).join("\n"),
    deliberacoes: (state.ata?.deliberacoes ?? []).join("\n"),
    resumo: state.ata?.resumo ?? "",
  }));

  const [demandaEdits, setDemandaEdits] = useState<DemandaEdit[]>(() =>
    (state.demandas ?? []).map((d) => ({
      key: d.key,
      titulo: d.titulo,
      responsavelId: d.responsavelId ?? "",
      prazo: d.prazoSugerido ?? prazoFallback(),
      responsavelTexto: d.responsavelTexto,
      responsavelEncontrado: d.responsavelEncontrado,
    }))
  );

  const [dipEdits, setDipEdits] = useState<DipEdit[]>(() =>
    (state.dips ?? []).map((d) => ({ ...d }))
  );

  async function salvarTudo() {
    setSaving(true);
    const result = await salvarTudoDaAnalise({
      financeiro: state.financeiro?.map(({ key: _, ...rest }) => rest),
      eventos: state.eventos?.map(({ key: _, ...rest }) => rest),
      demandas: demandaEdits
        .filter((d) => d.titulo.trim().length > 0)
        .map((d) => ({
          titulo: d.titulo,
          responsavelId: d.responsavelId || null,
          prazoSugerido: d.prazo,
          responsavelTexto: d.responsavelTexto || undefined,
        })),
      ata: temAta
        ? {
            titulo: ataEdit.titulo,
            data: ataEdit.data,
            horario: ataEdit.horario,
            participantes: ataEdit.participantes,
            pontos_principais: ataEdit.pontos_principais,
            deliberacoes: ataEdit.deliberacoes,
            resumo: ataEdit.resumo,
          }
        : undefined,
      dips: dipEdits
        .filter((d) => d.localidade.trim() && d.pais.trim())
        .map((d) => ({
          localidade: d.localidade,
          pais: d.pais,
          data: d.data || null,
          participantes:
            d.participantes.trim() === ""
              ? null
              : Number.parseInt(d.participantes, 10),
          observacoes: d.observacoes,
        })),
      atualizacoes: state.atualizacoes ?? undefined,
    });
    setSaved(result);
    setSaving(false);
  }

  const tipoMeta = tipoLabels[state.tipo!] ?? tipoLabels.outro;
  const TIcon = tipoMeta.Icon;

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col gap-6 bg-zinc-50 px-6 pb-24 pt-8"
    >
      {/* Header */}
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Sparkles size={28} className="text-blue-700" aria-hidden="true" />
            <h1 className="text-3xl font-semibold text-zinc-900">
              Resultado da análise
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <TIcon size={24} className="text-blue-700" aria-hidden="true" />
            <div>
              <span className="text-sm font-medium text-blue-700">
                {tipoMeta.label}
              </span>
              <h2 className="text-xl font-semibold text-blue-900">
                {state.titulo}
              </h2>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <X size={22} aria-hidden="true" />
          Analisar outro conteúdo
        </button>
      </header>

      {temAlgo ? (
        <>
          {/* Column distribution: Ata / Eventos / Demandas (+ Financeiro) */}
          <div
            className={`grid w-full grid-cols-1 items-start gap-4 md:grid-cols-2 ${
              temFinanceiro ? "xl:grid-cols-4" : "xl:grid-cols-3"
            }`}
          >
            {/* Ata da reunião — editable quando a IA extraiu a ata */}
            <ResultColumn
              titulo="Ata da reunião"
              Icon={NotebookPen}
              count={temAta ? 1 : null}
            >
              {temAta ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="ata-titulo" className="text-base font-medium text-zinc-900">
                      Título
                    </label>
                    <input
                      id="ata-titulo"
                      value={ataEdit.titulo}
                      onChange={(e) =>
                        setAtaEdit((prev) => ({ ...prev, titulo: e.target.value }))
                      }
                      className={fieldClassName}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="ata-data" className="text-base font-medium text-zinc-900">
                        Data
                      </label>
                      <input
                        id="ata-data"
                        type="date"
                        value={ataEdit.data}
                        onChange={(e) =>
                          setAtaEdit((prev) => ({ ...prev, data: e.target.value }))
                        }
                        className={fieldClassName}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="ata-horario" className="text-base font-medium text-zinc-900">
                        Horário
                      </label>
                      <input
                        id="ata-horario"
                        type="time"
                        value={ataEdit.horario}
                        onChange={(e) =>
                          setAtaEdit((prev) => ({ ...prev, horario: e.target.value }))
                        }
                        className={fieldClassName}
                      />
                    </div>
                  </div>
                  <AtaTextarea
                    id="ata-participantes"
                    label="Participantes (um por linha)"
                    value={ataEdit.participantes}
                    onChange={(v) => setAtaEdit((prev) => ({ ...prev, participantes: v }))}
                  />
                  <AtaTextarea
                    id="ata-pontos"
                    label="Pontos principais (um por linha)"
                    value={ataEdit.pontos_principais}
                    onChange={(v) => setAtaEdit((prev) => ({ ...prev, pontos_principais: v }))}
                  />
                  <AtaTextarea
                    id="ata-deliberacoes"
                    label="Deliberações (um por linha)"
                    value={ataEdit.deliberacoes}
                    onChange={(v) => setAtaEdit((prev) => ({ ...prev, deliberacoes: v }))}
                  />
                  <AtaTextarea
                    id="ata-resumo"
                    label="Resumo"
                    value={ataEdit.resumo}
                    rows={5}
                    onChange={(v) => setAtaEdit((prev) => ({ ...prev, resumo: v }))}
                  />
                  <p className="text-sm text-zinc-500">
                    A ata será salva em Atas de Reuniões com as demandas, DIPs
                    e atualizações abaixo.
                  </p>
                </div>
              ) : (
                <p className="whitespace-pre-line text-lg leading-relaxed text-zinc-800">
                  {state.resumo}
                </p>
              )}
            </ResultColumn>

            {/* Eventos */}
            <ResultColumn
              titulo="Eventos"
              Icon={CalendarDays}
              count={state.eventos?.length ?? 0}
            >
              {temEventos ? (
                <div className="flex flex-col gap-3">
                  {state.eventos!.map((e) => (
                    <div
                      key={e.key}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-zinc-900">
                            {e.titulo}
                          </p>
                          {e.descricao && (
                            <p className="mt-1 text-base text-zinc-700">
                              {e.descricao}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right text-base text-zinc-700">
                          <p className="font-medium">{e.data}</p>
                          {e.local && <p className="mt-0.5">{e.local}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyColumn text="Nenhum evento identificado." />
              )}
            </ResultColumn>

            {/* Demandas — responsável e prazo editáveis */}
            <ResultColumn
              titulo="Demandas"
              Icon={ClipboardList}
              count={state.demandas?.length ?? 0}
            >
              {temDemandas ? (
                <div className="flex flex-col gap-3">
                  {demandaEdits.map((d) => (
                    <div
                      key={d.key}
                      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                    >
                      <p className="text-lg font-semibold text-zinc-900">
                        {d.titulo}
                      </p>
                      {d.responsavelTexto && (
                        <p className="text-base text-zinc-700">
                          No texto:{" "}
                          <span className="font-medium">{d.responsavelTexto}</span>{" "}
                          {d.responsavelEncontrado ? (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-sm font-medium text-green-700 ring-1 ring-green-200/60">
                              <CheckCircle2 size={14} aria-hidden="true" />
                              encontrado no cadastro
                            </span>
                          ) : (
                            <span className="ml-1 text-amber-600">
                              (não encontrado no cadastro)
                            </span>
                          )}
                        </p>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={`resp-${d.key}`}
                          className="text-base font-medium text-zinc-900"
                        >
                          Responsável
                        </label>
                        <select
                          id={`resp-${d.key}`}
                          value={d.responsavelId}
                          onChange={(e) =>
                            setDemandaEdits((prev) =>
                              prev.map((item) =>
                                item.key === d.key
                                  ? { ...item, responsavelId: e.target.value }
                                  : item
                              )
                            )
                          }
                          className={fieldClassName}
                        >
                          <option value="">Sem responsável definido</option>
                          {state.profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.full_name?.trim() || profile.email}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={`prazo-${d.key}`}
                          className="text-base font-medium text-zinc-900"
                        >
                          Prazo
                        </label>
                        <input
                          id={`prazo-${d.key}`}
                          type="date"
                          value={d.prazo}
                          onChange={(e) =>
                            setDemandaEdits((prev) =>
                              prev.map((item) =>
                                item.key === d.key
                                  ? { ...item, prazo: e.target.value }
                                  : item
                              )
                            )
                          }
                          className={fieldClassName}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyColumn text="Nenhuma demanda identificada." />
              )}
            </ResultColumn>

            {/* Financeiro (quando presente) */}
            {temFinanceiro && (
              <ResultColumn
                titulo="Financeiro"
                Icon={Wallet}
                count={state.financeiro!.length}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-lg">
                    <thead>
                      <tr className="border-b border-zinc-200 text-base text-zinc-700">
                        <th className="pb-2 pr-4 font-medium">Descrição</th>
                        <th className="pb-2 pr-4 font-medium">Tipo</th>
                        <th className="pb-2 pr-4 text-right font-medium">
                          Valor
                        </th>
                        <th className="pb-2 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.financeiro!.map((e) => (
                        <tr key={e.key} className="border-b border-zinc-100">
                          <td className="py-2 pr-4 text-zinc-900">
                            {e.descricao}
                            {e.categoria && (
                              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-sm text-zinc-700">
                                {e.categoria}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={
                                e.tipo === "entrada"
                                  ? "text-green-700"
                                  : "text-red-700"
                              }
                            >
                              {e.tipo === "entrada" ? "Entrada" : "Saída"}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right text-zinc-900">
                            {brl.format(e.valor)}
                          </td>
                          <td className="py-2 text-zinc-700">{e.data}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ResultColumn>
            )}
          </div>

          {/* Dinâmica DIP */}
          {temDips && (
            <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <header className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                <Users size={24} className="text-blue-700" aria-hidden="true" />
                <h3 className="text-xl font-semibold text-zinc-900">
                  Dinâmica DIP
                </h3>
                <span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
                  {dipEdits.length} {dipEdits.length === 1 ? "registro" : "registros"}
                </span>
              </header>
              <div className="flex w-full flex-col gap-3">
                {dipEdits.map((dip) => (
                  <div
                    key={dip.key}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4"
                  >
                    <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`dip-localidade-${dip.key}`} className="text-base font-medium text-zinc-900">
                          Localidade
                        </label>
                        <input
                          id={`dip-localidade-${dip.key}`}
                          value={dip.localidade}
                          onChange={(e) =>
                            setDipEdits((prev) =>
                              prev.map((item) =>
                                item.key === dip.key
                                  ? { ...item, localidade: e.target.value }
                                  : item
                              )
                            )
                          }
                          className={fieldClassName}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`dip-pais-${dip.key}`} className="text-base font-medium text-zinc-900">
                          País
                        </label>
                        <input
                          id={`dip-pais-${dip.key}`}
                          value={dip.pais}
                          onChange={(e) =>
                            setDipEdits((prev) =>
                              prev.map((item) =>
                                item.key === dip.key
                                  ? { ...item, pais: e.target.value }
                                  : item
                              )
                            )
                          }
                          className={fieldClassName}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`dip-data-${dip.key}`} className="text-base font-medium text-zinc-900">
                          Data da DIP
                        </label>
                        <input
                          id={`dip-data-${dip.key}`}
                          type="date"
                          value={dip.data}
                          onChange={(e) =>
                            setDipEdits((prev) =>
                              prev.map((item) =>
                                item.key === dip.key
                                  ? { ...item, data: e.target.value }
                                  : item
                              )
                            )
                          }
                          className={fieldClassName}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`dip-participantes-${dip.key}`} className="text-base font-medium text-zinc-900">
                          Participantes
                        </label>
                        <input
                          id={`dip-participantes-${dip.key}`}
                          type="number"
                          min={0}
                          value={dip.participantes}
                          onChange={(e) =>
                            setDipEdits((prev) =>
                              prev.map((item) =>
                                item.key === dip.key
                                  ? { ...item, participantes: e.target.value }
                                  : item
                              )
                            )
                          }
                          className={fieldClassName}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`dip-obs-${dip.key}`} className="text-base font-medium text-zinc-900">
                        Observações
                      </label>
                      <input
                        id={`dip-obs-${dip.key}`}
                        value={dip.observacoes}
                        onChange={(e) =>
                          setDipEdits((prev) =>
                            prev.map((item) =>
                              item.key === dip.key
                                ? { ...item, observacoes: e.target.value }
                                : item
                            )
                          )
                        }
                        className={fieldClassName}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Atualizações de demandas existentes */}
          {temAtualizacoes && (
            <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <header className="flex items-center gap-2 border-b border-zinc-100 pb-3">
                <MessageSquareText size={24} className="text-blue-700" aria-hidden="true" />
                <h3 className="text-xl font-semibold text-zinc-900">
                  Atualizações de demandas existentes
                </h3>
              </header>
              <div className="flex w-full flex-col gap-3">
                {state.atualizacoes!.map((atualizacao, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <span className="text-lg font-semibold text-zinc-900">
                      {atualizacao.titulo}
                    </span>
                    <span className="text-base leading-relaxed text-zinc-700">
                      {atualizacao.comentario}
                    </span>
                    <span className="text-sm text-zinc-500">
                      Será anexado como comentário na demanda existente
                      correspondente.
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sticky save footer */}
          <footer className="sticky bottom-0 z-10 mt-auto w-full">
            <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/95 p-4 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] ring-1 ring-zinc-200/60 backdrop-blur">
              <div className="flex min-w-0 flex-col gap-0.5">
                {saved?.ok ? (
                  <>
                    <p className="flex items-center gap-2 text-xl font-semibold text-green-800">
                      <CheckCircle2 size={22} aria-hidden="true" />
                      Tudo salvo!
                    </p>
                    <p className="text-base text-zinc-600">{saved.message}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-medium text-zinc-900">
                      Revise as colunas e salve tudo de uma vez
                    </p>
                    <p className="text-base text-zinc-600">
                      Ata, eventos, demandas, DIPs e atualizações serão criados
                      juntos.
                    </p>
                  </>
                )}
              </div>

              {saved?.ok ? (
                <div className="flex flex-wrap items-center gap-3">
                  {saved.ataId !== null && (
                    <Link
                      href={`/reunioes/${saved.ataId}`}
                      className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-lg font-medium text-white transition-colors hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      <NotebookPen size={20} aria-hidden="true" />
                      Ver ata
                    </Link>
                  )}
                  {temEventos && (
                    <Link
                      href="/eventos"
                      className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      <CalendarDays size={20} aria-hidden="true" />
                      Ver eventos
                    </Link>
                  )}
                  {temDemandas && (
                    <Link
                      href="/"
                      className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      <ClipboardList size={20} aria-hidden="true" />
                      Ver demandas
                    </Link>
                  )}
                  {temFinanceiro && (
                    <Link
                      href="/financeiro"
                      className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                    >
                      <Wallet size={20} aria-hidden="true" />
                      Ver financeiro
                    </Link>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={salvarTudo}
                  disabled={saving}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-green-700 px-8 text-xl font-medium text-white shadow-[0_1px_3px_rgba(21,128,61,0.25)] transition-all duration-200 hover:bg-green-600 hover:shadow-[0_2px_6px_rgba(21,128,61,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? (
                    <Loader2 size={22} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Save size={22} aria-hidden="true" />
                  )}
                  {saving ? "Salvando..." : "Salvar tudo"}
                </button>
              )}
            </div>

            {saved && !saved.ok && (
              <p
                role="alert"
                className="mt-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-lg text-red-800"
              >
                <AlertCircle size={20} aria-hidden="true" />
                {saved.message}
              </p>
            )}
          </footer>
        </>
      ) : (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <FileText size={48} className="text-zinc-400" aria-hidden="true" />
          <p className="text-xl text-zinc-700">
            Nenhum dado estruturado foi encontrado no conteúdo.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="flex min-h-12 items-center rounded-lg border border-zinc-400 bg-white px-4 py-2 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Analisar outro conteúdo
          </button>
        </div>
      )}
    </main>
  );
}

function AtaTextarea({
  id,
  label,
  value,
  onChange,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-medium text-zinc-900">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`${fieldClassName} min-h-24 resize-y`}
      />
    </div>
  );
}

// ── Result column (Ata / Eventos / Demandas / Financeiro) ──

function ResultColumn({
  titulo,
  Icon,
  count,
  children,
}: {
  titulo: string;
  Icon: typeof Wallet;
  count: number | null;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={titulo}
      className="flex min-h-[24rem] w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <header className="flex items-center gap-2 border-b border-zinc-100 pb-3">
        <Icon size={24} className="text-blue-700" aria-hidden="true" />
        <h3 className="text-xl font-semibold text-zinc-900">{titulo}</h3>
        {count !== null && (
          <span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-base font-medium text-blue-800">
            {count} {count === 1 ? "item" : "itens"}
          </span>
        )}
      </header>
      <div className="max-h-[calc(100vh-24rem)] overflow-y-auto pr-1">
        {children}
      </div>
    </section>
  );
}

function EmptyColumn({ text }: { text: string }) {
  return <p className="text-lg text-zinc-500">{text}</p>;
}

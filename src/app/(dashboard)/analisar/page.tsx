"use client";

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
} from "lucide-react";
import {
  analisarComIA,
  salvarFinanceiroDaAnalise,
  salvarEventosDaAnalise,
  salvarDemandasDaAnalise,
  type AnalisarState,
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
};

const EMPTY_INPUT = "Cole um texto ou envie um arquivo antes de analisar.";

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
  const [state, formAction] = useActionState(analisarComIA, initialState);
  const [resetKey, setResetKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);

  // Save states
  const [savingFinanceiro, setSavingFinanceiro] = useState(false);
  const [savingEventos, setSavingEventos] = useState(false);
  const [savingDemandas, setSavingDemandas] = useState(false);
  const [savedFinanceiro, setSavedFinanceiro] = useState(false);
  const [savedEventos, setSavedEventos] = useState(false);
  const [savedDemandas, setSavedDemandas] = useState(false);
  const [saveMessages, setSaveMessages] = useState<Record<string, string>>({});

  const isError = !state.ok && state.message !== "" && state.message !== EMPTY_INPUT;
  const isEmpty = !state.ok && state.message === EMPTY_INPUT;
  const hasResults = state.ok && state.tipo !== null;

  function resetForm() {
    setResetKey((k) => k + 1);
    setArquivoNome(null);
    setSavedFinanceiro(false);
    setSavedEventos(false);
    setSavedDemandas(false);
    setSaveMessages({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Results screen ──
  if (hasResults) {
    const tipoMeta = tipoLabels[state.tipo!] ?? tipoLabels.outro;
    const TIcon = tipoMeta.Icon;

    return (
      <main
        id="main-content"
        className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 pb-20 pt-8"
      >
        <div className="flex w-full max-w-3xl flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={28} className="text-blue-700" aria-hidden="true" />
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Resultado da analise
                </h1>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="flex min-h-12 items-center gap-2 rounded-lg border border-zinc-400 bg-white px-4 py-2 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              >
                Analisar outro conteudo
              </button>
            </div>

            {/* Tipo badge */}
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

            {/* Resumo */}
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-lg text-zinc-800 whitespace-pre-line">
                {state.resumo}
              </p>
            </div>
          </div>

          {/* Financeiro */}
          {state.financeiro && state.financeiro.length > 0 && (
            <SectionCard
              titulo={`${state.financeiro.length} lancamentos financeiros`}
              Icon={Wallet}
              saving={savingFinanceiro}
              saved={savedFinanceiro}
              saveMessage={saveMessages["financeiro"]}
              onSave={async () => {
                setSavingFinanceiro(true);
                const result = await salvarFinanceiroDaAnalise(
                  state.financeiro!.map(({ key: _, ...rest }) => rest)
                );
                setSavedFinanceiro(true);
                setSavingFinanceiro(false);
                setSaveMessages((prev) => ({
                  ...prev,
                  financeiro: result.message,
                }));
              }}
              savedLink="/financeiro"
              savedLinkLabel="Ver financeiro"
            >
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-lg">
                  <thead>
                    <tr className="border-b border-zinc-200 text-base text-zinc-700">
                      <th className="pb-2 pr-4 font-medium">Descricao</th>
                      <th className="pb-2 pr-4 font-medium">Tipo</th>
                      <th className="pb-2 pr-4 font-medium text-right">Valor</th>
                      <th className="pb-2 font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.financeiro.map((e) => (
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
                            {e.tipo === "entrada" ? "Entrada" : "Saida"}
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
            </SectionCard>
          )}

          {/* Eventos */}
          {state.eventos && state.eventos.length > 0 && (
            <SectionCard
              titulo={`${state.eventos.length} eventos`}
              Icon={CalendarDays}
              saving={savingEventos}
              saved={savedEventos}
              saveMessage={saveMessages["eventos"]}
              onSave={async () => {
                setSavingEventos(true);
                const result = await salvarEventosDaAnalise(
                  state.eventos!.map(({ key: _, ...rest }) => rest)
                );
                setSavedEventos(true);
                setSavingEventos(false);
                setSaveMessages((prev) => ({
                  ...prev,
                  eventos: result.message,
                }));
              }}
              savedLink="/eventos"
              savedLinkLabel="Ver eventos"
            >
              <div className="flex flex-col gap-3">
                {state.eventos.map((e) => (
                  <div
                    key={e.key}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
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
            </SectionCard>
          )}

          {/* Demandas */}
          {state.demandas && state.demandas.length > 0 && (
            <SectionCard
              titulo={`${state.demandas.length} demandas`}
              Icon={ClipboardList}
              saving={savingDemandas}
              saved={savedDemandas}
              saveMessage={saveMessages["demandas"]}
              onSave={async () => {
                setSavingDemandas(true);
                const result = await salvarDemandasDaAnalise(
                  state.demandas!.map(
                    ({ key: _, responsavelTexto: __, prazoTexto: ___, ...rest }) =>
                      rest
                  )
                );
                setSavedDemandas(true);
                setSavingDemandas(false);
                setSaveMessages((prev) => ({
                  ...prev,
                  demandas: result.message,
                }));
              }}
              savedLink="/"
              savedLinkLabel="Ver demandas"
            >
              <div className="flex flex-col gap-3">
                {state.demandas.map((d) => (
                  <div
                    key={d.key}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-zinc-900">
                          {d.titulo}
                        </p>
                        {d.responsavelTexto && (
                          <p className="mt-1 text-base text-zinc-700">
                            Responsavel:{" "}
                            <span className="font-medium">
                              {d.responsavelTexto}
                            </span>
                            {d.responsavelId ? (
                              <CheckCircle2
                                size={16}
                                className="ml-1 inline text-green-600"
                                aria-label="Voluntario encontrado"
                              />
                            ) : (
                              <span className="ml-1 text-amber-600">
                                (nao encontrado)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {d.prazoSugerido && (
                        <p className="shrink-0 text-base font-medium text-zinc-700">
                          Prazo: {d.prazoSugerido}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Outro / no data */}
          {!state.financeiro?.length &&
            !state.eventos?.length &&
            !state.demandas?.length && (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-zinc-200 bg-white p-8 text-center">
                <FileText
                  size={48}
                  className="text-zinc-300"
                  aria-hidden="true"
                />
                <p className="text-xl text-zinc-700">
                  Nenhum dado estruturado foi encontrado no conteudo.
                </p>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex min-h-12 items-center rounded-lg border border-zinc-400 bg-white px-4 py-2 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                >
                  Analisar outro conteudo
                </button>
              </div>
            )}
        </div>
      </main>
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

// ── Section card (Financeiro / Eventos / Demandas results) ──

function SectionCard({
  titulo,
  Icon,
  children,
  saving,
  saved,
  saveMessage,
  onSave,
  savedLink,
  savedLinkLabel,
}: {
  titulo: string;
  Icon: typeof Wallet;
  children: React.ReactNode;
  saving: boolean;
  saved: boolean;
  saveMessage?: string;
  onSave: () => void;
  savedLink: string;
  savedLinkLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon size={24} className="text-blue-700" aria-hidden="true" />
        <h3 className="text-xl font-semibold text-zinc-900">{titulo}</h3>
      </div>

      {children}

      <div className="flex items-center gap-3">
        {!saved ? (
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="flex min-h-12 items-center gap-2 rounded-lg bg-blue-700 px-6 py-2 text-lg font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <CheckCircle2 size={20} aria-hidden="true" />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-lg font-medium text-green-700">
              <CheckCircle2 size={20} aria-hidden="true" />
              Salvo
            </span>
            <Link
              href={savedLink}
              className="text-lg font-medium text-blue-700 underline hover:text-blue-800"
            >
              {savedLinkLabel}
            </Link>
          </div>
        )}
        {saveMessage && (
          <span className="text-base text-zinc-700">{saveMessage}</span>
        )}
      </div>
    </div>
  );
}

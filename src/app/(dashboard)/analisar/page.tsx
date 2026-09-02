"use client";

// /analisar — full-width review screen: the AI result is distributed in
// columns (Ata da reunião / Eventos / Demandas, plus DIPs/Atualizações
// when the content had financial entries, and DIPs/Atualizações sections
// below), each with its own scroll. The ata fields and the demandas
// responsáveis/prazos are editable before saving; a single sticky
// "Salvar tudo" footer persists everything at once (salvarTudoDaAnalise).
import { useActionState, useState, useRef } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Sparkles,
  Upload,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Save,
  Loader2,
  ListChecks,
  NotebookPen,
  Users,
  MessageSquareText,
} from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import {
  analisarComIA,
  salvarTudoDaAnalise,
  aprenderCorrecaoDicionario,
  type AnalisarState,
  type SaveState,
} from "./actions";

const initialState: AnalisarState = {
  ok: false,
  message: "",
  tipo: null,
  titulo: null,
  resumo: null,
  eventos: null,
  demandas: null,
  ata: null,
  dips: null,
  atualizacoes: null,
  pautas: null,
  duplicados: { demandas: {}, eventos: {}, dips: {} },
  voluntarios: [],
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
      className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2195B9] to-[#28627B] px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)] transition-all duration-200 hover:from-[#28627B] hover:to-[#28627B] hover:shadow-[0_4px_12px_rgba(33,149,185,0.35)] hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-70 disabled:translate-y-0"
    >
      <Sparkles size={18} aria-hidden="true" />
      {pending ? "Analisando com IA..." : "Analisar com IA"}
    </button>
  );
}

function PendingHint() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p className="text-center text-sm text-slate-500">
      A IA esta lendo o conteudo. Isso pode levar alguns segundos...
    </p>
  );
}

const tipoLabels: Record<string, { label: string; Icon: LucideIcon }> = {
  eventos: { label: "Eventos", Icon: CalendarDays },
  transcricao_reuniao: {
    label: "Transcricao de reuniao",
    Icon: ClipboardList,
  },
  ata_reuniao: { label: "Ata de reuniao", Icon: FileText },
  outro: { label: "Outro", Icon: FileText },
};

// Datas vindas da IA em ISO (yyyy-MM-dd) → exibição brasileira dd/MM/yyyy.

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
      className="flex flex-1 flex-col items-center gap-6 px-6 py-8 overflow-y-auto"
    >
      <form
        key={resetKey}
        action={formAction}
        className="flex w-full max-w-lg flex-col gap-5"
      >
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2195B9] to-[#28627B] shadow-[0_2px_8px_rgba(33,149,185,0.25)]">
              <Sparkles size={20} className="text-white" aria-hidden="true" strokeWidth={1.75} />
            </div>
            Analisar com IA
          </h1>
          <p className="text-sm text-slate-500">
            Cole um texto ou envie um arquivo (.txt, .csv, .xlsx).
            A IA identifica automaticamente se e eventos ou
            atas de reuniao e extrai os dados para voce revisar e salvar.
          </p>
        </div>

        {/* File upload */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Arquivo (opcional)</span>
          <div className="flex items-center gap-3">
            <label
              htmlFor="arquivo-input"
              className="flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-600 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#2195B9]"
            >
              <Upload size={16} aria-hidden="true" strokeWidth={1.5} />
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
              <span className="flex min-w-0 max-w-full items-center gap-2 rounded-xl bg-[#E6E6E6] px-3 py-2 text-sm font-medium text-[#2195B9] ring-1 ring-[#E6E6E6]/60">
                <span className="truncate">{arquivoNome}</span>
                <button
                  type="button"
                  onClick={() => {
                    setArquivoNome(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#2195B9] hover:bg-[#E6E6E6] transition-colors"
                  aria-label="Remover arquivo"
                >
                  <X size={14} />
                </button>
              </span>
            ) : null}
          </div>
        </div>

        {/* Textarea */}
        <div className="flex flex-col gap-2">
          <label htmlFor="texto" className="text-sm font-medium text-slate-700">Ou cole o conteudo</label>
          <textarea
            id="texto"
            name="texto"
            readOnly={false}
            placeholder="Cole aqui o conteudo para a IA analisar..."
            className="min-h-36 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          />
          {isEmpty && (
            <span className="text-xs text-red-600">{state.message}</span>
          )}
        </div>

        {isError && (
          <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={20} className="text-red-600" aria-hidden="true" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold text-red-800">Nao foi possivel analisar</h2>
            </div>
            <p className="text-sm text-red-700">{state.message}</p>
          </div>
        )}

        <SubmitButton />

        <div aria-live="polite">
          <PendingHint />
        </div>
      </form>

      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-xs text-slate-500">
        <p>
          A IA classifica e extrai automaticamente eventos, tarefas de
          reunioes, atas e registros DIP. Os dados financeiros nao sao
          extraidos aqui: entram apenas pela planilha no modulo Financeiro.
          O modelo em uso e o configurado na variavel{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs font-mono">
            AI_MODEL
          </code>{" "}
          no .env (atualmente: muse-spark-1.2-contributor-free, gateway OpenCode Go).
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
  "min-h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

function ResultsScreen({
  state,
  onReset,
}: {
  state: AnalisarState;
  onReset: () => void;
}) {
  const temEventos = Boolean(state.eventos && state.eventos.length > 0);
  const temDemandas = Boolean(state.demandas && state.demandas.length > 0);
  const temAta = state.ata !== null;
  const temDips = Boolean(state.dips && state.dips.length > 0);
  const temAtualizacoes = Boolean(
    state.atualizacoes && state.atualizacoes.length > 0
  );
  const temPautas = Boolean(state.pautas && state.pautas.length > 0);
  const temAlgo =
    temEventos ||
    temDemandas ||
    temAta ||
    temDips ||
    temAtualizacoes ||
    temPautas;

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

  // Per-item decision for possible duplicates detected server-side:
  // demandas → "pular" | "comentar" | "incrementar" | "criar"
  // eventos/dips → "pular" | "incrementar" | "criar"
  // Incrementar = atualiza o registro existente com as novas informações
  // da transcrição (nada se perde, sem duplicar). Defaults to "incrementar"
  // para duplicados — o usuário pediu que nada se perca por padrão — e
  // "criar" para novos.
  const [demandaAcoes, setDemandaAcoes] = useState<Record<string, "pular" | "comentar" | "incrementar" | "criar">>(() => {
    const map: Record<string, "pular" | "comentar" | "incrementar" | "criar"> = {};
    for (const d of state.demandas ?? []) {
      map[d.key] = state.duplicados.demandas[d.key] ? "incrementar" : "criar";
    }
    return map;
  });
  const [eventoAcoes, setEventoAcoes] = useState<Record<string, "pular" | "incrementar" | "criar">>(() => {
    const map: Record<string, "pular" | "incrementar" | "criar"> = {};
    for (const e of state.eventos ?? []) {
      map[e.key] = state.duplicados.eventos[e.key] ? "incrementar" : "criar";
    }
    return map;
  });
  const [dipAcoes, setDipAcoes] = useState<Record<string, "pular" | "incrementar" | "criar">>(() => {
    const map: Record<string, "pular" | "incrementar" | "criar"> = {};
    for (const d of state.dips ?? []) {
      map[d.key] = state.duplicados.dips[d.key] ? "incrementar" : "criar";
    }
    return map;
  });

  const referencia = ataEdit.titulo.trim()
    ? `${ataEdit.titulo}${ataEdit.data ? ` (${ataEdit.data})` : ""}`
    : (state.titulo ?? "análise");

  async function salvarTudo() {
    setSaving(true);
    // Aprendizado contínuo: se o operador corrigiu manualmente um campo
    // que a IA extraiu errado (ex: DIP "DEEEP" → "DIP", localidade com
    // acento/erro), gravamos no dicionário para a próxima transcrição já
    // vir corrigida pré-IA. Fire-and-forget para não bloquear o salvamento.
    const dipsOriginais = new Map((state.dips ?? []).map((d) => [d.key, d]));
    for (const edited of dipEdits) {
      const orig = dipsOriginais.get(edited.key);
      if (!orig) continue;
      const pares: Array<[string, string]> = [];
      if (orig.localidade.trim() && edited.localidade.trim() && orig.localidade !== edited.localidade) {
        pares.push([orig.localidade, edited.localidade]);
      }
      if (orig.pais.trim() && edited.pais.trim() && orig.pais !== edited.pais) {
        pares.push([orig.pais, edited.pais]);
      }
      // Observações curtas com correção pontual (ex: "DEEEP" → "DIP") também viram termo
      if (
        orig.observacoes.trim() &&
        edited.observacoes.trim() &&
        orig.observacoes !== edited.observacoes &&
        orig.observacoes.length < 120 &&
        edited.observacoes.length < 120
      ) {
        pares.push([orig.observacoes, edited.observacoes]);
      }
      for (const [termo, sig] of pares) {
        aprenderCorrecaoDicionario(termo, sig).catch(() => {});
      }
    }

    const result = await salvarTudoDaAnalise({
      eventos: state.eventos?.map((e) => {
        const acao = eventoAcoes[e.key] ?? "criar";
        return {
          titulo: e.titulo,
          data: e.data,
          local: e.local,
          descricao: e.descricao,
          acao,
          eventoId: state.duplicados.eventos[e.key]?.id ?? null,
        };
      }),
      demandas: demandaEdits
        .filter((d) => d.titulo.trim().length > 0)
        .map((d) => {
          const acao = demandaAcoes[d.key] ?? "criar";
          return {
            titulo: d.titulo,
            responsavelId: d.responsavelId || null,
            prazoSugerido: d.prazo,
            responsavelTexto: d.responsavelTexto || undefined,
            acao,
            demandaId: state.duplicados.demandas[d.key]?.id ?? null,
            comentario:
              acao === "comentar"
                ? `Mencionada novamente em "${referencia}".`
                : acao === "incrementar"
                  ? `Atualizada com novos detalhes da análise "${referencia}".`
                  : null,
          };
        }),
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
          acao: dipAcoes[d.key] ?? "criar",
          dipId: state.duplicados.dips[d.key]?.id ?? null,
        })),
      atualizacoes: state.atualizacoes ?? undefined,
      pautas: state.pautas?.map((p) => ({
        titulo: p.titulo,
        contexto: p.contexto || null,
      })),
    });
    setSaved(result);
    setSaving(false);
  }

  const tipoMeta = tipoLabels[state.tipo!] ?? tipoLabels.outro;
  const TIcon = tipoMeta.Icon;

  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pb-24 pt-8"
    >
      {/* Header */}
      <header className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2195B9] to-[#28627B] shadow-[0_2px_8px_rgba(33,149,185,0.25)]">
              <Sparkles size={20} className="text-white" aria-hidden="true" strokeWidth={1.75} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Resultado da analise
            </h1>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#E6E6E6] bg-[#E6E6E6]/60 px-4 py-2.5">
            <TIcon size={20} className="text-[#2195B9]" aria-hidden="true" strokeWidth={1.5} />
            <div>
              <span className="text-xs font-medium text-[#2195B9]">{tipoMeta.label}</span>
              <h2 className="text-sm font-semibold text-[#28627B]">{state.titulo}</h2>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-600 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <X size={18} aria-hidden="true" strokeWidth={1.5} />
          Analisar outro conteudo
        </button>
      </header>

      {temAlgo ? (
        <>
          {/* Column distribution: Ata / Eventos / Demandas */}
          <div className="grid w-full grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {/* Ata da reunião — editable quando a IA extraiu a ata */}
            <ResultColumn
              titulo="Ata da reunião"
              Icon={NotebookPen}
              count={temAta ? 1 : null}
            >
              {temAta ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="ata-titulo" className="text-xs font-medium text-slate-700">
                      Titulo
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
                      <label htmlFor="ata-data" className="text-xs font-medium text-slate-700">
                        Data
                      </label>
                      <DateInput
                        id="ata-data"
                        value={ataEdit.data}
                        onChange={(e) =>
                          setAtaEdit((prev) => ({ ...prev, data: e.target.value }))
                        }
                        className={fieldClassName}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="ata-horario" className="text-xs font-medium text-slate-700">
                        Horario
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
                  <p className="text-xs text-slate-400">
                    A ata sera salva em Atas de Reunioes com as demandas, DIPs
                    e atualizacoes abaixo.
                  </p>
                </div>
              ) : (
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
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
                  {state.eventos!.map((e) => {
                    const dup = state.duplicados.eventos[e.key];
                    return (
                      <div
                        key={e.key}
                        className={`rounded-xl border p-4 ${
                          dup ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-semibold text-slate-900">
                              {e.titulo}
                            </p>
                            {e.descricao && (
                              <p className="mt-1 text-xs text-slate-600">
                                {e.descricao}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right text-xs text-slate-600">
                            <p className="font-medium">{e.data}</p>
                            {e.local && <p className="mt-0.5">{e.local}</p>}
                          </div>
                        </div>
                        {dup && (
                          <div className="mt-2 flex flex-col gap-1 border-t border-amber-200 pt-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-amber-800">
                                Possivel duplicado: &quot;{dup.titulo}&quot; ja cadastrado.
                              </span>
                              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                                Acao
                                <select
                                  value={eventoAcoes[e.key] ?? "incrementar"}
                                  onChange={(ev) =>
                                    setEventoAcoes((prev) => ({
                                      ...prev,
                                      [e.key]: ev.target.value as "pular" | "incrementar" | "criar",
                                    }))
                                  }
                                  className="min-h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                                >
                                  <option value="incrementar">Atualizar evento — acrescentar novas infos</option>
                                  <option value="pular">Pular (ja existe)</option>
                                  <option value="criar">Criar mesmo assim (duplicar)</option>
                                </select>
                              </label>
                            </div>
                            <p className="text-xs text-zinc-600">
                              {eventoAcoes[e.key] === "incrementar"
                                ? "O evento existente será atualizado com local/descrição/data vindos da transcrição. Nada se perde e não duplica."
                                : eventoAcoes[e.key] === "pular"
                                  ? "O evento existente não será alterado."
                                  : "Um novo evento será criado mesmo havendo um registro parecido."}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                  {demandaEdits.map((d) => {
                    const dup = state.duplicados.demandas[d.key];
                    return (
                      <div
                        key={d.key}
                        className={`flex flex-col gap-2 rounded-xl border p-4 ${
                          dup ? "border-amber-200 bg-amber-50/60" : "border-zinc-200 bg-zinc-50"
                        }`}
                      >
                      <p className="text-sm font-semibold text-slate-900">
                        {d.titulo}
                      </p>
                      {d.responsavelTexto && (
                        <p className="text-xs text-slate-600">
                          No texto:{" "}
                          <span className="font-medium">{d.responsavelTexto}</span>{" "}
                          {d.responsavelEncontrado ? (
                            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200/60">
                              <CheckCircle2 size={12} aria-hidden="true" />
                              encontrado no cadastro
                            </span>
                          ) : (
                            <span className="ml-1 text-xs text-amber-600">
                              (nao encontrado no cadastro)
                            </span>
                          )}
                        </p>
                      )}
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={`resp-${d.key}`}
                          className="text-xs font-medium text-slate-700"
                        >
                          Responsavel
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
                          {state.voluntarios.map((voluntario) => (
                            <option
                              key={voluntario.id}
                              value={String(voluntario.id)}
                            >
                              {voluntario.nome}
                              {!voluntario.temConta ? " (sem acesso)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={`prazo-${d.key}`}
                          className="text-xs font-medium text-slate-700"
                        >
                          Prazo
                        </label>
                        <DateInput
                          id={`prazo-${d.key}`}
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
                      {dup && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-amber-200 pt-2">
                          <span className="text-xs font-medium text-amber-800">
                            Possivel duplicado: &quot;{dup.titulo}&quot; ja cadastrado.
                          </span>
                          <label className="flex items-center gap-1.5 text-xs text-slate-600">
                            Acao
                            <select
                                value={demandaAcoes[d.key] ?? "pular"}
                              onChange={(ev) =>
                                setDemandaAcoes((prev) => ({
                                  ...prev,
                                  [d.key]: ev.target.value as "pular" | "comentar" | "incrementar" | "criar",
                                }))
                              }
                              className="min-h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700"
                            >
                              <option value="pular">Pular (ja existe)</option>
                              <option value="comentar">Mesma tarefa — anexar comentario</option>
                              <option value="incrementar">Incrementar demanda — atualizar detalhes</option>
                              <option value="criar">Criar mesmo assim</option>
                            </select>
                          </label>
                          <p className="w-full text-xs text-zinc-600">
                            {demandaAcoes[d.key] === "comentar"
                              ? "Nenhuma demanda nova será criada; um comentário com a menção desta análise será anexado à demanda existente."
                              : demandaAcoes[d.key] === "incrementar"
                                ? "Os detalhes da demanda existente serão atualizados (prazo, responsável) e um comentário será anexado."
                                : demandaAcoes[d.key] === "pular"
                                  ? "A demanda existente não será alterada."
                                  : "Uma nova demanda será criada mesmo havendo um registro parecido."}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              ) : (
                <EmptyColumn text="Nenhuma demanda identificada." />
              )}
            </ResultColumn>
          </div>

          {/* Dinâmica DIP */}
          {temDips && (
            <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <header className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Users size={20} className="text-[#2195B9]" aria-hidden="true" strokeWidth={1.75} />
                <h3 className="text-sm font-semibold text-slate-900">Dinamica DIP</h3>
                <span className="ml-auto rounded-full bg-[#E6E6E6] px-2.5 py-0.5 text-xs font-medium text-[#2195B9] ring-1 ring-[#E6E6E6]/60">
                  {dipEdits.length} {dipEdits.length === 1 ? "registro" : "registros"}
                </span>
              </header>
              <div className="flex w-full flex-col gap-3">
                {dipEdits.map((dip) => {
                  const dup = state.duplicados.dips[dip.key];
                  return (
                  <div
                    key={dip.key}
                    className={`flex flex-col gap-3 rounded-xl border p-4 ${
                      dup ? "border-amber-200 bg-amber-50/60" : "border-zinc-200"
                    }`}
                  >
                    <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={`dip-localidade-${dip.key}`} className="text-xs font-medium text-slate-700">
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
                        <label htmlFor={`dip-pais-${dip.key}`} className="text-xs font-medium text-slate-700">
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
                        <label htmlFor={`dip-data-${dip.key}`} className="text-xs font-medium text-slate-700">
                          Data da DIP
                        </label>
                        <DateInput
                          id={`dip-data-${dip.key}`}
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
                        <label htmlFor={`dip-participantes-${dip.key}`} className="text-xs font-medium text-slate-700">
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
                      <label htmlFor={`dip-obs-${dip.key}`} className="text-xs font-medium text-slate-700">
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
                    {dup && (
                      <div className="flex flex-col gap-1 border-t border-amber-200 pt-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-amber-800">
                            Possível duplicado: &quot;{dup.localidade}&quot; já cadastrado
                            {dup.data ? ` em ${dup.data}` : ""}.
                          </span>
                          <label className="flex items-center gap-1.5 text-sm text-zinc-700">
                            Ação
                            <select
                              value={dipAcoes[dip.key] ?? "incrementar"}
                              onChange={(ev) =>
                                setDipAcoes((prev) => ({
                                  ...prev,
                                  [dip.key]: ev.target.value as "pular" | "incrementar" | "criar",
                                }))
                              }
                              className="min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm text-zinc-900"
                            >
                              <option value="incrementar">Atualizar DIP — acrescentar novas infos</option>
                              <option value="pular">Pular (já existe)</option>
                              <option value="criar">Criar mesmo assim (duplicar)</option>
                            </select>
                          </label>
                        </div>
                        <p className="w-full text-xs text-zinc-600">
                          {dipAcoes[dip.key] === "incrementar"
                            ? "O DIP existente será atualizado com participantes/observações vindos da transcrição. Nada se perde."
                            : dipAcoes[dip.key] === "pular"
                              ? "O DIP existente não será alterado."
                              : "Um novo registro DIP será criado mesmo havendo um parecido."}
                        </p>
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Atualizações de demandas existentes */}
          {temAtualizacoes && (
            <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <header className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <MessageSquareText size={20} className="text-[#2195B9]" aria-hidden="true" strokeWidth={1.75} />
                <h3 className="text-sm font-semibold text-slate-900">
                  Atualizacoes de demandas existentes
                </h3>
              </header>
              <div className="flex w-full flex-col gap-3">
                {state.atualizacoes!.map((atualizacao, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {atualizacao.titulo}
                    </span>
                    <span className="text-xs leading-relaxed text-slate-600">
                      {atualizacao.comentario}
                    </span>
                    <span className="text-xs text-slate-400">
                      Sera anexado como comentario na demanda existente
                      correspondente.
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Pautas para a próxima reunião */}
          {temPautas && (
            <section className="flex w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
              <header className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <ListChecks size={20} className="text-[#2195B9]" aria-hidden="true" strokeWidth={1.75} />
                <h3 className="text-sm font-semibold text-slate-900">
                  Pautas para a próxima reunião
                </h3>
              </header>
              <div className="flex w-full flex-col gap-3">
                {state.pautas!.map((pauta, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <span className="text-sm font-semibold text-slate-900">
                      {pauta.titulo}
                    </span>
                    {pauta.contexto && (
                      <span className="text-xs leading-relaxed text-slate-600">
                        {pauta.contexto}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      Será adicionada à pauta da próxima reunião.
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sticky save footer */}
          <footer className="sticky bottom-0 z-10 mt-auto w-full">
            <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl bg-white/95 p-4 shadow-[0_-2px_16px_rgba(0,0,0,0.06)] ring-1 ring-slate-200/60 backdrop-blur-xl">
              <div className="flex min-w-0 flex-col gap-0.5">
                {saved?.ok ? (
                  <>
                    <p className="flex items-center gap-2 text-base font-semibold text-green-700">
                      <CheckCircle2 size={18} aria-hidden="true" strokeWidth={1.5} />
                      Tudo salvo!
                    </p>
                    <p className="text-sm text-slate-500">{saved.message}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-900">
                      Revise as colunas e salve tudo de uma vez
                    </p>
                    <p className="text-xs text-slate-500">
                      Ata, eventos, demandas, DIPs e atualizacoes serao criados juntos.
                    </p>
                  </>
                )}
              </div>

              {saved?.ok ? (
                <div className="flex flex-wrap items-center gap-2">
                  {saved.ataId !== null && (
                    <Link
                      href={`/reunioes/${saved.ataId}`}
                      className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2195B9] to-[#FDBA2F] px-4 text-sm font-medium text-white shadow-[0_2px_8px_rgba(33,149,185,0.25)] transition-all duration-200 hover:from-[#28627B] hover:to-[#2195B9]"
                    >
                      <NotebookPen size={16} aria-hidden="true" strokeWidth={1.5} />
                      Ver ata
                    </Link>
                  )}
                  {temEventos && (
                    <Link href="/eventos" className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50">
                      <CalendarDays size={16} aria-hidden="true" strokeWidth={1.5} /> Ver eventos
                    </Link>
                  )}
                  {temDemandas && (
                    <Link href="/" className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50">
                      <ClipboardList size={16} aria-hidden="true" strokeWidth={1.5} /> Ver demandas
                    </Link>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={salvarTudo}
                  disabled={saving}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 text-sm font-medium text-white shadow-[0_2px_8px_rgba(5,150,105,0.25)] transition-all duration-200 hover:from-emerald-700 hover:to-emerald-600 hover:shadow-[0_4px_12px_rgba(5,150,105,0.35)] hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70 disabled:translate-y-0"
                >
                  {saving ? (
                    <Loader2 size={18} aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Save size={18} aria-hidden="true" strokeWidth={1.5} />
                  )}
                  {saving ? "Salvando..." : "Salvar tudo"}
                </button>
              )}
            </div>

            {saved && !saved.ok && (
              <p
                role="alert"
                className="mt-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle size={16} aria-hidden="true" strokeWidth={1.5} />
                {saved.message}
              </p>
            )}
          </footer>
        </>
      ) : (
        <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60">
          <FileText size={48} className="text-slate-300" aria-hidden="true" />
          <p className="text-sm text-slate-600">
            Nenhum dado estruturado foi encontrado no conteudo.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Analisar outro conteudo
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
      <label htmlFor={id} className="text-xs font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`${fieldClassName} min-h-20 resize-y`}
      />
    </div>
  );
}

// ── Result column (Ata / Eventos / Demandas) ──

function ResultColumn({
  titulo,
  Icon,
  count,
  children,
}: {
  titulo: string;
  Icon: LucideIcon;
  count: number | null;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={titulo}
      className="flex min-h-[24rem] w-full flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60"
    >
      <header className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Icon size={20} className="text-[#2195B9]" aria-hidden="true" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        {count !== null && (
          <span className="ml-auto rounded-full bg-[#E6E6E6] px-2.5 py-0.5 text-xs font-medium text-[#2195B9] ring-1 ring-[#E6E6E6]/60">
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
  return <p className="text-sm text-slate-400">{text}</p>;
}

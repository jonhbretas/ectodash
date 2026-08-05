"use client";

// Reuniões AI analysis + review flow. Phase 1 gathers the source (uploaded
// .pdf/.md/.txt file, pasted text, or a Tactiq meeting); analisarTranscricao
// returns the full AI envelope. Phase 2 is the human review gate: the ata
// fields are editable, new demandas have responsável/prazo selects, DIP
// records are editable, and update-mentions are shown read-only (they will
// land as comments on the matching existing demandas). Confirmar persists
// everything via salvarAtaAnalise and navigates to the saved ata.
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileUp,
  Loader2,
  MessageSquareText,
  NotebookPen,
  Sparkles,
  Users,
} from "lucide-react";
import { matchResponsavelRoster, normalize } from "@/lib/ai/match-responsavel";
import {
  analisarTranscricao,
  salvarAtaAnalise,
  type AnalisarTranscricaoState,
  type SalvarAtaState,
} from "../analise-actions";
import type { Meeting } from "@/lib/meetings";

const analiseInitialState: AnalisarTranscricaoState = {
  ok: false,
  message: "",
  analise: null,
  arquivoNome: null,
  texto: null,
};

const salvarInitialState: SalvarAtaState = {
  ok: false,
  message: "",
  ataId: null,
};

// Same roster option shape as the demandas form (demanda-form.tsx): the
// institutional roster is the source of truth for responsáveis; temConta
// flags who has an activated account.
export type VoluntarioOption = {
  id: number;
  nome: string;
  temConta: boolean;
};

type AnaliseFormProps = {
  voluntarios: VoluntarioOption[];
  areas: string[];
  projetos: string[];
  eventosExistentes: { id: number; titulo: string; dataEvento: string }[];
  etiquetas: { id: number; area: string; nome: string }[];
  meetings: Meeting[];
  meetingsError: string | null;
  meetingsConfigured: boolean;
};

function formatMeetingDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AnaliseForm({
  voluntarios,
  areas,
  projetos,
  eventosExistentes,
  etiquetas,
  meetings,
  meetingsError,
  meetingsConfigured,
}: AnaliseFormProps) {
  const router = useRouter();
  const [analiseState, analiseAction] = useActionState(
    analisarTranscricao,
    analiseInitialState
  );
  const [salvarState, salvarAction] = useActionState(
    salvarAtaAnalise,
    salvarInitialState
  );
  const [resetKey, setResetKey] = useState(0);

  const analise = analiseState.analise;

  if (analise) {
    return (
      <ReviewScreen
        key={resetKey}
        analise={analise}
        arquivoNome={analiseState.arquivoNome}
        texto={analiseState.texto ?? ""}
        voluntarios={voluntarios}
        areas={areas}
        projetos={projetos}
        eventosExistentes={eventosExistentes}
        etiquetas={etiquetas}
        salvarState={salvarState}
        salvarAction={salvarAction}
        onBack={() => setResetKey((key) => key + 1)}
        onSaved={(ataId) => router.push(`/reunioes/${ataId}`)}
      />
    );
  }

  return (
    <form
      key={resetKey}
      action={analiseAction}
      className="flex w-full flex-col gap-5"
    >
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <NotebookPen size={30} aria-hidden="true" />
            Analisar reunião por IA
          </h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            Envie a transcrição e a IA separa tudo no lugar certo: resumo da
            ata, deliberações viram demandas, eventos mencionados,
            atualizações de demandas existentes e registros da Dinâmica
            DIP.
          </p>
        </div>
        <Link
          href="/reunioes"
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <ArrowLeft size={22} aria-hidden="true" />
          Voltar às atas
        </Link>
      </header>

      <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
          <FileUp size={24} aria-hidden="true" />
          Enviar transcrição
        </h2>

        <div className="flex flex-col gap-2">
          <label htmlFor="arquivo" className="text-xl font-medium text-zinc-900">
            Arquivo (PDF, Markdown ou texto)
          </label>
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            accept=".pdf,.md,.txt"
            className="block w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg text-zinc-900 file:mr-4 file:min-h-12 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#2195B9] file:px-4 file:text-lg file:font-medium file:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          />
          <p className="text-base text-zinc-600">
            O PDF é convertido para texto — só o texto é salvo (formato leve,
            sem pesar no banco).
          </p>
        </div>

        {meetingsConfigured && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="reuniaoId"
              className="text-xl font-medium text-zinc-900"
            >
              Ou escolha uma reunião gravada no Tactiq
            </label>
            {meetingsError ? (
              <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
                <AlertCircle size={20} aria-hidden="true" />
                {meetingsError}
              </p>
            ) : (
              <select
                id="reuniaoId"
                name="reuniaoId"
                defaultValue=""
                className="min-h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
              >
                <option value="">Escolha uma reunião...</option>
                {meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>
                    {meeting.titulo}
                    {formatMeetingDate(meeting.data)
                      ? ` (${formatMeetingDate(meeting.data)})`
                      : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="texto" className="text-xl font-medium text-zinc-900">
            Ou cole a transcrição
          </label>
          <textarea
            id="texto"
            name="texto"
            placeholder="Cole aqui o texto da transcrição da reunião..."
            className="min-h-40 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          />
        </div>
      </section>

      {analiseState.message && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-lg text-red-800"
        >
          <AlertCircle size={20} aria-hidden="true" />
          {analiseState.message}
        </p>
      )}

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
        <AnalyseSubmitButton />
        <PendingHint />
      </div>
    </form>
  );
}

function AnalyseSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-6 text-xl font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] hover:shadow-[0_2px_6px_rgba(33,149,185,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 size={22} aria-hidden="true" className="animate-spin" />
      ) : (
        <Sparkles size={22} aria-hidden="true" />
      )}
      {pending ? "Analisando..." : "Analisar transcrição"}
    </button>
  );
}

function PendingHint() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <p className="text-lg text-zinc-600">Isso pode levar alguns segundos. Não recarregue a página.</p>;
}

// ---------------------------------------------------------------------------
// Review screen

type ReviewScreenProps = {
  analise: NonNullable<AnalisarTranscricaoState["analise"]>;
  arquivoNome: string | null;
  texto: string;
  voluntarios: VoluntarioOption[];
  areas: string[];
  projetos: string[];
  eventosExistentes: { id: number; titulo: string; dataEvento: string }[];
  etiquetas: { id: number; area: string; nome: string }[];
  salvarState: SalvarAtaState;
  // useActionState-wrapped action: one FormData argument, state bound.
  salvarAction: (formData: FormData) => void;
  onBack: () => void;
  onSaved: (ataId: number) => void;
};

type DemandaReview = {
  id: number;
  incluida: boolean;
  titulo: string;
  responsavelId: string | null;
  prazo: string | null;
  area: string;
  projeto: string;
  // "" | "novo:<index>" | "existente:<id>"
  eventoRef: string;
  etiquetaId: string;
};

type DipReview = {
  id: number;
  localidade: string;
  pais: string;
  data: string;
  participantes: string;
  observacoes: string;
};

type EventoReview = {
  id: number;
  incluido: boolean;
  titulo: string;
  data: string;
  local: string;
  descricao: string;
};

const fieldClassName =
  "min-h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const labelClassName = "text-lg font-medium text-zinc-900";

function ReviewScreen({
  analise,
  arquivoNome,
  texto,
  voluntarios,
  areas,
  projetos,
  eventosExistentes,
  etiquetas,
  salvarState,
  salvarAction,
  onBack,
  onSaved,
}: ReviewScreenProps) {
  const [titulo, setTitulo] = useState(analise.ata.titulo);
  const [dataReuniao, setDataReuniao] = useState(analise.ata.data || "");
  const [horario, setHorario] = useState(analise.ata.horario || "");
  const [participantes, setParticipantes] = useState(
    analise.ata.participantes.join("\n")
  );
  const [pontos, setPontos] = useState(analise.ata.pontos_principais.join("\n"));
  const [deliberacoes, setDeliberacoes] = useState(
    analise.ata.deliberacoes.join("\n")
  );
  const [resumo, setResumo] = useState(analise.ata.resumo);
  const [demandas, setDemandas] = useState<DemandaReview[]>(() => {
    // Eventos desta análise que serão criados de fato — mesmo filtro do
    // save (titulo+data), na mesma ordem — usado para resolver evento_texto
    // e para o índice do ref "novo:<index>".
    const novosEventos = analise.eventos.filter(
      (evento) => evento.titulo.trim() && evento.data
    );

    function resolverEvento(texto: string): string {
      const needle = normalize(texto);
      if (!needle) return "";
      const novoIndex = novosEventos.findIndex(
        (evento) =>
          normalize(evento.titulo).includes(needle) ||
          needle.includes(normalize(evento.titulo))
      );
      if (novoIndex >= 0) return `novo:${novoIndex}`;
      const existente = eventosExistentes.find(
        (evento) =>
          normalize(evento.titulo).includes(needle) ||
          needle.includes(normalize(evento.titulo))
      );
      return existente ? `existente:${existente.id}` : "";
    }

    return analise.demandas.map((demanda, index) => {
      // Roster-based match: returns the volunteer id when the name found a
      // roster row (linked account or not) — same rule as /analisar.
      const match = matchResponsavelRoster(
        demanda.responsavel_texto,
        [],
        voluntarios.map((v) => ({ id: v.id, nome: v.nome, profileId: null }))
      );
      const etiquetaMatch = demanda.etiqueta_texto
        ? etiquetas.find((etiqueta) => {
            const needle = normalize(demanda.etiqueta_texto ?? "");
            return (
              normalize(etiqueta.nome).includes(needle) ||
              needle.includes(normalize(etiqueta.nome))
            );
          })
        : undefined;
      return {
        id: index,
        incluida: true,
        titulo: demanda.titulo,
        responsavelId:
          match.rosterId !== null ? String(match.rosterId) : null,
        prazo: demanda.prazo_sugerido || null,
        area: demanda.area_texto || "",
        projeto: demanda.projeto_texto || "",
        eventoRef: resolverEvento(demanda.evento_texto || ""),
        etiquetaId: etiquetaMatch ? String(etiquetaMatch.id) : "",
      };
    });
  });
  const [dips, setDips] = useState<DipReview[]>(() =>
    analise.dips.map((dip, index) => ({
      id: index,
      localidade: dip.localidade,
      pais: dip.pais,
      data: dip.data || "",
      participantes: dip.participantes === "" ? "" : String(dip.participantes ?? ""),
      observacoes: dip.observacoes || "",
    }))
  );
  const [eventos, setEventos] = useState<EventoReview[]>(() =>
    analise.eventos.map((evento, index) => ({
      id: index,
      incluido: true,
      titulo: evento.titulo,
      data: evento.data || "",
      local: evento.local || "",
      descricao: evento.descricao || "",
    }))
  );

  const salvarDemandas = demandas
    .filter((d) => d.incluida && d.titulo.trim().length > 0)
    .map((d) => ({
      titulo: d.titulo,
      responsavelId: d.responsavelId,
      prazo: d.prazo,
      area: d.area.trim() || null,
      projeto: d.projeto.trim() || null,
      eventoRef: d.eventoRef || null,
      etiquetaId: d.etiquetaId ? Number(d.etiquetaId) : null,
    }));

  const salvarDips = dips
    .filter((d) => d.localidade.trim().length > 0 && d.pais.trim().length > 0)
    .map((d) => ({
      localidade: d.localidade,
      pais: d.pais,
      data: d.data || null,
      participantes:
        d.participantes.trim() === ""
          ? null
          : Number.parseInt(d.participantes, 10),
      observacoes: d.observacoes,
    }));

  const salvarEventos = eventos
    .filter((e) => e.incluido && e.titulo.trim().length > 0)
    .map((e) => ({
      titulo: e.titulo,
      data: e.data || null,
      local: e.local || null,
      descricao: e.descricao || null,
    }));

  // Eventos desta análise disponíveis para vincular às demandas — mesmo
  // predicado do save (incluído + título + data), mesma ordem, para que o
  // índice do ref "novo:<index>" bata com o índice no servidor.
  const novosEventosSelecionaveis = eventos
    .map((evento, index) => ({ evento, index }))
    .filter(
      ({ evento }) =>
        evento.incluido && evento.titulo.trim() && evento.data
    );

  function buildFormData(): FormData {
    const formData = new FormData();
    formData.set("titulo", titulo);
    formData.set("data_reuniao", dataReuniao || new Date().toISOString().slice(0, 10));
    formData.set("horario", horario);
    formData.set("resumo", resumo);
    formData.set("participantes", participantes);
    formData.set("pontos_principais", pontos);
    formData.set("deliberacoes", deliberacoes);
    formData.set("texto", texto);
    formData.set("arquivo_nome", arquivoNome ?? "");
    formData.set("demandas", JSON.stringify(salvarDemandas));
    formData.set("eventos", JSON.stringify(salvarEventos));
    formData.set("atualizacoes", JSON.stringify(analise.atualizacoes));
    formData.set("dips", JSON.stringify(salvarDips));
    return formData;
  }

  // Redirect only after a successful save — a render-time push would be a
  // side effect in render.
  useEffect(() => {
    if (salvarState.ok && salvarState.ataId) {
      onSaved(salvarState.ataId);
    }
  }, [salvarState.ok, salvarState.ataId, onSaved]);

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex w-full flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-zinc-900">
            <Sparkles size={30} aria-hidden="true" className="text-[#2195B9]" />
            Revisar análise da reunião
          </h1>
          <p className="max-w-2xl text-xl text-zinc-500">
            Confira e ajuste o que a IA separou. Tudo abaixo é editável antes
            de salvar.
            {arquivoNome ? ` Fonte: ${arquivoNome}.` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-xl font-medium text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <ArrowLeft size={22} aria-hidden="true" />
          Nova análise
        </button>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          salvarAction(buildFormData());
        }}
        className="flex w-full flex-col gap-6"
      >
        {/* Ata */}
        <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <NotebookPen size={24} aria-hidden="true" />
            Ata da reunião
          </h2>
          <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
              <label htmlFor="titulo" className={labelClassName}>
                Título
              </label>
              <input
                id="titulo"
                name="titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                className={fieldClassName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="data_reuniao" className={labelClassName}>
                Data
              </label>
              <input
                id="data_reuniao"
                name="data_reuniao"
                type="date"
                value={dataReuniao}
                onChange={(e) => setDataReuniao(e.target.value)}
                required
                className={fieldClassName}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="horario" className={labelClassName}>
                Horário
              </label>
              <input
                id="horario"
                name="horario"
                type="time"
                value={horario}
                onChange={(e) => setHorario(e.target.value)}
                className={fieldClassName}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="participantes" className={labelClassName}>
              <span className="flex items-center gap-1.5">
                <Users size={18} aria-hidden="true" />
                Participantes (um por linha)
              </span>
            </label>
            <textarea
              id="participantes"
              name="participantes"
              value={participantes}
              onChange={(e) => setParticipantes(e.target.value)}
              rows={4}
              className={`${fieldClassName} min-h-28`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="pontos_principais" className={labelClassName}>
              Pontos principais (um por linha)
            </label>
            <textarea
              id="pontos_principais"
              name="pontos_principais"
              value={pontos}
              onChange={(e) => setPontos(e.target.value)}
              rows={4}
              className={`${fieldClassName} min-h-28`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="deliberacoes" className={labelClassName}>
              Deliberações (um por linha)
            </label>
            <textarea
              id="deliberacoes"
              name="deliberacoes"
              value={deliberacoes}
              onChange={(e) => setDeliberacoes(e.target.value)}
              rows={4}
              className={`${fieldClassName} min-h-28`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="resumo" className={labelClassName}>
              Resumo
            </label>
            <textarea
              id="resumo"
              name="resumo"
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              rows={5}
              className={`${fieldClassName} min-h-32`}
            />
          </div>
        </section>

        {/* Demandas novas */}
        <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <ArrowRight size={24} aria-hidden="true" />
              Novas demandas
            </h2>
            <span className="text-base text-zinc-500">
              {salvarDemandas.length} serão criadas
            </span>
          </div>
          {demandas.length === 0 ? (
            <p className="text-lg text-zinc-600">
              Nenhuma deliberação com responsável e prazo claros foi
              identificada.
            </p>
          ) : (
            <div className="flex w-full flex-col gap-3">
              {demandas.map((demanda) => (
                <div
                  key={demanda.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${
                    demanda.incluida
                      ? "border-zinc-200 bg-white"
                      : "border-dashed border-zinc-300 bg-zinc-50 opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      id={`demanda-incluida-${demanda.id}`}
                      type="checkbox"
                      checked={demanda.incluida}
                      onChange={() =>
                        setDemandas((prev) =>
                          prev.map((d) =>
                            d.id === demanda.id ? { ...d, incluida: !d.incluida } : d
                          )
                        )
                      }
                      className="h-6 w-6 shrink-0 cursor-pointer accent-[#2195B9]"
                    />
                    <input
                      aria-label={`Título da demanda ${demanda.id + 1}`}
                      value={demanda.titulo}
                      onChange={(e) =>
                        setDemandas((prev) =>
                          prev.map((d) =>
                            d.id === demanda.id ? { ...d, titulo: e.target.value } : d
                          )
                        )
                      }
                      disabled={!demanda.incluida}
                      className={`${fieldClassName} disabled:cursor-not-allowed`}
                    />
                  </div>
                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`demanda-responsavel-${demanda.id}`}
                        className={labelClassName}
                      >
                        Responsável
                      </label>
                      <select
                        id={`demanda-responsavel-${demanda.id}`}
                        value={demanda.responsavelId ?? ""}
                        onChange={(e) =>
                          setDemandas((prev) =>
                            prev.map((d) =>
                              d.id === demanda.id
                                ? { ...d, responsavelId: e.target.value || null }
                                : d
                            )
                          )
                        }
                        disabled={!demanda.incluida}
                        className={`${fieldClassName} disabled:cursor-not-allowed`}
                      >
                        <option value="">Sem responsável definido</option>
                        {voluntarios.map((voluntario) => (
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
                        htmlFor={`demanda-prazo-${demanda.id}`}
                        className={labelClassName}
                      >
                        Prazo
                      </label>
                      <input
                        id={`demanda-prazo-${demanda.id}`}
                        type="date"
                        value={demanda.prazo ?? ""}
                        onChange={(e) =>
                          setDemandas((prev) =>
                            prev.map((d) =>
                              d.id === demanda.id
                                ? { ...d, prazo: e.target.value || null }
                                : d
                            )
                          )
                        }
                        disabled={!demanda.incluida}
                        className={`${fieldClassName} disabled:cursor-not-allowed`}
                      />
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`demanda-area-${demanda.id}`}
                        className={labelClassName}
                      >
                        Área
                      </label>
                      <input
                        id={`demanda-area-${demanda.id}`}
                        list={`demanda-areas-${demanda.id}`}
                        value={demanda.area}
                        onChange={(e) =>
                          setDemandas((prev) =>
                            prev.map((d) =>
                              d.id === demanda.id
                                ? { ...d, area: e.target.value }
                                : d
                            )
                          )
                        }
                        disabled={!demanda.incluida}
                        placeholder="Ex: Paratecnológico"
                        className={`${fieldClassName} disabled:cursor-not-allowed`}
                      />
                      <datalist id={`demanda-areas-${demanda.id}`}>
                        {areas.map((area) => (
                          <option key={area} value={area} />
                        ))}
                      </datalist>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor={`demanda-projeto-${demanda.id}`}
                        className={labelClassName}
                      >
                        Projeto
                      </label>
                      <input
                        id={`demanda-projeto-${demanda.id}`}
                        list={`demanda-projetos-${demanda.id}`}
                        value={demanda.projeto}
                        onChange={(e) =>
                          setDemandas((prev) =>
                            prev.map((d) =>
                              d.id === demanda.id
                                ? { ...d, projeto: e.target.value }
                                : d
                            )
                          )
                        }
                        disabled={!demanda.incluida}
                        placeholder="Ex: Projeto Horta Comunitária"
                        className={`${fieldClassName} disabled:cursor-not-allowed`}
                      />
                      <datalist id={`demanda-projetos-${demanda.id}`}>
                        {projetos.map((projeto) => (
                          <option key={projeto} value={projeto} />
                        ))}
                      </datalist>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label
                        htmlFor={`demanda-evento-${demanda.id}`}
                        className={labelClassName}
                      >
                        Evento relacionado
                      </label>
                      <select
                        id={`demanda-evento-${demanda.id}`}
                        value={demanda.eventoRef}
                        onChange={(e) =>
                          setDemandas((prev) =>
                            prev.map((d) =>
                              d.id === demanda.id
                                ? { ...d, eventoRef: e.target.value }
                                : d
                            )
                          )
                        }
                        disabled={!demanda.incluida}
                        className={`${fieldClassName} disabled:cursor-not-allowed`}
                      >
                        <option value="">Nenhum evento</option>
                        {novosEventosSelecionaveis.map(({ evento, index }) => (
                          <option key={`novo-${index}`} value={`novo:${index}`}>
                            Novo: {evento.titulo}
                          </option>
                        ))}
                        {eventosExistentes.map((evento) => (
                          <option
                            key={`existente-${evento.id}`}
                            value={`existente:${evento.id}`}
                          >
                            {evento.titulo}
                            {evento.dataEvento
                              ? ` — ${evento.dataEvento.slice(8, 10)}/${evento.dataEvento.slice(5, 7)}/${evento.dataEvento.slice(0, 4)}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label
                        htmlFor={`demanda-etiqueta-${demanda.id}`}
                        className={labelClassName}
                      >
                        Etiqueta
                      </label>
                      <select
                        id={`demanda-etiqueta-${demanda.id}`}
                        value={demanda.etiquetaId}
                        onChange={(e) =>
                          setDemandas((prev) =>
                            prev.map((d) =>
                              d.id === demanda.id
                                ? { ...d, etiquetaId: e.target.value }
                                : d
                            )
                          )
                        }
                        disabled={!demanda.incluida}
                        className={`${fieldClassName} disabled:cursor-not-allowed`}
                      >
                        <option value="">Nenhuma etiqueta</option>
                        {etiquetas.map((etiqueta) => (
                          <option
                            key={etiqueta.id}
                            value={String(etiqueta.id)}
                          >
                            {etiqueta.nome} ({etiqueta.area})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Eventos mencionados */}
        <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <CalendarDays size={24} aria-hidden="true" />
              Eventos mencionados
            </h2>
            <span className="text-base text-zinc-500">
              {salvarEventos.length} {salvarEventos.length === 1 ? "evento" : "eventos"}
            </span>
          </div>
          {eventos.length === 0 ? (
            <p className="text-lg text-zinc-600">
              Nenhum evento institucional identificado.
            </p>
          ) : (
            <div className="flex w-full flex-col gap-3">
              {eventos.map((evento) => (
                <div
                  key={evento.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 transition-colors ${
                    evento.incluido
                      ? "border-zinc-200 bg-white"
                      : "border-dashed border-zinc-300 bg-zinc-50 opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      id={`evento-incluido-${evento.id}`}
                      type="checkbox"
                      checked={evento.incluido}
                      onChange={() =>
                        setEventos((prev) =>
                          prev.map((e) =>
                            e.id === evento.id ? { ...e, incluido: !e.incluido } : e
                          )
                        )
                      }
                      className="h-6 w-6 shrink-0 cursor-pointer accent-[#2195B9]"
                    />
                    <input
                      aria-label={`Título do evento ${evento.id + 1}`}
                      value={evento.titulo}
                      onChange={(e2) =>
                        setEventos((prev) =>
                          prev.map((e) =>
                            e.id === evento.id ? { ...e, titulo: e2.target.value } : e
                          )
                        )
                      }
                      disabled={!evento.incluido}
                      className={`${fieldClassName} disabled:cursor-not-allowed`}
                    />
                  </div>
                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`evento-data-${evento.id}`} className={labelClassName}>
                        Data
                      </label>
                      <input
                        id={`evento-data-${evento.id}`}
                        type="date"
                        value={evento.data}
                        onChange={(e2) =>
                          setEventos((prev) =>
                            prev.map((e) =>
                              e.id === evento.id ? { ...e, data: e2.target.value } : e
                            )
                          )
                        }
                        disabled={!evento.incluido}
                        className={`${fieldClassName} disabled:cursor-not-allowed`}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`evento-local-${evento.id}`} className={labelClassName}>
                        Local
                      </label>
                      <input
                        id={`evento-local-${evento.id}`}
                        value={evento.local}
                        onChange={(e2) =>
                          setEventos((prev) =>
                            prev.map((e) =>
                              e.id === evento.id ? { ...e, local: e2.target.value } : e
                            )
                          )
                        }
                        disabled={!evento.incluido}
                        className={`${fieldClassName} disabled:cursor-not-allowed`}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`evento-descricao-${evento.id}`} className={labelClassName}>
                      Descrição
                    </label>
                    <input
                      id={`evento-descricao-${evento.id}`}
                      value={evento.descricao}
                      onChange={(e2) =>
                        setEventos((prev) =>
                          prev.map((e) =>
                            e.id === evento.id ? { ...e, descricao: e2.target.value } : e
                          )
                        )
                      }
                      disabled={!evento.incluido}
                      className={`${fieldClassName} disabled:cursor-not-allowed`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Atualizações de demandas existentes */}
        <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <MessageSquareText size={24} aria-hidden="true" />
            Atualizações de demandas existentes
          </h2>
          {analise.atualizacoes.length === 0 ? (
            <p className="text-lg text-zinc-600">
              Nenhuma menção a demanda existente identificada.
            </p>
          ) : (
            <div className="flex w-full flex-col gap-3">
              {analise.atualizacoes.map((atualizacao, index) => (
                <div
                  key={index}
                  className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <span className="text-lg font-semibold text-zinc-900">
                    {atualizacao.titulo}
                  </span>
                  <span className="text-lg leading-relaxed text-zinc-700">
                    {atualizacao.comentario}
                  </span>
                  <span className="text-base text-zinc-500">
                    Será anexado como comentário na demanda existente
                    correspondente.
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* DIPs */}
        <section className="flex w-full flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
              <Users size={24} aria-hidden="true" />
              Dinâmica DIP
            </h2>
            <span className="text-base text-zinc-500">
              {salvarDips.length} {salvarDips.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          {dips.length === 0 ? (
            <p className="text-lg text-zinc-600">
              Nenhuma menção à Dinâmica DIP identificada.
            </p>
          ) : (
            <div className="flex w-full flex-col gap-3">
              {dips.map((dip) => (
                <div
                  key={dip.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4"
                >
                  <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`dip-localidade-${dip.id}`} className={labelClassName}>
                        Localidade
                      </label>
                      <input
                        id={`dip-localidade-${dip.id}`}
                        value={dip.localidade}
                        onChange={(e) =>
                          setDips((prev) =>
                            prev.map((d) =>
                              d.id === dip.id ? { ...d, localidade: e.target.value } : d
                            )
                          )
                        }
                        className={fieldClassName}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`dip-pais-${dip.id}`} className={labelClassName}>
                        País
                      </label>
                      <input
                        id={`dip-pais-${dip.id}`}
                        value={dip.pais}
                        onChange={(e) =>
                          setDips((prev) =>
                            prev.map((d) =>
                              d.id === dip.id ? { ...d, pais: e.target.value } : d
                            )
                          )
                        }
                        className={fieldClassName}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`dip-data-${dip.id}`} className={labelClassName}>
                        Data da DIP
                      </label>
                      <input
                        id={`dip-data-${dip.id}`}
                        type="date"
                        value={dip.data}
                        onChange={(e) =>
                          setDips((prev) =>
                            prev.map((d) =>
                              d.id === dip.id ? { ...d, data: e.target.value } : d
                            )
                          )
                        }
                        className={fieldClassName}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`dip-participantes-${dip.id}`} className={labelClassName}>
                        Participantes
                      </label>
                      <input
                        id={`dip-participantes-${dip.id}`}
                        type="number"
                        min={0}
                        value={dip.participantes}
                        onChange={(e) =>
                          setDips((prev) =>
                            prev.map((d) =>
                              d.id === dip.id ? { ...d, participantes: e.target.value } : d
                            )
                          )
                        }
                        className={fieldClassName}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`dip-obs-${dip.id}`} className={labelClassName}>
                      Observações
                    </label>
                    <input
                      id={`dip-obs-${dip.id}`}
                      value={dip.observacoes}
                      onChange={(e) =>
                        setDips((prev) =>
                          prev.map((d) =>
                            d.id === dip.id ? { ...d, observacoes: e.target.value } : d
                          )
                        )
                      }
                      className={fieldClassName}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {salvarState.message && (
          <p
            role="alert"
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-lg ${
              salvarState.ok
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {salvarState.ok ? (
              <ArrowRight size={20} aria-hidden="true" />
            ) : (
              <AlertCircle size={20} aria-hidden="true" />
            )}
            {salvarState.message}
          </p>
        )}

        <SaveSubmitButton />
      </form>
    </div>
  );
}

function SaveSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-6 text-xl font-medium text-white shadow-[0_1px_3px_rgba(21,128,61,0.25)] transition-all duration-200 hover:bg-green-600 hover:shadow-[0_2px_6px_rgba(21,128,61,0.3)] active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 size={22} aria-hidden="true" className="animate-spin" />
      ) : (
        <NotebookPen size={22} aria-hidden="true" />
      )}
      {pending ? "Salvando..." : "Salvar ata e lançamentos"}
    </button>
  );
}

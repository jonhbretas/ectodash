"use client";

// Etapas do assistente "Pedir pauta" (D-01). Cada etapa é controlada pelo
// PautaModal (valores + setters por props), assim os dados sobrevivem ao
// navegar com Voltar/Avançar. Tudo em português simples, texto >= 16px,
// alvos de toque >= 48px e navegação completa por teclado.
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  ArrowDown,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock,
  Gavel,
  Loader2,
  Megaphone,
  Minus,
  Paperclip,
  TriangleAlert,
  Upload,
} from "lucide-react";
import DateFieldBr from "@/components/ui/date-field";
import { proximaTerca, HORARIO_REUNIAO } from "@/lib/proxima-reuniao";
import { rotuloStatusReuniao } from "../_lib/format-data";
import type { ReuniaoDisponivel, PautaSimilar } from "../pauta-actions";
import {
  PRIORIDADES,
  QUORUM_PADRAO,
  TIPOS,
  type PautaPrioridade,
  type PautaTipo,
} from "@/lib/pautas/regras";
import { ANEXO_ACCEPT, formatarTamanho } from "@/lib/pautas/anexo";

export const NOMES_ETAPAS = [
  "Assunto",
  "Reunião",
  "Prioridade",
  "Tipo de pauta",
  "Anexo",
  "Revisão",
] as const;

const WEEKDAY_ABBR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatMeetingLabel(m: ReuniaoDisponivel): string {
  const d = new Date(`${m.data_reuniao}T00:00:00`);
  const base = `${WEEKDAY_ABBR[d.getDay()]}, ${d.getDate()} ${MONTH_ABBR[d.getMonth()]} · ${m.horario ? m.horario.slice(0, 5).replace(":", "h") : "19h00"} — ${m.titulo}`;
  return m.status !== null && m.status !== "realizada" ? `${base} (${rotuloStatusReuniao(m.status)})` : base;
}

export function proximaLabel(): string {
  const p = proximaTerca();
  const wd = WEEKDAY_ABBR[p.getDay()];
  return `${wd}, ${String(p.getDate()).padStart(2, "0")} ${MONTH_ABBR[p.getMonth()]} · ${HORARIO_REUNIAO.replace(":", "h")}`;
}

const inputClass =
  "min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const labelClass = "text-base font-medium text-zinc-900";

function ErroCampo({ id, mensagem }: { id: string; mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <p id={id} role="alert" className="flex items-center gap-2 text-base font-medium text-red-700">
      <TriangleAlert size={18} aria-hidden="true" className="shrink-0" />
      {mensagem}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Etapa 1 — assunto + contexto
// ---------------------------------------------------------------------------
export function EtapaAssunto(props: {
  titulo: string;
  setTitulo: (v: string) => void;
  contexto: string;
  setContexto: (v: string) => void;
  erro: string | null;
}) {
  const { titulo, setTitulo, contexto, setContexto, erro } = props;
  const tituloRef = useRef<HTMLInputElement>(null);
  // Foco inicial no assunto ao abrir o assistente (sem o atributo autoFocus).
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="pauta-titulo-modal" className={labelClass}>
          Assunto <span className="text-red-700">*</span>
        </label>
        <input
          id="pauta-titulo-modal"
          ref={tituloRef}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          maxLength={80}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? "pauta-titulo-erro" : undefined}
          placeholder="Sobre o que você quer conversar?"
          className={inputClass}
        />
        <div className="flex items-start justify-between gap-3">
          <ErroCampo id="pauta-titulo-erro" mensagem={erro} />
          <span className="ml-auto text-sm text-zinc-600">{titulo.length}/80</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pauta-contexto-modal" className={labelClass}>
          Contexto (opcional)
        </label>
        <textarea
          id="pauta-contexto-modal"
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
          rows={4}
          maxLength={3000}
          placeholder="Explique melhor o assunto para quem for conduzir a reunião"
          className={`${inputClass} min-h-28 resize-y`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 2 — reunião (+ preferência de horário)
// ---------------------------------------------------------------------------
export function EtapaReuniao(props: {
  loading: boolean;
  reunioes: ReuniaoDisponivel[];
  reuniaoSel: string;
  setReuniaoSel: (v: string) => void;
  showHorario: boolean;
  setShowHorario: (v: boolean) => void;
  dataSolicitada: string;
  setDataSolicitada: (v: string) => void;
  horarioSolicitado: string;
  setHorarioSolicitado: (v: string) => void;
}) {
  const p = props;
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-[#2195B9]/30 bg-[#2195B9]/5 px-4 py-3 text-base leading-relaxed text-[#1d566d]">
        Pedidos até <strong>terça 19h</strong> valem para a reunião de hoje; após 19h entram automaticamente na próxima terça.
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="pauta-reuniao-modal" className={labelClass}>
          Em qual reunião?
        </label>
        {p.loading ? (
          <div className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-600">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando...
          </div>
        ) : (
          <div className="relative">
            <select
              id="pauta-reuniao-modal"
              value={p.reuniaoSel}
              onChange={(e) => p.setReuniaoSel(e.target.value)}
              className={`${inputClass} appearance-none pr-10`}
            >
              <option value="">Próxima reunião — {proximaLabel()}</option>
              {p.reunioes.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatMeetingLabel(r)}
                </option>
              ))}
              <option value="espera">Sem preferência — entrar em espera</option>
            </select>
            <ChevronDown
              size={20}
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
          </div>
        )}
        <p className="text-base text-zinc-600">
          Escolha “Sem preferência” para deixar a pauta em espera até a coordenação incluí-la.
        </p>
      </div>

      {!p.showHorario ? (
        <button
          type="button"
          onClick={() => p.setShowHorario(true)}
          className="min-h-12 self-start rounded-lg px-2 text-base font-medium text-[#1d6f8d] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          Definir preferência de data e horário
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <span className="flex items-center gap-2 text-base font-medium text-zinc-900">
            <CalendarDays size={20} className="text-[#1d6f8d]" aria-hidden="true" /> Quando prefere? (opcional)
          </span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <DateFieldBr
              name="data_solicitada_ui"
              defaultValue={p.dataSolicitada}
              onChange={p.setDataSolicitada}
              className={`${inputClass} sm:flex-1`}
            />
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-zinc-500" aria-hidden="true" />
              <input
                type="time"
                aria-label="Horário preferido"
                step={900}
                value={p.horarioSolicitado}
                onChange={(e) => p.setHorarioSolicitado(e.target.value)}
                className={`${inputClass} sm:w-40`}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => p.setShowHorario(false)}
            className="min-h-12 self-start rounded-lg px-2 text-base text-zinc-700 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Ocultar
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartões de escolha (radios nativos escondidos dentro de <label>)
// ---------------------------------------------------------------------------
function CartaoEscolha(props: {
  nome: string;
  valor: string;
  marcado: boolean;
  onEscolher: () => void;
  corAnel: string;
  corFundo: string;
  corIcone: string;
  icone: ReactNode;
  titulo: string;
  descricao: string;
  extra?: ReactNode;
}) {
  return (
    <label
      className={`relative flex min-h-20 cursor-pointer items-start gap-4 rounded-2xl border-2 p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[#2195B9] ${
        props.marcado
          ? `${props.corAnel} ${props.corFundo} ring-4`
          : "border-zinc-300 bg-white hover:bg-zinc-50"
      }`}
    >
      <input
        type="radio"
        name={props.nome}
        value={props.valor}
        checked={props.marcado}
        onChange={props.onEscolher}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`flex size-12 shrink-0 items-center justify-center rounded-full ${props.corIcone}`}
      >
        {props.icone}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-lg font-semibold text-zinc-900">{props.titulo}</span>
        <span className="text-base leading-snug text-zinc-700">{props.descricao}</span>
        {props.extra}
      </span>
      {props.marcado && (
        <CircleCheck size={26} aria-hidden="true" className="shrink-0 text-zinc-900" />
      )}
    </label>
  );
}

const ESTILO_PRIORIDADE: Record<
  PautaPrioridade,
  { anel: string; fundo: string; icone: string; Icone: typeof ArrowDown }
> = {
  baixa: {
    anel: "border-sky-600 ring-sky-200",
    fundo: "bg-sky-50",
    icone: "bg-sky-100 text-sky-800",
    Icone: ArrowDown,
  },
  media: {
    anel: "border-amber-600 ring-amber-200",
    fundo: "bg-amber-50",
    icone: "bg-amber-100 text-amber-900",
    Icone: Minus,
  },
  alta: {
    anel: "border-red-600 ring-red-200",
    fundo: "bg-red-50",
    icone: "bg-red-100 text-red-800",
    Icone: TriangleAlert,
  },
};

// ---------------------------------------------------------------------------
// Etapa 3 — prioridade
// ---------------------------------------------------------------------------
export function EtapaPrioridade(props: {
  valor: PautaPrioridade;
  setValor: (v: PautaPrioridade) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={`${labelClass} mb-1`}>Qual a prioridade deste assunto?</legend>
      {PRIORIDADES.map((pr) => {
        const e = ESTILO_PRIORIDADE[pr.valor];
        const Icone = e.Icone;
        return (
          <CartaoEscolha
            key={pr.valor}
            nome="pauta-prioridade"
            valor={pr.valor}
            marcado={props.valor === pr.valor}
            onEscolher={() => props.setValor(pr.valor)}
            corAnel={e.anel}
            corFundo={e.fundo}
            corIcone={e.icone}
            icone={<Icone size={24} />}
            titulo={pr.rotulo}
            descricao={pr.descricao}
          />
        );
      })}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Etapa 4 — tipo
// ---------------------------------------------------------------------------
export function EtapaTipo(props: { valor: PautaTipo; setValor: (v: PautaTipo) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={`${labelClass} mb-1`}>Que tipo de pauta é esta?</legend>
      {TIPOS.map((t) => (
        <CartaoEscolha
          key={t.valor}
          nome="pauta-tipo"
          valor={t.valor}
          marcado={props.valor === t.valor}
          onEscolher={() => props.setValor(t.valor)}
          corAnel={t.valor === "deliberativa" ? "border-violet-600 ring-violet-200" : "border-zinc-600 ring-zinc-200"}
          corFundo={t.valor === "deliberativa" ? "bg-violet-50" : "bg-zinc-50"}
          corIcone={t.valor === "deliberativa" ? "bg-violet-100 text-violet-800" : "bg-zinc-200 text-zinc-800"}
          icone={t.valor === "deliberativa" ? <Gavel size={24} /> : <Megaphone size={24} />}
          titulo={t.rotulo}
          descricao={t.explicacao}
          extra={
            t.valor === "deliberativa" ? (
              <span className="mt-1 text-base font-medium text-violet-900">
                Quórum mínimo: {QUORUM_PADRAO} votos. A coordenação encerra a votação.
              </span>
            ) : undefined
          }
        />
      ))}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Etapa 5 — anexo opcional
// ---------------------------------------------------------------------------
export function EtapaAnexo(props: {
  arquivo: File | null;
  setArquivo: (f: File | null) => void;
  erro: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);

  function aoSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    const f = e.dataTransfer.files?.[0];
    if (f) props.setArquivo(f);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className={labelClass}>Quer anexar algum arquivo? (opcional)</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
        className={`flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          arrastando ? "border-[#2195B9] bg-[#2195B9]/10" : "border-zinc-400 bg-zinc-50"
        }`}
      >
        <Upload size={32} aria-hidden="true" className="text-[#1d6f8d]" />
        <p className="text-base text-zinc-800">Arraste o arquivo para cá ou escolha no seu aparelho.</p>
        <input
          ref={inputRef}
          id="pauta-anexo-input"
          type="file"
          accept={ANEXO_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f) props.setArquivo(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#1d6f8d] bg-white px-5 text-base font-semibold text-[#1d6f8d] hover:bg-[#2195B9]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
        >
          <Paperclip size={20} aria-hidden="true" /> Escolher arquivo
        </button>
        <p className="text-base text-zinc-700">
          Opcional. Documentos e imagens até 25 MB (PDF, Word, Excel, PowerPoint, imagem ou texto). Vídeos até 300 MB.
        </p>
      </div>

      {props.arquivo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-300 bg-white p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Paperclip size={22} aria-hidden="true" className="shrink-0 text-zinc-600" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-zinc-900">{props.arquivo.name}</p>
              <p className="text-base text-zinc-600">{formatarTamanho(props.arquivo.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => props.setArquivo(null)}
            className="min-h-12 rounded-xl border border-red-300 bg-white px-4 text-base font-medium text-red-800 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
          >
            Remover
          </button>
        </div>
      )}
      <ErroCampo id="pauta-anexo-erro" mensagem={props.erro} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Etapa 6 — revisão
// ---------------------------------------------------------------------------
function LinhaRevisao(props: { rotulo: string; valor: ReactNode; etapa: number; onEditar: (n: number) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-200 py-3 last:border-b-0">
      <div className="min-w-0">
        <dt className="text-base font-medium text-zinc-600">{props.rotulo}</dt>
        <dd className="mt-0.5 whitespace-pre-wrap break-words text-base text-zinc-900">{props.valor}</dd>
      </div>
      <button
        type="button"
        onClick={() => props.onEditar(props.etapa)}
        aria-label={`Editar ${props.rotulo}`}
        className="min-h-12 shrink-0 rounded-xl border border-zinc-300 bg-white px-4 text-base font-medium text-[#1d6f8d] hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]"
      >
        Editar
      </button>
    </div>
  );
}

export function EtapaRevisao(props: {
  titulo: string;
  contexto: string;
  reuniaoRotulo: string;
  dataHorarioRotulo: string | null;
  prioridade: PautaPrioridade;
  tipo: PautaTipo;
  arquivo: File | null;
  similares: PautaSimilar[];
  onEditar: (etapa: number) => void;
}) {
  const prioridade = PRIORIDADES.find((p) => p.valor === props.prioridade);
  const tipo = TIPOS.find((t) => t.valor === props.tipo);
  return (
    <div className="flex flex-col gap-4">
      <p className={labelClass}>Confira antes de enviar</p>
      {props.similares.length > 0 && (
        <div role="note" className="rounded-xl border border-amber-500 bg-amber-50 p-4 text-base text-amber-950">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert size={20} aria-hidden="true" /> Já existem pautas parecidas aguardando reunião:
          </p>
          <ul className="mt-2 list-disc pl-6">
            {props.similares.map((s) => (
              <li key={s.id}>
                {s.titulo}
                {s.emEspera && (
                  <span className="ml-2 rounded-full bg-amber-200 px-2 py-0.5 text-sm font-semibold">em espera</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Se for o mesmo assunto, combine com quem pediu em vez de duplicar. Você ainda pode enviar.
          </p>
        </div>
      )}
      <dl className="rounded-xl border border-zinc-200 bg-white px-4">
        <LinhaRevisao rotulo="Assunto" valor={props.titulo} etapa={1} onEditar={props.onEditar} />
        {props.contexto.trim() && (
          <LinhaRevisao rotulo="Contexto" valor={props.contexto} etapa={1} onEditar={props.onEditar} />
        )}
        <LinhaRevisao
          rotulo="Reunião"
          valor={
            <>
              {props.reuniaoRotulo}
              {props.dataHorarioRotulo && <span className="block text-zinc-700">{props.dataHorarioRotulo}</span>}
            </>
          }
          etapa={2}
          onEditar={props.onEditar}
        />
        <LinhaRevisao
          rotulo="Prioridade"
          valor={`${prioridade?.rotulo} — ${prioridade?.descricao}`}
          etapa={3}
          onEditar={props.onEditar}
        />
        <LinhaRevisao
          rotulo="Tipo"
          valor={
            props.tipo === "deliberativa"
              ? `${tipo?.rotulo} — abre votação prévia (quórum mínimo ${QUORUM_PADRAO})`
              : `${tipo?.rotulo} — só para avisar`
          }
          etapa={4}
          onEditar={props.onEditar}
        />
        <LinhaRevisao
          rotulo="Anexo"
          valor={
            props.arquivo ? `${props.arquivo.name} (${formatarTamanho(props.arquivo.size)})` : "Nenhum anexo"
          }
          etapa={5}
          onEditar={props.onEditar}
        />
      </dl>
    </div>
  );
}

"use client";

// "Pedir pauta" form — any volunteer submits a topic to be discussed at a
// selected meeting. Includes date/time preference and a meeting selector
// showing upcoming Tuesdays (reuniões already created).
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, ListPlus, CalendarDays, Clock, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  criarPauta,
  listarReunioesDisponiveis,
  type CriarPautaState,
  type ReuniaoDisponivel,
} from "./pauta-actions";

const initialState: CriarPautaState = { ok: false, message: "" };

const WEEKDAY_ABBR = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function formatMeetingLabel(meeting: ReuniaoDisponivel): string {
  const date = new Date(`${meeting.data_reuniao}T00:00:00`);
  const dayName = WEEKDAY_ABBR[date.getDay()];
  const day = date.getDate();
  const month = MONTH_ABBR[date.getMonth()];
  const time = meeting.horario ? meeting.horario.slice(0, 5) : "19:00";
  return `${dayName}, ${day} ${month} · ${time} — ${meeting.titulo}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2195B9] px-5 text-base font-medium text-white shadow-[0_1px_3px_rgba(33,149,185,0.25)] transition-all duration-200 hover:bg-[#28627B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 size={18} aria-hidden="true" className="animate-spin" />
      ) : (
        <ListPlus size={18} aria-hidden="true" />
      )}
      {pending ? "Adicionando..." : "Pedir pauta"}
    </button>
  );
}

export default function PautaForm() {
  const [state, formAction] = useActionState(criarPauta, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [reunioes, setReunioes] = useState<ReuniaoDisponivel[]>([]);
  const [reuniaoLoading, setReuniaoLoading] = useState(true);
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState<string>("");

  useEffect(() => {
    listarReunioesDisponiveis().then((data) => {
      setReunioes(data);
      setReuniaoLoading(false);
    });
  }, []);

  const inputClassName =
    "min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";

  return (
    <form
      ref={formRef}
      action={(formData) => {
        formAction(formData);
        formRef.current?.reset();
        setReuniaoSelecionada("");
      }}
      className="flex w-full flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pauta-titulo" className="text-base font-medium text-zinc-900">
          Assunto da pauta
        </label>
        <input
          id="pauta-titulo"
          name="titulo"
          required
          maxLength={200}
          placeholder="Sobre o que você quer conversar na próxima reunião?"
          className={inputClassName}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pauta-contexto" className="text-base font-medium text-zinc-900">
          Contexto (opcional)
        </label>
        <textarea
          id="pauta-contexto"
          name="contexto"
          rows={2}
          maxLength={3000}
          placeholder="Detalhe o assunto para quem for mediar a reunião..."
          className={`${inputClassName} min-h-20 resize-y`}
        />
      </div>

      {/* ── Data e horário solicitados ── */}
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2 text-base font-medium text-zinc-900">
          <CalendarDays size={16} aria-hidden="true" className="text-[#2195B9]" />
          Quando quer tratar essa pauta? (opcional)
        </span>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="date"
            name="data_solicitada"
            min={format(new Date(), "yyyy-MM-dd")}
            className={`${inputClassName} sm:w-auto`}
          />
          <div className="flex items-center gap-2">
            <Clock size={16} aria-hidden="true" className="text-zinc-400" />
            <input
              type="time"
              name="horario_solicitado"
              step={900}
              defaultValue="19:00"
              className={`${inputClassName} sm:w-36`}
            />
          </div>
        </div>
        <p className="text-sm text-zinc-500">
          Informe a data e horário preferidos para placemento na pauta.
        </p>
      </div>

      {/* ── Seletor de reunião ── */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pauta-reuniao" className="text-base font-medium text-zinc-900">
          Reunião para discutir
        </label>
        {reuniaoLoading ? (
          <div className="flex min-h-12 items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Carregando reuniões disponíveis...
          </div>
        ) : reunioes.length === 0 ? (
          <div className="flex min-h-12 items-center rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
            Nenhuma reunião futura encontrada. Registre uma ata primeiro.
          </div>
        ) : (
          <div className="relative">
            <select
              id="pauta-reuniao"
              name="reuniao_selecionada_id"
              value={reuniaoSelecionada}
              onChange={(e) => setReuniaoSelecionada(e.target.value)}
              className={`${inputClassName} appearance-none pr-10`}
            >
              <option value="">Próxima reunião (padrão)</option>
              {reunioes.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatMeetingLabel(r)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />
          </div>
        )}
        <p className="text-sm text-zinc-500">
          Selecione a reunião em que deseja que essa pauta seja discutida.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton />
        <p
          aria-live="polite"
          className={`text-sm ${
            state.ok ? "text-green-700" : "text-red-600"
          }`}
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}

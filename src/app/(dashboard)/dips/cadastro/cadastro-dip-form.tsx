"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Loader2,
  PlusCircle,
  CalendarDays,
  Users,
  FileText,
} from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { criarDip, type DipState } from "../actions";

const initial: DipState = { ok: false, message: "" };

const inputClass =
  "min-h-14 w-full rounded-xl border border-zinc-300 bg-white px-4 text-lg text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2195B9]";
const labelClass = "text-lg font-medium text-zinc-900";

function StatusLine({ state }: { state: DipState }) {
  if (!state.message) return null;
  return (
    <p
      role="alert"
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-lg ${
        state.ok
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {state.message}
    </p>
  );
}

function SubmitButton() {
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
        <PlusCircle size={22} aria-hidden="true" />
      )}
      {pending ? "Salvando..." : "Registrar DIP"}
    </button>
  );
}

export default function CadastroDipForm({
  localidades,
}: {
  localidades: { localidade: string; pais: string }[];
}) {
  const [state, formAction] = useActionState(criarDip, initial);
  const localidadesListId = useId();
  const [localidade, setLocalidade] = useState("");
  const [pais, setPais] = useState("");
  const [resetKey, setResetKey] = useState(0);

  if (state.ok) {
    return (
      <div className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-zinc-200/60">
        <PlusCircle size={48} className="text-green-600" aria-hidden="true" />
        <h2 className="text-3xl font-semibold text-zinc-900">DIP registrada!</h2>
        <p className="max-w-md text-xl text-zinc-700">{state.message}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setResetKey((k) => k + 1);
              setLocalidade("");
              setPais("");
            }}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-[#2195B9] px-5 text-lg font-medium text-white transition-colors hover:bg-[#28627B]"
          >
            <PlusCircle size={18} />
            Registrar outra DIP
          </button>
          <Link
            href="/dips"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
          >
            <ArrowLeft size={18} />
            Ver agenda de DIPs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form key={resetKey} action={formAction} className="flex w-full flex-col gap-5">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="localidade" className={labelClass}>
            <span className="flex items-center gap-1.5">
              <MapPin size={18} aria-hidden="true" />
              Localidade *
            </span>
          </label>
          <input
            id="localidade"
            name="localidade"
            required
            list={localidadesListId}
            value={localidade}
            onChange={(e) => {
              setLocalidade(e.target.value);
              const encontrada = localidades.find(
                (l) => l.localidade === e.target.value
              );
              if (encontrada) setPais(encontrada.pais);
            }}
            placeholder="Ex: São Paulo"
            className={inputClass}
          />
          {localidades.length > 0 && (
            <datalist id={localidadesListId}>
              {localidades.map((l) => (
                <option key={l.localidade} value={l.localidade} />
              ))}
            </datalist>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pais" className={labelClass}>
            <span className="flex items-center gap-1.5">
              <MapPin size={18} aria-hidden="true" />
              País *
            </span>
          </label>
          <input
            id="pais"
            name="pais"
            required
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            placeholder="Ex: Brasil"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="data" className={labelClass}>
            <span className="flex items-center gap-1.5">
              <CalendarDays size={18} aria-hidden="true" />
              Data da DIP
            </span>
          </label>
          <DateInput
            id="data"
            name="data"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="participantes" className={labelClass}>
            <span className="flex items-center gap-1.5">
              <Users size={18} aria-hidden="true" />
              Participantes
            </span>
          </label>
          <input
            id="participantes"
            name="participantes"
            type="number"
            min={0}
            placeholder="0"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="observacoes" className={labelClass}>
          <span className="flex items-center gap-1.5">
            <FileText size={18} aria-hidden="true" />
            Observações
          </span>
        </label>
        <textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          placeholder="Notas adicionais sobre esta DIP..."
          className={`${inputClass} min-h-24 resize-y py-3`}
        />
      </div>

      <StatusLine state={state} />

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton />
        <Link
          href="/dips"
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-50"
        >
          <ArrowLeft size={18} />
          Cancelar
        </Link>
      </div>
    </form>
  );
}
